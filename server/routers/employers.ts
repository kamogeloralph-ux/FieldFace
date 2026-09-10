import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { employers } from "../../drizzle/schema";
import { adminProcedure, router } from "../trpc";

export const employersRouter = router({
  getMine: adminProcedure.query(async ({ ctx }) => {
    const [employer] = await db.select().from(employers).where(eq(employers.id, ctx.admin.employerId));
    return employer ?? null;
  }),

  updateMine: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        taxNumber: z.string().optional(),
        companyRegNumber: z.string().optional(),
        uifEnabled: z.boolean().optional(),
        uifEmployeeRate: z.number().min(0).max(100).optional(),
        uifEmployerRate: z.number().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { uifEmployeeRate, uifEmployerRate, ...rest } = input;
      const values: Record<string, unknown> = { ...rest };
      if (typeof uifEmployeeRate === "number") values.uifEmployeeRate = uifEmployeeRate.toString();
      if (typeof uifEmployerRate === "number") values.uifEmployerRate = uifEmployerRate.toString();

      const [updated] = await db
        .update(employers)
        .set(values)
        .where(eq(employers.id, ctx.admin.employerId))
        .returning();
      return updated;
    }),
});
