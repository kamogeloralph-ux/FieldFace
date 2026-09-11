import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
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

  selfServiceStatus: employeeProcedure.query(async ({ ctx }) => {
    const [employee] = await db.select().from(employees).where(eq(employees.id, ctx.employee.employeeId));
    if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const used = employee.selfServiceGenPeriod === period ? employee.selfServiceGenCount : 0;
    return { year: now.getFullYear(), month: now.getMonth() + 1, used, remaining: Math.max(0, 2 - used) };
  }),

  generateForSelf: employeeProcedure.mutation(async ({ ctx }) => {
    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, ctx.employee.employeeId), eq(employees.active, true)));
    if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });

    const [employer] = await db.select().from(employers).where(eq(employers.id, employee.employerId));
    if (!employer) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, "0")}`;

    // Reserve one of the two monthly slots atomically so concurrent requests
    // cannot bypass the limit. Admin-generated payslips do not consume slots.
    const [reserved] = await db
      .update(employees)
      .set({
        selfServiceGenPeriod: period,
        selfServiceGenCount: sql`CASE WHEN ${employees.selfServiceGenPeriod} = ${period} THEN ${employees.selfServiceGenCount} + 1 ELSE 1 END`,
      })
      .where(
        and(
          eq(employees.id, employee.id),
          eq(employees.active, true),
          sql`(${employees.selfServiceGenPeriod} IS NULL OR ${employees.selfServiceGenPeriod} <> ${period} OR ${employees.selfServiceGenCount} < 2)`,
        ),
      )
      .returning({ count: employees.selfServiceGenCount });

    if (!reserved) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can generate a maximum of two payslips per month." });
    }

    const payslip = await generatePayslipForEmployee(employee.employerId, employer, employee, year, month);
    return { id: payslip.id, used: reserved.count, remaining: Math.max(0, 2 - reserved.count), year, month };
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
    return { url: await signedUrl("payslips", payslip.pdfPath, 300) };
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
