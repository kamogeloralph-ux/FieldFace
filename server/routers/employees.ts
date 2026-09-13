import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { employees, employers } from "../../drizzle/schema";
import { adminProcedure, platformProcedure, router } from "../trpc";
import { hashPin } from "../auth";
import { TRPCError } from "@trpc/server";
import { writeAudit } from "../audit";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../auth";

const employeeBase = {
  fullName: z.string().min(1),
  taxNumber: z.string().min(1),
  physicalAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  hourlyRateWeekday: z.number().min(0),
  hourlyRateWeekend: z.number().min(0),
  siteId: z.string().uuid().optional().nullable(),
};

function sanitize(e: typeof employees.$inferSelect) {
  const { pinHash, ...rest } = e;
  return rest;
}

async function nextEmployeeCode(employerId: string) {
  const [employer] = await db.select({ name: employers.name }).from(employers).where(eq(employers.id, employerId));
  const prefix = (employer?.name ?? "CO").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const rows = await db.select({ employeeCode: employees.employeeCode }).from(employees).where(eq(employees.employerId, employerId));
  const highest = rows.reduce((max, row) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(row.employeeCode);
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export const employeesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(employees).where(eq(employees.employerId, ctx.admin.employerId));
    return rows.map(sanitize);
  }),

  create: adminProcedure
    .input(
      z.object({
        ...employeeBase,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activationCode = randomBytes(5).toString("hex").toUpperCase();
      const activationCodeHash = await hashPassword(activationCode);
      const [created] = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`employee-number:${ctx.admin.employerId}`}))`);
        const employeeCode = await nextEmployeeCode(ctx.admin.employerId);
        return tx
        .insert(employees)
        .values({
          employerId: ctx.admin.employerId,
          siteId: input.siteId ?? null,
          employeeCode,
          fullName: input.fullName,
        taxNumber: input.taxNumber,
          physicalAddress: input.physicalAddress,
          phone: input.phone,
          email: input.email || undefined,
          pinHash: null,
          activationCodeHash,
          activationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          hourlyRateWeekday: input.hourlyRateWeekday.toString(),
          hourlyRateWeekend: input.hourlyRateWeekend.toString(),
        })
        .returning();
      });
      return { ...sanitize(created), activationCode };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        fullName: z.string().min(1).optional(),
        taxNumber: z.string().optional(),
        physicalAddress: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        siteId: z.string().uuid().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [existing] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), eq(employees.employerId, ctx.admin.employerId)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const values: Record<string, unknown> = { ...rest };
      if (typeof values.hourlyRateWeekday === "number") values.hourlyRateWeekday = String(values.hourlyRateWeekday);
      if (typeof values.hourlyRateWeekend === "number") values.hourlyRateWeekend = String(values.hourlyRateWeekend);

      const [updated] = await db.update(employees).set(values).where(eq(employees.id, id)).returning();
      return sanitize(updated);
    }),

  updateRates: platformProcedure
    .input(z.object({
      id: z.string().uuid(),
      hourlyRateWeekday: z.number().min(0),
      hourlyRateWeekend: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(employees)
        .set({
          hourlyRateWeekday: input.hourlyRateWeekday.toString(),
          hourlyRateWeekend: input.hourlyRateWeekend.toString(),
        })
        .where(eq(employees.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await writeAudit({ actorType: "platform_admin", actorId: ctx.platform.platformAdminId, employerId: updated.employerId, action: "employee.rates_updated", entityType: "employee", entityId: updated.id });
      return sanitize(updated);
    }),

  updateActive: platformProcedure
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(employees).set({ active: input.active }).where(eq(employees.id, input.id)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await writeAudit({ actorType: "platform_admin", actorId: ctx.platform.platformAdminId, employerId: updated.employerId, action: input.active ? "employee.activated" : "employee.deactivated", entityType: "employee", entityId: updated.id });
      return sanitize(updated);
    }),

  resetPin: adminProcedure
    .input(z.object({ id: z.string().uuid(), newPin: z.string().min(4).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, input.id), eq(employees.employerId, ctx.admin.employerId)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const pinHash = await hashPin(input.newPin);
      await db.update(employees).set({ pinHash }).where(eq(employees.id, input.id));
      return { success: true } as const;
    }),
});
