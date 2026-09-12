import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { generatePayslipsForAllEmployers } from "./payslipGeneration";

export function startPayslipCron() {
  cron.schedule("0 2 1 * *", async () => {
    const [{ locked }] = await db.execute<{ locked: boolean }>(sql`select pg_try_advisory_lock(hashtext('fieldface-payslip-cron'))`);
    if (!locked) {
      console.log(JSON.stringify({ event: "payslip_cron_skipped", reason: "another_instance_holds_lock" }));
      return;
    }
    try {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prev.getFullYear();
      const month = prev.getMonth() + 1;
      console.log(JSON.stringify({ event: "payslip_cron_started", year, month }));
      await generatePayslipsForAllEmployers(year, month);
      console.log(JSON.stringify({ event: "payslip_cron_completed", year, month }));
    } catch (err) {
      console.error(JSON.stringify({ event: "payslip_cron_failed", error: err instanceof Error ? err.message : "unknown" }));
    } finally {
      await db.execute(sql`select pg_advisory_unlock(hashtext('fieldface-payslip-cron'))`);
    }
  }, { timezone: "Africa/Johannesburg" });
}
