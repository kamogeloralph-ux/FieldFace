import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { employees, shifts, sites, timeEntries } from "../../drizzle/schema";
import { employeeProcedure, router } from "../trpc";
import { uploadSelfie, signedUrl } from "../storage";
import { isWithinGeofence } from "../geofence";
import { hoursBetween, isWeekendDate } from "../payroll";
import { TRPCError } from "@trpc/server";

export const timeEntriesRouter = router({
  // Called right after login so the app knows whether to show "Clock in" or
  // "Clock out", and can render the site's reference photo + geofence info.
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

    const [lastEntry] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.employeeId, employee.id))
      .orderBy(desc(timeEntries.occurredAt))
      .limit(1);

    const nextAction = !lastEntry || lastEntry.entryType === "clock_out" ? "clock_in" : "clock_out";

    return { site, nextAction, lastEntryAt: lastEntry?.occurredAt ?? null };
  }),

  clock: employeeProcedure
    .input(
      z.object({
        entryType: z.enum(["clock_in", "clock_out"]),
        selfieBase64: z.string().min(1),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        gpsAccuracyMeters: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [employee] = await db.select().from(employees).where(eq(employees.id, ctx.employee.employeeId));
      if (!employee || !employee.active) throw new TRPCError({ code: "FORBIDDEN", message: "Account is inactive." });
      if (!employee.siteId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No worksite assigned yet — ask your supervisor." });
      }

      const [site] = await db.select().from(sites).where(eq(sites.id, employee.siteId));
      if (!site) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Assigned worksite not found." });

      // Enforce correct sequencing: can't clock in twice in a row, etc.
      const [lastEntry] = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.employeeId, employee.id))
        .orderBy(desc(timeEntries.occurredAt))
        .limit(1);
      const expected = !lastEntry || lastEntry.entryType === "clock_out" ? "clock_in" : "clock_out";
      if (expected !== input.entryType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: expected === "clock_in" ? "You need to clock in first." : "You're already clocked in — clock out instead.",
        });
      }

      const { distance, withinGeofence } = isWithinGeofence(
        input.latitude,
        input.longitude,
        site.latitude,
        site.longitude,
        site.radiusMeters,
      );

      const selfiePath = await uploadSelfie(employee.id, input.selfieBase64);

      const [entry] = await db
        .insert(timeEntries)
        .values({
          employeeId: employee.id,
          siteId: site.id,
          entryType: input.entryType,
          selfieUrl: selfiePath,
          latitude: input.latitude,
          longitude: input.longitude,
          distanceMeters: distance,
          withinGeofence,
          gpsAccuracyMeters: input.gpsAccuracyMeters,
        })
        .returning();

      // On clock-out, close the shift and pre-compute hours for payroll/reporting.
      if (input.entryType === "clock_out" && lastEntry && lastEntry.entryType === "clock_in") {
        const hours = hoursBetween(lastEntry.occurredAt, entry.occurredAt);
        await db.insert(shifts).values({
          employeeId: employee.id,
          siteId: site.id,
          clockInEntryId: lastEntry.id,
          clockOutEntryId: entry.id,
          clockInAt: lastEntry.occurredAt,
          clockOutAt: entry.occurredAt,
          shiftDate: lastEntry.occurredAt.toISOString().slice(0, 10),
          hours: hours.toString(),
          isWeekend: isWeekendDate(lastEntry.occurredAt),
          bothWithinGeofence: lastEntry.withinGeofence && entry.withinGeofence,
        });
      }

      return {
        entryType: entry.entryType,
        occurredAt: entry.occurredAt,
        withinGeofence,
        distanceMeters: Math.round(distance),
        siteName: site.name,
        siteRadiusMeters: site.radiusMeters,
      };
    }),

  myShifts: employeeProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.employeeId, ctx.employee.employeeId))
      .orderBy(desc(shifts.shiftDate))
      .limit(30);
    return rows;
  }),
});
