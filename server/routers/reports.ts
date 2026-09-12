import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { employees, employers, shifts, sites, timeEntries } from "../../drizzle/schema";
import { adminProcedure, router } from "../trpc";
import { signedUrl } from "../storage";
import { localDayBounds } from "../timezone";

export const reportsRouter = router({
  // Today's (or a chosen day's) clock activity across the whole employer,
  // with selfie thumbnails — this is the supervisor's daily report.
  dailyReport: adminProcedure
    .input(z.object({ date: z.string().optional() })) // "YYYY-MM-DD", defaults to today
    .query(async ({ ctx, input }) => {
      const day = input.date ?? new Date().toISOString().slice(0, 10);
      const [employer] = await db.select({ timezone: employers.timezone }).from(employers).where(eq(employers.id, ctx.admin.employerId));
      const { start: dayStart, end: dayEnd } = localDayBounds(day, employer?.timezone ?? "Africa/Johannesburg");

      const employerEmployees = await db
        .select()
        .from(employees)
        .where(eq(employees.employerId, ctx.admin.employerId));
      const employeeIds = new Set(employerEmployees.map((e) => e.id));
      const employeeById = new Map(employerEmployees.map((e) => [e.id, e]));

      const siteRows = await db.select().from(sites).where(eq(sites.employerId, ctx.admin.employerId));
      const siteById = new Map(siteRows.map((s) => [s.id, s]));

      const entries = await db
        .select()
        .from(timeEntries)
        .where(and(gte(timeEntries.occurredAt, dayStart), lte(timeEntries.occurredAt, dayEnd)));

      const relevant = entries.filter((e) => employeeIds.has(e.employeeId));

      const withUrls = await Promise.all(
        relevant.map(async (e) => ({
          id: e.id,
          employeeId: e.employeeId,
          employeeName: employeeById.get(e.employeeId)?.fullName ?? "Unknown",
          siteName: e.siteId ? siteById.get(e.siteId)?.name ?? "Unknown site" : "No site",
          entryType: e.entryType,
          occurredAt: e.occurredAt,
          withinGeofence: e.withinGeofence,
          distanceMeters: Math.round(e.distanceMeters),
          selfieUrl: await signedUrl("selfies", e.selfieUrl, 3600),
        })),
      );

      withUrls.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

      const clockedInNow = new Set<string>();
      for (const e of [...withUrls].reverse()) {
        if (e.entryType === "clock_in") clockedInNow.add(e.employeeId);
        else clockedInNow.delete(e.employeeId);
      }

      return {
        date: day,
        totalActiveEmployees: employerEmployees.filter((e) => e.active).length,
        currentlyClockedIn: clockedInNow.size,
        entries: withUrls,
        outsideGeofenceCount: withUrls.filter((e) => !e.withinGeofence).length,
      };
    }),

  employeeHoursSummary: adminProcedure
    .input(z.object({ employeeId: z.string().uuid(), from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, input.employeeId), eq(employees.employerId, ctx.admin.employerId)));
      if (!employee) return null;

      const rows = await db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.employeeId, input.employeeId),
            gte(shifts.shiftDate, input.from),
            lte(shifts.shiftDate, input.to),
          ),
        );

      const weekdayHours = rows.filter((r) => !r.isWeekend).reduce((sum, r) => sum + Number(r.hours), 0);
      const weekendHours = rows.filter((r) => r.isWeekend).reduce((sum, r) => sum + Number(r.hours), 0);

      return {
        employeeName: employee.fullName,
        shifts: rows,
        weekdayHours: Math.round(weekdayHours * 100) / 100,
        weekendHours: Math.round(weekendHours * 100) / 100,
        totalHours: Math.round((weekdayHours + weekendHours) * 100) / 100,
      };
    }),
});
