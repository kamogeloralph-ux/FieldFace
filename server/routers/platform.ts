import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { adminUsers, employees, employers, platformAdmins, sites } from "../../drizzle/schema";
import { publicProcedure, platformProcedure, router } from "../trpc";
import {
  clearPlatformSession,
  issueAdminSession,
  issuePlatformSession,
  verifySupabaseAccessToken,
} from "../auth";
import { TRPCError } from "@trpc/server";

export const platformRouter = router({
  login: publicProcedure
    .input(z.object({ accessToken: z.string().min(1) }))
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

      issuePlatformSession(ctx.res, { platformAdminId: profile.id });
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
    const rows = await db
      .select({
        id: employers.id,
        name: employers.name,
        contactEmail: employers.contactEmail,
        contactPhone: employers.contactPhone,
        address: employers.address,
        taxNumber: employers.taxNumber,
        companyRegNumber: employers.companyRegNumber,
        uifEnabled: employers.uifEnabled,
        uifEmployeeRate: employers.uifEmployeeRate,
        uifEmployerRate: employers.uifEmployerRate,
        createdAt: employers.createdAt,
        employeeCount: sql<number>`(select count(*) from ${employees} where ${employees.employerId} = ${employers.id})`,
        siteCount: sql<number>`(select count(*) from ${sites} where ${sites.employerId} = ${employers.id})`,
      })
      .from(employers)
      .orderBy(employers.createdAt);
    return rows;
  }),

  createCompany: platformProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const [created] = await db.insert(employers).values({ name: input.name }).returning();
      return created;
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
    .mutation(async ({ input }) => {
      const { id, uifEmployeeRate, uifEmployerRate, ...rest } = input;
      const values: Record<string, unknown> = { ...rest };
      if (typeof uifEmployeeRate === "number") values.uifEmployeeRate = uifEmployeeRate.toString();
      if (typeof uifEmployerRate === "number") values.uifEmployerRate = uifEmployerRate.toString();
      const [updated] = await db.update(employers).set(values).where(eq(employers.id, id)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found." });
      return updated;
    }),

  listCompanyEmployees: platformProcedure
    .input(z.object({ employerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db.select().from(employees).where(eq(employees.employerId, input.employerId));
      return rows.map(({ pinHash, ...employee }) => employee);
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

      let [profile] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, ctx.platform.platformAdminId));

      // Platform owners don't necessarily have a per-company admin row yet;
      // create one scoped to this company so they can manage it directly.
      if (!profile || profile.employerId !== input.employerId) {
        const [platformProfile] = await db
          .select()
          .from(platformAdmins)
          .where(eq(platformAdmins.id, ctx.platform.platformAdminId));

        [profile] = await db
          .insert(adminUsers)
          .values({
            id: ctx.platform.platformAdminId,
            employerId: input.employerId,
            fullName: platformProfile?.fullName ?? "Platform owner",
            email: platformProfile?.email ?? "",
            role: "owner",
          })
          .onConflictDoUpdate({
            target: adminUsers.id,
            set: { employerId: input.employerId, role: "owner" },
          })
          .returning();
      }

      issueAdminSession(ctx.res, {
        adminUserId: profile.id,
        employerId: input.employerId,
        role: "owner",
      });

      return { success: true } as const;
    }),
});
