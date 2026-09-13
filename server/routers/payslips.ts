import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { payslips } from "../../drizzle/schema";
import { adminProcedure, employeeProcedure, ownerProcedure, router } from "../trpc";
import { generatePayslipsForEmployer } from "../payslipGeneration";
import { signedUrl } from "../storage";
import { TRPCError } from "@trpc/server";
import { writeAudit } from "../audit";

export const payslipsRouter = router({
  finalizePeriod: ownerProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [result] = await db.update(payslips)
        .set({ status: "finalized", finalizedAt: now, finalizedBy: ctx.admin.adminUserId })
        .where(and(eq(payslips.employerId, ctx.admin.employerId), eq(payslips.periodYear, input.year), eq(payslips.periodMonth, input.month)))
        .returning({ id: payslips.id });
      if (result) await writeAudit({ actorType: "admin", actorId: ctx.admin.adminUserId, employerId: ctx.admin.employerId, action: "payroll.finalized", entityType: "payroll_period", metadata: { year: input.year, month: input.month } });
      return { finalized: result ? true : false };
    }),

  generateForMonth: adminProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const locked = await db.select({ id: payslips.id }).from(payslips).where(and(eq(payslips.employerId, ctx.admin.employerId), eq(payslips.periodYear, input.year), eq(payslips.periodMonth, input.month), eq(payslips.status, "finalized"))).limit(1);
      if (locked.length) throw new TRPCError({ code: "FORBIDDEN", message: "This payroll period is finalized and cannot be regenerated." });
      const results = await generatePayslipsForEmployer(ctx.admin.employerId, input.year, input.month);
      return { generated: results.length };
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

});
