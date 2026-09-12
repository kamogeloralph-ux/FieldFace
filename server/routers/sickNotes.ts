import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { employees, sickNotes } from "../../drizzle/schema";
import { adminProcedure, employeeProcedure, router } from "../trpc";
import { signedUrl, uploadSickNote } from "../storage";
import { writeAudit } from "../audit";

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").optional();

export const sickNotesRouter = router({
  mine: employeeProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(sickNotes).where(eq(sickNotes.employeeId, ctx.employee.employeeId)).orderBy(desc(sickNotes.createdAt));
    return Promise.all(rows.map(async (note) => ({ ...note, url: await signedUrl("sick-notes", note.filePath, 900) })));
  }),

  submit: employeeProcedure
    .input(z.object({ dataUrl: z.string().min(1), fileName: z.string().min(1).max(200), noteDate: dateInput, employeeComment: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const uploaded = await uploadSickNote(ctx.employee.employeeId, input.dataUrl, input.fileName);
      const [created] = await db.insert(sickNotes).values({ employerId: ctx.employee.employerId, employeeId: ctx.employee.employeeId, filePath: uploaded.path, fileName: input.fileName, contentType: uploaded.contentType, noteDate: input.noteDate, employeeComment: input.employeeComment || null }).returning();
      await writeAudit({ actorType: "employee", actorId: ctx.employee.employeeId, employerId: ctx.employee.employerId, action: "sick_note.submitted", entityType: "sick_note", entityId: created.id, metadata: { fileName: input.fileName, noteDate: input.noteDate ?? null } });
      return created;
    }),

  listForManagement: adminProcedure.query(async ({ ctx }) => {
    const rows = await db.select({ id: sickNotes.id, employeeId: sickNotes.employeeId, employeeName: employees.fullName, employeeCode: employees.employeeCode, fileName: sickNotes.fileName, contentType: sickNotes.contentType, noteDate: sickNotes.noteDate, employeeComment: sickNotes.employeeComment, status: sickNotes.status, managerNote: sickNotes.managerNote, reviewedAt: sickNotes.reviewedAt, createdAt: sickNotes.createdAt, filePath: sickNotes.filePath }).from(sickNotes).innerJoin(employees, eq(employees.id, sickNotes.employeeId)).where(eq(sickNotes.employerId, ctx.admin.employerId)).orderBy(desc(sickNotes.createdAt));
    return Promise.all(rows.map(async ({ filePath, ...note }) => ({ ...note, url: await signedUrl("sick-notes", filePath, 900) })));
  }),

  review: adminProcedure
    .input(z.object({ id: z.string().uuid(), managerNote: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(sickNotes).set({ status: "reviewed", managerNote: input.managerNote || null, reviewedBy: ctx.admin.adminUserId, reviewedAt: new Date() }).where(and(eq(sickNotes.id, input.id), eq(sickNotes.employerId, ctx.admin.employerId))).returning();
      if (!updated) throw new Error("Sick note not found for this company.");
      await writeAudit({ actorType: "admin", actorId: ctx.admin.adminUserId, employerId: ctx.admin.employerId, action: "sick_note.reviewed", entityType: "sick_note", entityId: updated.id, metadata: { managerNote: input.managerNote ?? null } });
      return updated;
    }),
});
