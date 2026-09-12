import test from "node:test";
import assert from "node:assert/strict";
import { computePayroll, computeUifDeduction, hoursBetween } from "./payroll";

test("rounds hours and gross pay to cents", () => {
  assert.deepEqual(computePayroll([{ hours: "1.234", isWeekend: false }, { hours: 2, isWeekend: true }], 10, 20), { weekdayHours: 1.23, weekendHours: 2, totalHours: 3.23, grossPay: 52.3 });
});
test("calculates configurable UIF employee deductions", () => {
  assert.equal(computeUifDeduction(1234.56, true, 1), 12.35);
  assert.equal(computeUifDeduction(1234.56, false, 1), 0);
});
test("never produces negative shift hours", () => {
  assert.equal(hoursBetween(new Date("2026-01-02T10:00:00Z"), new Date("2026-01-02T09:00:00Z")), 0);
});
