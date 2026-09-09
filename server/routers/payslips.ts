import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { employees, payslips } from "../../drizzle/schema";
import { adminProcedure, router } from "../trpc";
import { generatePayslipsForEmployer } from "../payslipGeneration";
import { signedUrl } from "../storage";

export const payslipsRouter = router({
  generateForMonth: adminProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const results = await generatePayslipsForEmployer(ctx.admin.employerId, input.year, input.month);
      return { generated: results.length };
    }),

  list: adminProcedure
    .input(z.object({ year: z.number().int().optional(), month: z.number().int().optional(), employeeId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await db.select().from(payslips).where(eq(payslips.employerId, ctx.admin.employerId));
      const employeeRows = await db.select().from(employees).where(eq(employees.employerId, ctx.admin.employerId));
      const nameById = new Map(employeeRows.map((e) => [e.id, e.fullName]));

      return rows
        .filter((p) => (input.year ? p.periodYear === input.year : true))
        .filter((p) => (input.month ? p.periodMonth === input.month : true))
        .filter((p) => (input.employeeId ? p.employeeId === input.employeeId : true))
        .map((p) => ({ ...p, employeeName: nameById.get(p.employeeId) ?? "Unknown" }))
        .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    }),

  downloadUrl: adminProcedure.input(z.object({ payslipId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(and(eq(payslips.id, input.payslipId), eq(payslips.employerId, ctx.admin.employerId)));
    if (!payslip) return null;
    return { url: await signedUrl("payslips", payslip.pdfPath, 300) };
  }),
});
