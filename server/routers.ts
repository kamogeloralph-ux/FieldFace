import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { employersRouter } from "./routers/employers";
import { sitesRouter } from "./routers/sites";
import { employeesRouter } from "./routers/employees";
import { timeEntriesRouter } from "./routers/timeEntries";
import { reportsRouter } from "./routers/reports";
import { payslipsRouter } from "./routers/payslips";
import { platformRouter } from "./routers/platform";
import { leaveRequestsRouter } from "./routers/leaveRequests";
import { sickNotesRouter } from "./routers/sickNotes";

export const appRouter = router({
  auth: authRouter,
  platform: platformRouter,
  employers: employersRouter,
  sites: sitesRouter,
  employees: employeesRouter,
  timeEntries: timeEntriesRouter,
  reports: reportsRouter,
  payslips: payslipsRouter,
  leaveRequests: leaveRequestsRouter,
  sickNotes: sickNotesRouter,
});

export type AppRouter = typeof appRouter;
