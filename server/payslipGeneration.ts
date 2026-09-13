import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { companyDeductionEmployees, companyDeductions, employees, employers, payslips, positionWageRates, shifts } from "../drizzle/schema";
import { computeCompanyDeductions, computePayroll, computeUifDeduction } from "./payroll";
import { generatePayslipPdf } from "./pdf/payslip";
import { uploadPayslipPdf } from "./storage";

const positionLabels = { general_worker: "General worker", supervisor: "Supervisor", team_leader: "Team leader" } as const;

export async function generatePayslipForEmployee(
  employerId: string,
  employer: typeof employers.$inferSelect,
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

  const [positionRate] = await db.select().from(positionWageRates).where(and(eq(positionWageRates.employerId, employerId), eq(positionWageRates.position, employee.position)));
  const hourlyRateWeekday = positionRate?.hourlyRateWeekday ?? employee.hourlyRateWeekday;
  const hourlyRateWeekend = positionRate?.hourlyRateWeekend ?? employee.hourlyRateWeekend;
  const totals = computePayroll(periodShifts, hourlyRateWeekday, hourlyRateWeekend);
  const uifDeduction = computeUifDeduction(totals.grossPay, employer.uifEnabled, employer.uifEmployeeRate);
  const configuredDeductions = await db.select().from(companyDeductions).where(and(eq(companyDeductions.employerId, employerId), eq(companyDeductions.active, true)));
  const selectedAssignments = await db.select().from(companyDeductionEmployees).where(eq(companyDeductionEmployees.employeeId, employee.id));
  const assignedIds = new Set(selectedAssignments.map((assignment) => assignment.deductionId));
  const applicableDeductions = configuredDeductions.filter((deduction) => deduction.scope === "all" || assignedIds.has(deduction.id));
  const deductionDetails = computeCompanyDeductions(totals.grossPay, uifDeduction, applicableDeductions);
  const customDeductions = deductionDetails.reduce((sum, deduction) => sum + deduction.amount, 0);
  const netPay = Math.round((totals.grossPay - uifDeduction - customDeductions) * 100) / 100;

  const pdfBuffer = await generatePayslipPdf({
    employerName: employer.name,
    employerTaxNumber: employer.taxNumber,
    employerRegNumber: employer.companyRegNumber,
    employerAddress: employer.address,
    employerPhone: employer.contactPhone,
    employeeName: employee.fullName,
    employeeCode: employee.employeeCode,
    employeePosition: positionLabels[employee.position as keyof typeof positionLabels] ?? "General worker",
    employeeIdNumber: employee.idNumber,
    employeeTaxNumber: employee.taxNumber,
    employeeAddress: employee.physicalAddress,
    periodYear: year,
    periodMonth: month,
    weekdayHours: totals.weekdayHours,
    weekendHours: totals.weekendHours,
    totalHours: totals.totalHours,
    hourlyRateWeekday: Number(hourlyRateWeekday),
    hourlyRateWeekend: Number(hourlyRateWeekend),
    grossPay: totals.grossPay,
    uifDeduction,
    companyDeductions: deductionDetails,
    netPay,
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
      hourlyRateWeekday,
      hourlyRateWeekend,
      grossPay: totals.grossPay.toString(),
      uifDeduction: uifDeduction.toString(),
      deductionDetails,
      netPay: netPay.toString(),
      pdfPath,
    })
    .onConflictDoUpdate({
      target: [payslips.employeeId, payslips.periodYear, payslips.periodMonth],
      set: {
        weekdayHours: totals.weekdayHours.toString(),
        weekendHours: totals.weekendHours.toString(),
        totalHours: totals.totalHours.toString(),
        grossPay: totals.grossPay.toString(),
        uifDeduction: uifDeduction.toString(),
        deductionDetails,
        netPay: netPay.toString(),
        pdfPath,
        generatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

export async function generatePayslipsForEmployer(employerId: string, year: number, month: number) {
  const [employer] = await db.select().from(employers).where(eq(employers.id, employerId));
  if (!employer) return [];
  const activeEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.employerId, employerId), eq(employees.active, true)));

  const results = [];
  for (const employee of activeEmployees) {
    results.push(await generatePayslipForEmployee(employerId, employer, employee, year, month));
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
