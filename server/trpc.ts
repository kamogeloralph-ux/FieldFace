import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { readAdminSession, readEmployeeSession, type AdminSession, type EmployeeSession } from "./auth";

export function createContext({ req, res }: CreateExpressContextOptions) {
  const employee: EmployeeSession | null = readEmployeeSession(req);
  const admin: AdminSession | null = readAdminSession(req);
  return { req, res, employee, admin };
}

export type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a clocked-in employee session (mobile clocking app). */
export const employeeProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.employee) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in with your employee code and PIN." });
  }
  return next({ ctx: { ...ctx, employee: ctx.employee } });
});

/** Requires an admin/supervisor session (admin.html). Scoped to their employer. */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.admin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in as a supervisor." });
  }
  return next({ ctx: { ...ctx, admin: ctx.admin } });
});

/** Requires the 'owner' admin role (e.g. for managing other employers). */
export const ownerProcedure = adminProcedure.use(({ ctx, next }) => {
  if (ctx.admin.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can do this." });
  }
  return next({ ctx });
});
