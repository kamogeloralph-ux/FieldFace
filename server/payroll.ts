import { WEEKEND_DAYS } from "@shared/const";

export function isWeekendDate(d: Date): boolean {
  return WEEKEND_DAYS.includes(d.getDay());
}

/** Hours between two timestamps, rounded to 2 decimal places. Never negative. */
export function hoursBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  const hours = Math.max(0, ms / 1000 / 60 / 60);
  return Math.round(hours * 100) / 100;
}

export interface PayrollTotals {
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  grossPay: number;
}

export function computePayroll(
  shifts: { hours: string | number; isWeekend: boolean }[],
  hourlyRateWeekday: string | number,
  hourlyRateWeekend: string | number,
): PayrollTotals {
  let weekdayHours = 0;
  let weekendHours = 0;
  for (const shift of shifts) {
    const hours = Number(shift.hours);
    if (shift.isWeekend) weekendHours += hours;
    else weekdayHours += hours;
  }
  weekdayHours = Math.round(weekdayHours * 100) / 100;
  weekendHours = Math.round(weekendHours * 100) / 100;
  const totalHours = Math.round((weekdayHours + weekendHours) * 100) / 100;
  const grossPay =
    Math.round(
      (weekdayHours * Number(hourlyRateWeekday) + weekendHours * Number(hourlyRateWeekend)) * 100,
    ) / 100;
  return { weekdayHours, weekendHours, totalHours, grossPay };
}

/**
 * South Africa's UIF is the classic case here: 1% employee-side deduction
 * (matched by a 1% employer contribution that isn't deducted from the
 * employee), but the rate is configurable per company since not every
 * deployment will use SA's default.
 */
export function computeUifDeduction(grossPay: number, uifEnabled: boolean, uifEmployeeRate: string | number): number {
  if (!uifEnabled) return 0;
  const rate = Number(uifEmployeeRate) / 100;
  return Math.round(grossPay * rate * 100) / 100;
}

export interface CompanyDeductionInput {
  name: string;
  type: "fixed" | "percentage";
  amount: string | number;
}

export interface CompanyDeductionResult {
  name: string;
  type: "fixed" | "percentage";
  rate: number;
  amount: number;
}

/** Applies active company deductions in configured order without allowing net pay below zero. */
export function computeCompanyDeductions(
  grossPay: number,
  uifDeduction: number,
  deductions: CompanyDeductionInput[],
): CompanyDeductionResult[] {
  let remaining = Math.max(0, grossPay - uifDeduction);
  return deductions.map((deduction) => {
    const rate = Number(deduction.amount);
    const requested = deduction.type === "percentage" ? grossPay * rate / 100 : rate;
    const amount = Math.round(Math.min(Math.max(0, requested), remaining) * 100) / 100;
    remaining = Math.max(0, remaining - amount);
    return { name: deduction.name, type: deduction.type, rate, amount };
  });
}
