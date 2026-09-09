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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(employers)
        .set(input)
        .where(eq(employers.id, ctx.admin.employerId))
        .returning();
      return updated;
    }),
});
