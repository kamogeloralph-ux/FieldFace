import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { employees, employers, payslips, shifts } from "../drizzle/schema";
import { computePayroll } from "./payroll";
import { generatePayslipPdf } from "./pdf/payslip";
import { uploadPayslipPdf } from "./storage";

export async function generatePayslipForEmployee(
  employerId: string,
  employerName: string,
  employee: typeof employees.$inferSelect,
  year: number,
  month: number,
) {
  const monthStr = String(month).padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const allShifts = await db.select().from(shifts).where(eq(shifts.employeeId, employee.id));
  const periodShifts = allShifts.filter((s) => s.shiftDate >= from && s.shiftDate <= to);

  const totals = computePayroll(periodShifts, employee.hourlyRateWeekday, employee.hourlyRateWeekend);

  const pdfBuffer = await generatePayslipPdf({
    employerName,
    employeeName: employee.fullName,
    employeeCode: employee.employeeCode,
    periodYear: year,
    periodMonth: month,
    weekdayHours: totals.weekdayHours,
    weekendHours: totals.weekendHours,
    totalHours: totals.totalHours,
    hourlyRateWeekday: Number(employee.hourlyRateWeekday),
    hourlyRateWeekend: Number(employee.hourlyRateWeekend),
    grossPay: totals.grossPay,
  });

  const pdfPath = await uploadPayslipPdf(employee.id, year, month, pdfBuffer);

  const [saved] = await db
    .insert(payslips)
    .values({
      employeeId: employee.id,
      employerId,
      periodYear: year,
      periodMonth: month,
      weekdayHours: totals.weekdayHours.toString(),
      weekendHours: totals.weekendHours.toString(),
      totalHours: totals.totalHours.toString(),
      hourlyRateWeekday: employee.hourlyRateWeekday,
      hourlyRateWeekend: employee.hourlyRateWeekend,
      grossPay: totals.grossPay.toString(),
      pdfPath,
    })
    .onConflictDoUpdate({
      target: [payslips.employeeId, payslips.periodYear, payslips.periodMonth],
      set: {
        weekdayHours: totals.weekdayHours.toString(),
        weekendHours: totals.weekendHours.toString(),
        totalHours: totals.totalHours.toString(),
        grossPay: totals.grossPay.toString(),
        pdfPath,
        generatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

export async function generatePayslipsForEmployer(employerId: string, year: number, month: number) {
  const [employer] = await db.select().from(employers).where(eq(employers.id, employerId));
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.employerId, employerId), eq(employees.active, true)));

  const results = [];
  for (const employee of activeEmployees) {
    results.push(await generatePayslipForEmployee(employerId, employer?.name ?? "Employer", employee, year, month));
  }
  return results;
}

/** Used by the monthly cron job: generate payslips for every employer in the system. */
export async function generatePayslipsForAllEmployers(year: number, month: number) {
  const allEmployers = await db.select().from(employers);
  for (const employer of allEmployers) {
    await generatePayslipsForEmployer(employer.id, year, month);
  }
}
