import cron from "node-cron";
import { generatePayslipsForAllEmployers } from "./payslipGeneration";

/**
 * Runs at 02:00 on the 1st of every month and auto-generates last month's
 * payslip PDFs for every active employee of every employer. Supervisors can
 * also trigger this manually per-employer from the Payslips page at any time
 * (e.g. to backfill or regenerate).
 */
export function startPayslipCron() {
  cron.schedule("0 2 1 * *", async () => {
    console.log("[cron] Generating monthly payslips...");
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prev.getFullYear();
    const month = prev.getMonth() + 1;

    try {
      await generatePayslipsForAllEmployers(year, month);
      console.log(`[cron] Done generating payslips for ${year}-${month}.`);
    } catch (err) {
      console.error("[cron] Payslip generation failed:", err);
    }
  });
}
