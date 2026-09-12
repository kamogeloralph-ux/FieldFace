import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { companyDeductionEmployees, companyDeductions, employees, employers } from "../../drizzle/schema";
import { adminProcedure, ownerProcedure, platformProcedure, router } from "../trpc";

export const employersRouter = router({
  getMine: adminProcedure.query(async ({ ctx }) => {
    const [employer] = await db.select().from(employers).where(eq(employers.id, ctx.admin.employerId));
    return employer ?? null;
  }),

  listDeductions: adminProcedure.query(async ({ ctx }) => {
    const [deductions, assignments] = await Promise.all([
      db.select().from(companyDeductions).where(eq(companyDeductions.employerId, ctx.admin.employerId)),
      db.select().from(companyDeductionEmployees),
    ]);
    return deductions.map((deduction) => ({ ...deduction, employeeIds: assignments.filter((assignment) => assignment.deductionId === deduction.id).map((assignment) => assignment.employeeId) }));
  }),

  createDeduction: ownerProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100), type: z.enum(["fixed", "percentage"]), amount: z.number().finite().min(0).max(1_000_000), scope: z.enum(["all", "selected"]), employeeIds: z.array(z.string().uuid()).default([]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "percentage" && input.amount > 100) throw new Error("Percentage deductions cannot exceed 100%.");
      if (input.scope === "selected" && input.employeeIds.length === 0) throw new Error("Select at least one employee.");
      const validEmployees = input.scope === "selected" ? await db.select({ id: employees.id }).from(employees).where(and(eq(employees.employerId, ctx.admin.employerId), inArray(employees.id, input.employeeIds))) : [];
      if (input.scope === "selected" && validEmployees.length !== new Set(input.employeeIds).size) throw new Error("One or more selected employees do not belong to this company.");
      const [created] = await db.insert(companyDeductions).values({ employerId: ctx.admin.employerId, name: input.name, type: input.type, amount: input.amount.toFixed(2), scope: input.scope }).returning();
      if (input.scope === "selected") await db.insert(companyDeductionEmployees).values(input.employeeIds.map((employeeId) => ({ deductionId: created.id, employeeId })));
      return created;
    }),

  updateDeduction: ownerProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), type: z.enum(["fixed", "percentage"]), amount: z.number().finite().min(0).max(1_000_000), active: z.boolean(), scope: z.enum(["all", "selected"]), employeeIds: z.array(z.string().uuid()).default([]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "percentage" && input.amount > 100) throw new Error("Percentage deductions cannot exceed 100%.");
      if (input.scope === "selected" && input.employeeIds.length === 0) throw new Error("Select at least one employee.");
      if (input.scope === "selected") {
        const validEmployees = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.employerId, ctx.admin.employerId), inArray(employees.id, input.employeeIds)));
        if (validEmployees.length !== new Set(input.employeeIds).size) throw new Error("One or more selected employees do not belong to this company.");
      }
      return db.transaction(async (tx) => {
        const [updated] = await tx.update(companyDeductions).set({ name: input.name, type: input.type, amount: input.amount.toFixed(2), active: input.active, scope: input.scope }).where(and(eq(companyDeductions.id, input.id), eq(companyDeductions.employerId, ctx.admin.employerId))).returning();
        if (!updated) throw new Error("Deduction not found for this company.");
        await tx.delete(companyDeductionEmployees).where(eq(companyDeductionEmployees.deductionId, input.id));
        if (input.scope === "selected") await tx.insert(companyDeductionEmployees).values(input.employeeIds.map((employeeId) => ({ deductionId: input.id, employeeId })));
        return updated;
      });
    }),

  deleteDeduction: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db.delete(companyDeductions).where(and(eq(companyDeductions.id, input.id), eq(companyDeductions.employerId, ctx.admin.employerId))).returning({ id: companyDeductions.id });
      if (!deleted) throw new Error("Deduction not found for this company.");
      return { success: true as const };
    }),

  updateMine: platformProcedure
    .input(
      z.object({
        employerId: z.string().uuid(),
        name: z.string().min(1).optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        taxNumber: z.string().optional(),
        companyRegNumber: z.string().optional(),
        uifEnabled: z.boolean().optional(),
        uifEmployeeRate: z.number().min(0).max(100).optional(),
        uifEmployerRate: z.number().min(0).max(100).optional(),
        timezone: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { employerId, uifEmployeeRate, uifEmployerRate, ...rest } = input;
      const values: Record<string, unknown> = { ...rest };
      if (typeof uifEmployeeRate === "number") values.uifEmployeeRate = uifEmployeeRate.toString();
      if (typeof uifEmployerRate === "number") values.uifEmployerRate = uifEmployerRate.toString();

      const [updated] = await db
        .update(employers)
        .set(values)
        .where(eq(employers.id, input.employerId))
        .returning();
      return updated;
    }),
});
