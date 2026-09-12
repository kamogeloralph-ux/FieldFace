import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { employees, leaveRequests } from "../../drizzle/schema";
import { adminProcedure, employeeProcedure, router } from "../trpc";

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const leaveRequestsRouter = router({
  mine: employeeProcedure.query(async ({ ctx }) =>
    db.select().from(leaveRequests)
      .where(eq(leaveRequests.employeeId, ctx.employee.employeeId))
      .orderBy(desc(leaveRequests.startDate), desc(leaveRequests.createdAt)),
  ),

  submit: employeeProcedure
    .input(z.object({ startDate: dateInput, endDate: dateInput, reason: z.string().trim().min(2).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (input.endDate < input.startDate) throw new Error("The end date must be on or after the start date.");
      const [created] = await db.insert(leaveRequests).values({ employerId: ctx.employee.employerId, employeeId: ctx.employee.employeeId, startDate: input.startDate, endDate: input.endDate, reason: input.reason }).returning();
      return created;
    }),

  cancel: employeeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [cancelled] = await db.delete(leaveRequests).where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.employeeId, ctx.employee.employeeId), eq(leaveRequests.status, "pending"))).returning({ id: leaveRequests.id });
      if (!cancelled) throw new Error("Only your pending requests can be cancelled.");
      return { success: true as const };
    }),

  listForManagement: adminProcedure.query(async ({ ctx }) =>
    db.select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      managerNote: leaveRequests.managerNote,
      reviewedAt: leaveRequests.reviewedAt,
      createdAt: leaveRequests.createdAt,
    }).from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(eq(leaveRequests.employerId, ctx.admin.employerId))
      .orderBy(asc(leaveRequests.status), desc(leaveRequests.startDate), desc(leaveRequests.createdAt)),
  ),

  decide: adminProcedure
    .input(z.object({ id: z.string().uuid(), decision: z.enum(["approved", "declined"]), managerNote: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(leaveRequests).set({ status: input.decision, managerNote: input.managerNote || null, reviewedBy: ctx.admin.adminUserId, reviewedAt: new Date() }).where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.employerId, ctx.admin.employerId), eq(leaveRequests.status, "pending"))).returning();
      if (!updated) throw new Error("This request is no longer pending or does not belong to your company.");
      return updated;
    }),
});
