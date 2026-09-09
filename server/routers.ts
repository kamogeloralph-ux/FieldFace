import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { employersRouter } from "./routers/employers";
import { sitesRouter } from "./routers/sites";
import { employeesRouter } from "./routers/employees";
import { timeEntriesRouter } from "./routers/timeEntries";
import { reportsRouter } from "./routers/reports";
import { payslipsRouter } from "./routers/payslips";

export const appRouter = router({
  auth: authRouter,
  employers: employersRouter,
  sites: sitesRouter,
  employees: employeesRouter,
  timeEntries: timeEntriesRouter,
  reports: reportsRouter,
  payslips: payslipsRouter,
});

export type AppRouter = typeof appRouter;
