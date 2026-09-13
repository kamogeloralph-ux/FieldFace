import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { adminUsers, employees, employers, payslips, platformAdmins, sites } from "../../drizzle/schema";
import { publicProcedure, platformProcedure, router } from "../trpc";
import {
  clearPlatformSession,
  issueAdminSession,
  issuePlatformSession,
  verifySupabaseAccessToken,
} from "../auth";
import { TRPCError } from "@trpc/server";
import { writeAudit } from "../audit";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "../auth";

function companyCodePrefix(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (letters.slice(0, 5) || "CO").padEnd(2, "X");
}

function managerUsernamePrefix(name: string) {
  return `${name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X")}-MANAGER`;
}

async function nextManagerUsername(employerId: string, companyName: string) {
  const prefix = managerUsernamePrefix(companyName);
  const rows = await db.select({ username: adminUsers.username }).from(adminUsers).where(eq(adminUsers.employerId, employerId));
  const highest = rows.reduce((max, row) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(row.username ?? "");
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export const platformRouter = router({
  login: publicProcedure
    .input(z.object({ accessToken: z.string().min(1), rememberMe: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const user = await verifySupabaseAccessToken(input.accessToken);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session, please sign in again." });

      const [profile] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, user.id));
      if (!profile) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account isn't set up as a platform owner.",
        });
      }

      issuePlatformSession(ctx.res, { platformAdminId: profile.id }, input.rememberMe);
      return { id: profile.id, fullName: profile.fullName, email: profile.email };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearPlatformSession(ctx.res);
    return { success: true } as const;
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.platform) return null;
    const [profile] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, ctx.platform.platformAdminId));
    if (!profile) return null;
    return { id: profile.id, fullName: profile.fullName, email: profile.email };
  }),

  listCompanies: platformProcedure.query(async () => {
    const [rows, employeeCounts, siteCounts] = await Promise.all([
      db.select({ id: employers.id, name: employers.name, companyCode: employers.companyCode, contactEmail: employers.contactEmail, contactPhone: employers.contactPhone, address: employers.address, taxNumber: employers.taxNumber, companyRegNumber: employers.companyRegNumber, uifEnabled: employers.uifEnabled, uifEmployeeRate: employers.uifEmployeeRate, uifEmployerRate: employers.uifEmployerRate, createdAt: employers.createdAt }).from(employers).orderBy(employers.createdAt),
      db.select({ employerId: employees.employerId, count: sql<number>`count(*)` }).from(employees).groupBy(employees.employerId),
      db.select({ employerId: sites.employerId, count: sql<number>`count(*)` }).from(sites).groupBy(sites.employerId),
    ]);
    const employeesByEmployer = new Map(employeeCounts.map((row) => [row.employerId, Number(row.count)]));
    const sitesByEmployer = new Map(siteCounts.map((row) => [row.employerId, Number(row.count)]));
    return rows.map((row) => ({ ...row, employeeCount: employeesByEmployer.get(row.id) ?? 0, siteCount: sitesByEmployer.get(row.id) ?? 0 }));
  }),

  listCompanyManagers: platformProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select({ id: adminUsers.id, fullName: adminUsers.fullName, email: adminUsers.email, idNumber: adminUsers.idNumber, phone: adminUsers.phone, physicalAddress: adminUsers.physicalAddress, username: adminUsers.username, role: adminUsers.role, createdAt: adminUsers.createdAt })
        .from(adminUsers)
        .where(eq(adminUsers.employerId, input.employerId))
        .orderBy(adminUsers.createdAt)
        .limit(100);
    }),

  createCompany: platformProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(725491)`);
        const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(employers);
        const companyCode = `FF-${companyCodePrefix(input.name)}${String(Number(count) + 1).padStart(2, "0")}`;
        const [created] = await tx.insert(employers).values({ name: input.name, companyCode }).returning();
        return created;
      });
    }),

  createManager: platformProcedure
    .input(z.object({ employerId: z.string().uuid(), fullName: z.string().trim().min(1), email: z.string().trim().email(), idNumber: z.string().trim().min(1), phone: z.string().trim().min(1), physicalAddress: z.string().trim().min(1), role: z.enum(["owner", "supervisor"]).default("supervisor") }))
    .mutation(async ({ input }) => {
      const [employer] = await db.select({ id: employers.id, name: employers.name }).from(employers).where(eq(employers.id, input.employerId));
      if (!employer) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });
      const activationCode = randomBytes(5).toString("hex").toUpperCase();
      const activationCodeHash = await hashPassword(activationCode);
      const [created] = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`manager-username:${input.employerId}`}))`);
        const username = await nextManagerUsername(input.employerId, employer.name);
        return tx.insert(adminUsers).values({ id: randomUUID(), employerId: input.employerId, fullName: input.fullName, email: input.email, idNumber: input.idNumber, phone: input.phone, physicalAddress: input.physicalAddress, username, passwordHash: null, activationCodeHash, activationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), role: input.role }).returning({ id: adminUsers.id, fullName: adminUsers.fullName, email: adminUsers.email, idNumber: adminUsers.idNumber, phone: adminUsers.phone, physicalAddress: adminUsers.physicalAddress, username: adminUsers.username, role: adminUsers.role });
      });
      return { ...created, activationCode };
    }),

  updateCompany: platformProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      contactEmail: z.string().email().optional().or(z.literal("")),
      contactPhone: z.string().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
      companyRegNumber: z.string().optional(),
      uifEnabled: z.boolean().optional(),
      uifEmployeeRate: z.number().min(0).max(100).optional(),
      uifEmployerRate: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, uifEmployeeRate, uifEmployerRate, ...rest } = input;
      const values: Record<string, unknown> = { ...rest };
      if (typeof uifEmployeeRate === "number") values.uifEmployeeRate = uifEmployeeRate.toString();
      if (typeof uifEmployerRate === "number") values.uifEmployerRate = uifEmployerRate.toString();
      const [updated] = await db.update(employers).set(values).where(eq(employers.id, id)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });
      await writeAudit({ actorType: "platform_admin", actorId: ctx.platform.platformAdminId, employerId: id, action: "company.updated", entityType: "employer", entityId: id, metadata: { fields: Object.keys(values) } });
      return updated;
    }),

  mergeCompanyData: platformProcedure
    .input(z.object({ targetEmployerId: z.string().uuid(), sourceEmployerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetEmployerId === input.sourceEmployerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose two different companies." });
      return db.transaction(async (tx) => {
        const [target] = await tx.select().from(employers).where(eq(employers.id, input.targetEmployerId));
        const [source] = await tx.select().from(employers).where(eq(employers.id, input.sourceEmployerId));
        if (!target || !source) throw new TRPCError({ code: "NOT_FOUND", message: "Company record not found." });
        await tx.update(sites).set({ employerId: target.id }).where(eq(sites.employerId, source.id));
        await tx.update(employees).set({ employerId: target.id }).where(eq(employees.employerId, source.id));
        await tx.update(payslips).set({ employerId: target.id }).where(eq(payslips.employerId, source.id));
        await tx.update(adminUsers).set({ employerId: target.id }).where(eq(adminUsers.employerId, source.id));
        await writeAudit({ actorType: "platform_admin", actorId: ctx.platform.platformAdminId, employerId: target.id, action: "company.data_merged", entityType: "employer", entityId: target.id, metadata: { sourceEmployerId: source.id } });
        return { success: true as const };
      });
    }),

  adoptUnlinkedData: platformProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await db.select({ id: employers.id }).from(employers).where(eq(employers.id, input.employerId));
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Company record not found." });
      await db.transaction(async (tx) => {
        await tx.execute(sql`update ${sites} set employer_id = ${input.employerId} where not exists (select 1 from ${employers} owner where owner.id = ${sites}.employer_id)`);
        await tx.execute(sql`update ${employees} set employer_id = ${input.employerId} where not exists (select 1 from ${employers} owner where owner.id = ${employees}.employer_id)`);
        await tx.execute(sql`update ${payslips} set employer_id = ${input.employerId} where not exists (select 1 from ${employers} owner where owner.id = ${payslips}.employer_id)`);
      });
      await writeAudit({ actorType: "platform_admin", actorId: ctx.platform.platformAdminId, employerId: input.employerId, action: "company.orphan_data_adopted", entityType: "employer", entityId: input.employerId });
      return { success: true as const };
    }),

  listCompanyEmployees: platformProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(employees).where(eq(employees.employerId, input.employerId));
      return rows.map(({ passwordHash, ...employee }) => employee);
    }),

  deleteCompany: platformProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(employers).where(eq(employers.id, input.id));
      return { success: true } as const;
    }),

  /**
   * Steps the platform owner into a company's own admin dashboard, as if they
   * were its owner, to fix data that doesn't look right. Requires the platform
   * owner to already have (or be given) an admin_users row for that company.
   */
  impersonateCompany: platformProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [employer] = await db.select().from(employers).where(eq(employers.id, input.employerId));
      if (!employer) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });

      issueAdminSession(ctx.res, {
        adminUserId: ctx.platform.platformAdminId,
        employerId: input.employerId,
        role: "owner",
        isPlatformAdmin: true,
      });

      return { success: true } as const;
    }),
});
