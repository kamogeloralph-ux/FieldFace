import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { adminUsers, employees, employers, platformAdmins } from "../../drizzle/schema";
import { publicProcedure, router } from "../trpc";
import {
  clearAdminSession,
  clearEmployeeSession,
  issueAdminSession,
  issueEmployeeSessionWithPreference,
  verifyPin,
  verifySupabaseAccessToken,
} from "../auth";
import { TRPCError } from "@trpc/server";

const loginFailures = new Map<string, { count: number; firstAt: number }>();
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function loginKey(ip: string | undefined, employeeCode: string) {
  return `${ip ?? "unknown"}:${employeeCode.trim().toLowerCase()}`;
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const current = loginFailures.get(key);
  if (!current || now - current.firstAt > FAILURE_WINDOW_MS) loginFailures.set(key, { count: 1, firstAt: now });
  else loginFailures.set(key, { ...current, count: current.count + 1 });
}

function isLoginBlocked(key: string) {
  const current = loginFailures.get(key);
  if (!current) return false;
  if (Date.now() - current.firstAt > FAILURE_WINDOW_MS) {
    loginFailures.delete(key);
    return false;
  }
  return current.count >= MAX_FAILURES;
}

export const authRouter = router({
  // --- Employee (mobile clocking app) ---
  employeeLogin: publicProcedure
    .input(z.object({ employeeCode: z.string().min(1), pin: z.string().min(4).max(8), rememberMe: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const failureKey = loginKey(ctx.req.ip, input.employeeCode);
      if (isLoginBlocked(failureKey)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Try again in 15 minutes." });
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.employeeCode, input.employeeCode.trim()), eq(employees.active, true)));

      if (!employee) {
        recordLoginFailure(failureKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Employee number or PIN is incorrect." });
      }

      const pinOk = await verifyPin(input.pin, employee.pinHash);
      if (!pinOk) {
        recordLoginFailure(failureKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Employee number or PIN is incorrect." });
      }
      loginFailures.delete(failureKey);

      issueEmployeeSessionWithPreference(ctx.res, {
        employeeId: employee.id,
        employerId: employee.employerId,
        siteId: employee.siteId,
      }, input.rememberMe);

      return {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        siteId: employee.siteId,
      };
    }),

  employeeLogout: publicProcedure.mutation(({ ctx }) => {
    clearEmployeeSession(ctx.res);
    return { success: true } as const;
  }),

  employeeMe: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.employee) return null;
    const [employee] = await db.select().from(employees).where(eq(employees.id, ctx.employee.employeeId));
    if (!employee || !employee.active) return null;
    return {
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      siteId: employee.siteId,
    };
  }),

  // --- Admin / supervisor (admin.html) ---
  adminLogin: publicProcedure
    .input(z.object({ accessToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await verifySupabaseAccessToken(input.accessToken);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session, please sign in again." });

      const [profile] = await db.select().from(adminUsers).where(eq(adminUsers.id, user.id));
      if (!profile) {
        const [platformProfile] = await db.select({ id: platformAdmins.id }).from(platformAdmins).where(eq(platformAdmins.id, user.id));
        if (platformProfile) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This is a platform-owner account. Sign in through the Owner Platform portal at /admin.html, not the company management portal.",
          });
        }
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account isn't set up as a supervisor. Ask the platform owner to add you.",
        });
      }

      issueAdminSession(ctx.res, {
        adminUserId: profile.id,
        employerId: profile.employerId,
        role: profile.role as "owner" | "supervisor",
      });

      const [employer] = await db.select().from(employers).where(eq(employers.id, profile.employerId));

      return {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        role: profile.role,
        employer: employer ? { id: employer.id, name: employer.name } : null,
      };
    }),

  adminLogout: publicProcedure.mutation(({ ctx }) => {
    clearAdminSession(ctx.res);
    return { success: true } as const;
  }),

  adminMe: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.admin) return null;
    const [profile] = await db.select().from(adminUsers).where(eq(adminUsers.id, ctx.admin.adminUserId));
    if (!profile && ctx.platform?.platformAdminId === ctx.admin.adminUserId) {
      const [platformProfile] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, ctx.platform.platformAdminId));
      const [employer] = await db.select().from(employers).where(eq(employers.id, ctx.admin.employerId));
      if (!platformProfile || !employer) return null;
      return {
        id: platformProfile.id,
        fullName: platformProfile.fullName,
        email: platformProfile.email,
        role: "owner" as const,
        employer: { id: employer.id, name: employer.name },
        isPlatformAdmin: true,
      };
    }
    if (!profile) return null;
    const [employer] = await db.select().from(employers).where(eq(employers.id, profile.employerId));
    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      role: profile.role,
      employer: employer ? { id: employer.id, name: employer.name } : null,
      isPlatformAdmin: false,
    };
  }),
});
