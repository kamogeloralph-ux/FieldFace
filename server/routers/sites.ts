import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { sites } from "../../drizzle/schema";
import { adminProcedure, router } from "../trpc";
import { uploadSitePhoto, signedUrl } from "../storage";
import { TRPCError } from "@trpc/server";

async function withPhotoUrl(site: typeof sites.$inferSelect) {
  if (!site.referencePhotoUrl) return { ...site, referencePhotoUrl: null as string | null };
  try {
    const url = await signedUrl("site-photos", site.referencePhotoUrl, 3600);
    return { ...site, referencePhotoUrl: url };
  } catch {
    return { ...site, referencePhotoUrl: null };
  }
}

export const sitesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(sites).where(eq(sites.employerId, ctx.admin.employerId));
    return Promise.all(rows.map(withPhotoUrl));
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusMeters: z.number().int().min(10).max(2000).default(150),
        referencePhotoBase64: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [site] = await db
        .insert(sites)
        .values({
          employerId: ctx.admin.employerId,
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          radiusMeters: input.radiusMeters,
        })
        .returning();

      if (input.referencePhotoBase64) {
        const path = await uploadSitePhoto(site.id, input.referencePhotoBase64);
        const [updated] = await db.update(sites).set({ referencePhotoUrl: path }).where(eq(sites.id, site.id)).returning();
        return withPhotoUrl(updated);
      }
      return withPhotoUrl(site);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        radiusMeters: z.number().int().min(10).max(2000).optional(),
        referencePhotoBase64: z.string().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(sites)
        .where(and(eq(sites.id, input.id), eq(sites.employerId, ctx.admin.employerId)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      let referencePhotoUrl = existing.referencePhotoUrl;
      if (input.referencePhotoBase64) {
        referencePhotoUrl = await uploadSitePhoto(existing.id, input.referencePhotoBase64);
      }

      const { referencePhotoBase64, id, ...rest } = input;
      const [updated] = await db
        .update(sites)
        .set({ ...rest, referencePhotoUrl })
        .where(eq(sites.id, input.id))
        .returning();
      return withPhotoUrl(updated);
    }),
});
