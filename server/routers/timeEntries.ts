import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { employees, employers, shifts, sites, timeEntries } from "../../drizzle/schema";
import { employeeProcedure, router } from "../trpc";
import { uploadSelfie, signedUrl } from "../storage";
import { isWithinGeofence } from "../geofence";
import { hoursBetween, isWeekendDate } from "../payroll";
import { TRPCError } from "@trpc/server";
import { localDate } from "../timezone";

export const timeEntriesRouter = router({
  status: employeeProcedure.query(async ({ ctx }) => {
    const [employee] = await db.select().from(employees).where(eq(employees.id, ctx.employee.employeeId));
    if (!employee) throw new TRPCError({ code: "NOT_FOUND" });

    let site = null;
    if (employee.siteId) {
      const [s] = await db.select().from(sites).where(eq(sites.id, employee.siteId));
      if (s) {
        site = {
          id: s.id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          radiusMeters: s.radiusMeters,
          referencePhotoUrl: s.referencePhotoUrl ? await signedUrl("site-photos", s.referencePhotoUrl, 3600) : null,
        };
      }
    }

    const [lastEntry] = await db.select().from(timeEntries).where(eq(timeEntries.employeeId, employee.id)).orderBy(desc(timeEntries.occurredAt)).limit(1);
    const nextAction: "clock_in" | "clock_out" = !lastEntry || lastEntry.entryType === "clock_out" ? "clock_in" : "clock_out";
    return { site, nextAction, lastEntryAt: lastEntry?.occurredAt ?? null };
  }),

  clock: employeeProcedure
    .input(z.object({
      actionId: z.string().uuid(),
      capturedAt: z.string().datetime().optional(),
      entryType: z.enum(["clock_in", "clock_out"]),
      selfieBase64: z.string().min(1).max(11_000_000),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      gpsAccuracyMeters: z.number().min(0).max(10000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.employee.employeeId}))`);

        const [employee] = await tx.select().from(employees).where(eq(employees.id, ctx.employee.employeeId));
        if (!employee || !employee.active) throw new TRPCError({ code: "FORBIDDEN", message: "Account is inactive." });
        if (!employee.siteId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No worksite assigned yet — ask your supervisor." });
        const [site] = await tx.select().from(sites).where(eq(sites.id, employee.siteId));
        if (!site) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Assigned worksite not found." });
        const [employer] = await tx.select({ timezone: employers.timezone }).from(employers).where(eq(employers.id, employee.employerId));

        const [alreadyRecorded] = await tx.select().from(timeEntries).where(and(eq(timeEntries.employeeId, employee.id), eq(timeEntries.clockActionId, input.actionId)));
        if (alreadyRecorded) {
          return {
            entryType: alreadyRecorded.entryType,
            occurredAt: alreadyRecorded.occurredAt,
            withinGeofence: alreadyRecorded.withinGeofence,
            distanceMeters: Math.round(alreadyRecorded.distanceMeters),
            siteName: site.name,
            siteRadiusMeters: site.radiusMeters,
            idempotentReplay: true,
          };
        }

        const [lastEntry] = await tx.select().from(timeEntries).where(eq(timeEntries.employeeId, employee.id)).orderBy(desc(timeEntries.occurredAt)).limit(1);
        const expected = !lastEntry || lastEntry.entryType === "clock_out" ? "clock_in" : "clock_out";
        if (expected !== input.entryType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: expected === "clock_in" ? "You need to clock in first." : "You're already clocked in — clock out instead." });
        }

        const { distance, withinGeofence } = isWithinGeofence(input.latitude, input.longitude, site.latitude, site.longitude, site.radiusMeters);
        const selfiePath = await uploadSelfie(employee.id, input.selfieBase64);
        const [entry] = await tx.insert(timeEntries).values({
          employeeId: employee.id,
          siteId: site.id,
          entryType: input.entryType,
          selfieUrl: selfiePath,
          latitude: input.latitude,
          longitude: input.longitude,
          distanceMeters: distance,
          withinGeofence,
          gpsAccuracyMeters: input.gpsAccuracyMeters,
          clockActionId: input.actionId,
          capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
        }).returning();

        if (input.entryType === "clock_out" && lastEntry && lastEntry.entryType === "clock_in") {
          const hours = hoursBetween(lastEntry.occurredAt, entry.occurredAt);
          await tx.insert(shifts).values({
            employeeId: employee.id,
            siteId: site.id,
            clockInEntryId: lastEntry.id,
            clockOutEntryId: entry.id,
            clockInAt: lastEntry.occurredAt,
            clockOutAt: entry.occurredAt,
            shiftDate: localDate(lastEntry.occurredAt, employer?.timezone ?? "Africa/Johannesburg"),
            hours: hours.toString(),
            isWeekend: isWeekendDate(lastEntry.occurredAt),
            bothWithinGeofence: lastEntry.withinGeofence && entry.withinGeofence,
          });
        }

        return { entryType: entry.entryType, occurredAt: entry.occurredAt, withinGeofence, distanceMeters: Math.round(distance), siteName: site.name, siteRadiusMeters: site.radiusMeters, idempotentReplay: false };
      });
    }),

  myShifts: employeeProcedure.query(async ({ ctx }) => db.select().from(shifts).where(eq(shifts.employeeId, ctx.employee.employeeId)).orderBy(desc(shifts.shiftDate)).limit(30)),
});
