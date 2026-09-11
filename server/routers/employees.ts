import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { employees } from "../../drizzle/schema";
import { adminProcedure, platformProcedure, router } from "../trpc";
import { hashPin } from "../auth";
import { TRPCError } from "@trpc/server";

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

export const employeesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(employees).where(eq(employees.employerId, ctx.admin.employerId));
    return rows.map(sanitize);
  }),

  create: adminProcedure
    .input(
      z.object({
        ...employeeBase,
        employeeCode: z.string().min(1),
        pin: z.string().min(4).max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db
        .select()
        .from(employees)
        .where(and(eq(employees.employerId, ctx.admin.employerId), eq(employees.employeeCode, input.employeeCode)));
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "That employee code is already in use." });
      }

      const pinHash = await hashPin(input.pin);
      const [created] = await db
        .insert(employees)
        .values({
          employerId: ctx.admin.employerId,
          siteId: input.siteId ?? null,
          employeeCode: input.employeeCode,
          fullName: input.fullName,
        taxNumber: input.taxNumber,
          physicalAddress: input.physicalAddress,
          phone: input.phone,
          email: input.email || undefined,
          pinHash,
          hourlyRateWeekday: input.hourlyRateWeekday.toString(),
          hourlyRateWeekend: input.hourlyRateWeekend.toString(),
        })
        .returning();
      return sanitize(created);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        employeeCode: z.string().min(1).optional(),
        fullName: z.string().min(1).optional(),
        taxNumber: z.string().optional(),
        physicalAddress: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        siteId: z.string().uuid().optional().nullable(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [existing] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), eq(employees.employerId, ctx.admin.employerId)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      if (rest.employeeCode && rest.employeeCode !== existing.employeeCode) {
        const clash = await db
          .select()
          .from(employees)
          .where(and(eq(employees.employerId, ctx.admin.employerId), eq(employees.employeeCode, rest.employeeCode)));
        if (clash.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "That employee number is already in use." });
        }
      }

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
    .mutation(async ({ input }) => {
      const [updated] = await db.update(employees)
        .set({
          hourlyRateWeekday: input.hourlyRateWeekday.toString(),
          hourlyRateWeekend: input.hourlyRateWeekend.toString(),
        })
        .where(eq(employees.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
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
