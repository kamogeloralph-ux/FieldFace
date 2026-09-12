import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { employees, employers, payslips } from "../../drizzle/schema";
import { adminProcedure, employeeProcedure, router } from "../trpc";
import { generatePayslipForEmployee, generatePayslipsForEmployer } from "../payslipGeneration";
import { signedUrl } from "../storage";
import { TRPCError } from "@trpc/server";

export const payslipsRouter = router({
  generateForMonth: adminProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const results = await generatePayslipsForEmployer(ctx.admin.employerId, input.year, input.month);
      return { generated: results.length };
    }),

  generateForEmployee: adminProcedure
    .input(z.object({ employeeId: z.string().uuid(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, input.employeeId), eq(employees.employerId, ctx.admin.employerId)));
      if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });

      const [employer] = await db.select().from(employers).where(eq(employers.id, ctx.admin.employerId));
      if (!employer) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });

      const payslip = await generatePayslipForEmployee(ctx.admin.employerId, employer, employee, input.year, input.month);
      return { id: payslip.id };
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

  myPayslips: employeeProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(payslips)
      .where(eq(payslips.employeeId, ctx.employee.employeeId))
      .then((rows) => rows.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()));
  }),

  myDownloadUrl: employeeProcedure.input(z.object({ payslipId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(and(eq(payslips.id, input.payslipId), eq(payslips.employeeId, ctx.employee.employeeId)));
    if (!payslip) return null;
    return { url: await signedUrl("payslips", payslip.pdfPath, 3600) };
  }),

  shareUrl: adminProcedure
    .input(z.object({ employeeId: z.string().uuid(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      const [payslip] = await db
        .select()
        .from(payslips)
        .where(
          and(
            eq(payslips.employeeId, input.employeeId),
            eq(payslips.employerId, ctx.admin.employerId),
            eq(payslips.periodYear, input.year),
            eq(payslips.periodMonth, input.month),
          ),
        );
      if (!payslip) return null;
      return { url: await signedUrl("payslips", payslip.pdfPath, 300) };
    }),
});
