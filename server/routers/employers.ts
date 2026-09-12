import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { companyDeductions, employers } from "../../drizzle/schema";
import { adminProcedure, ownerProcedure, platformProcedure, router } from "../trpc";

export const employersRouter = router({
  getMine: adminProcedure.query(async ({ ctx }) => {
    const [employer] = await db.select().from(employers).where(eq(employers.id, ctx.admin.employerId));
    return employer ?? null;
  }),

  listDeductions: adminProcedure.query(async ({ ctx }) =>
    db.select().from(companyDeductions).where(eq(companyDeductions.employerId, ctx.admin.employerId)),
  ),

  createDeduction: ownerProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100), type: z.enum(["fixed", "percentage"]), amount: z.number().finite().min(0).max(1_000_000) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "percentage" && input.amount > 100) throw new Error("Percentage deductions cannot exceed 100%.");
      const [created] = await db.insert(companyDeductions).values({ employerId: ctx.admin.employerId, name: input.name, type: input.type, amount: input.amount.toFixed(2) }).returning();
      return created;
    }),

  updateDeduction: ownerProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), type: z.enum(["fixed", "percentage"]), amount: z.number().finite().min(0).max(1_000_000), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "percentage" && input.amount > 100) throw new Error("Percentage deductions cannot exceed 100%.");
      const [updated] = await db.update(companyDeductions).set({ name: input.name, type: input.type, amount: input.amount.toFixed(2), active: input.active }).where(and(eq(companyDeductions.id, input.id), eq(companyDeductions.employerId, ctx.admin.employerId))).returning();
      if (!updated) throw new Error("Deduction not found for this company.");
      return updated;
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
