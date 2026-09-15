import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { employees, employers, shifts, sites, timeEntries, whatsappPendingClocks } from "../drizzle/schema";
import { isWithinGeofence } from "./geofence";
import { hoursBetween, isWeekendDate } from "./payroll";
import { localDate } from "./timezone";
import { uploadSelfieBuffer } from "./storage";
import { downloadWhatsappMedia, normalizeWaNumber, sendWhatsappLocationRequest, sendWhatsappText } from "./whatsapp";

const PENDING_SELFIE_TIMEOUT_MS = 15 * 60 * 1000; // how long a selfie waits for its location pin

// Lightweight webhook-retry guard. Meta redelivers a webhook if we don't
// respond 200 quickly enough; this keeps a short memory of message IDs
// already handled so a redelivery is a no-op instead of double-processing.
// In-memory only (resets on restart) — acceptable since Meta's retries are
// clustered within minutes of the original delivery, and the underlying
// clock-in logic is itself safe to re-run (see finalize()'s row deletion).
const seenMessageIds = new Map<string, number>();
function alreadyHandled(messageId: string | undefined): boolean {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, seenAt] of seenMessageIds) if (now - seenAt > 30 * 60 * 1000) seenMessageIds.delete(id);
  if (seenMessageIds.has(messageId)) return true;
  seenMessageIds.set(messageId, now);
  return false;
}

type WhatsappMessage = {
  id?: string;
  from: string;
  type: string;
  image?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; accuracy?: number };
};

async function replyGenericHelp(to: string) {
  await sendWhatsappText(
    to,
    "To clock in or out: send a selfie photo first, then share your current location when asked.",
  );
}

async function findEmployeeByWaNumber(waNumber: string) {
  const [employee] = await db.select().from(employees).where(eq(employees.whatsappNumber, waNumber));
  return employee ?? null;
}

async function handleSelfie(message: WhatsappMessage, waNumber: string, employeeId: string) {
  if (!message.image) return;
  const { buffer, mimeType } = await downloadWhatsappMedia(message.image.id);
  const contentType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  let selfiePath: string;
  try {
    selfiePath = await uploadSelfieBuffer(employeeId, buffer, contentType);
  } catch {
    await sendWhatsappText(waNumber, "That image couldn't be used — please resend as a normal photo (not a document or sticker).");
    return;
  }

  await db
    .insert(whatsappPendingClocks)
    .values({ phoneNumber: waNumber, employeeId, selfiePath, waMessageId: message.id, capturedAt: new Date() })
    .onConflictDoUpdate({
      target: whatsappPendingClocks.phoneNumber,
      set: { employeeId, selfiePath, waMessageId: message.id, capturedAt: new Date() },
    });

  await sendWhatsappLocationRequest(waNumber, "Selfie received. Now share your current location to complete your clock in/out.");
}

async function finalize(
  pending: typeof whatsappPendingClocks.$inferSelect,
  latitude: number,
  longitude: number,
  gpsAccuracyMeters: number | undefined,
): Promise<
  | { error: string }
  | { entry: typeof timeEntries.$inferSelect; site: typeof sites.$inferSelect; distance: number; withinGeofence: boolean }
> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${pending.employeeId}))`);

    const [employee] = await tx.select().from(employees).where(eq(employees.id, pending.employeeId));
    if (!employee || !employee.active) return { error: "Your account is inactive — contact your supervisor." };
    if (!employee.siteId) return { error: "No worksite assigned yet — ask your supervisor to assign one before clocking in." };
    const [site] = await tx.select().from(sites).where(eq(sites.id, employee.siteId));
    if (!site) return { error: "Your assigned worksite could not be found." };
    if (!site.active) return { error: "Your assigned worksite is inactive — ask management to activate it before clocking in or out." };
    const [employer] = await tx.select({ timezone: employers.timezone }).from(employers).where(eq(employers.id, employee.employerId));

    const [lastEntry] = await tx.select().from(timeEntries).where(eq(timeEntries.employeeId, employee.id)).orderBy(desc(timeEntries.occurredAt)).limit(1);
    const entryType: "clock_in" | "clock_out" = !lastEntry || lastEntry.entryType === "clock_out" ? "clock_in" : "clock_out";

    const { distance, withinGeofence } = isWithinGeofence(latitude, longitude, site.latitude, site.longitude, site.radiusMeters);

    const [entry] = await tx
      .insert(timeEntries)
      .values({
        employeeId: employee.id,
        siteId: site.id,
        entryType,
        source: "whatsapp",
        selfieUrl: pending.selfiePath,
        latitude,
        longitude,
        distanceMeters: distance,
        withinGeofence,
        gpsAccuracyMeters,
        capturedAt: pending.capturedAt,
      })
      .returning();

    if (entryType === "clock_out" && lastEntry && lastEntry.entryType === "clock_in") {
      const hours = hoursBetween(lastEntry.occurredAt, entry.occurredAt);
      await tx.insert(shifts).values({
        employeeId: employee.id,
        siteId: site.id,
        clockInEntryId: lastEntry.id,
        clockOutEntryId: entry.id,
        clockInAt: lastEntry.occurredAt,
        clockOutAt: entry.occurredAt,
        shiftDate: localDate(lastEntry.occurredAt, employer?.timezone ?? "Africa/Johannesburg"),
        hours: hours.toString(),
        isWeekend: isWeekendDate(lastEntry.occurredAt),
        bothWithinGeofence: lastEntry.withinGeofence && entry.withinGeofence,
      });
    }

    await tx.delete(whatsappPendingClocks).where(eq(whatsappPendingClocks.id, pending.id));

    return { entry, site, distance, withinGeofence } as const;
  });
}

async function handleLocation(message: WhatsappMessage, waNumber: string, employeeId: string) {
  if (!message.location) return;

  const [pending] = await db
    .select()
    .from(whatsappPendingClocks)
    .where(and(eq(whatsappPendingClocks.phoneNumber, waNumber), eq(whatsappPendingClocks.employeeId, employeeId)));

  if (!pending) {
    await sendWhatsappText(waNumber, "Please send your selfie first, then share your location.");
    return;
  }
  if (Date.now() - new Date(pending.capturedAt).getTime() > PENDING_SELFIE_TIMEOUT_MS) {
    await db.delete(whatsappPendingClocks).where(eq(whatsappPendingClocks.id, pending.id));
    await sendWhatsappText(waNumber, "That selfie has expired — please send a new selfie, then share your location again.");
    return;
  }

  const result = await finalize(pending, message.location.latitude, message.location.longitude, message.location.accuracy);
  if ("error" in result) {
    await sendWhatsappText(waNumber, result.error);
    return;
  }

  const { entry, site, distance, withinGeofence } = result;
  const timeLabel = new Date(entry.occurredAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  const action = entry.entryType === "clock_in" ? "Clocked in" : "Clocked out";
  const geofenceLine = withinGeofence
    ? `You're within the ${site.name} area.`
    : `⚠️ You're about ${Math.round(distance)}m from ${site.name} — this has been flagged for your supervisor.`;
  await sendWhatsappText(waNumber, `✅ ${action} at ${timeLabel}.\n${geofenceLine}`);
}

/** Entry point called from the webhook route for each message in the payload. */
export async function handleIncomingWhatsappMessage(rawMessage: WhatsappMessage) {
  if (alreadyHandled(rawMessage.id)) return;

  const waNumber = normalizeWaNumber(rawMessage.from);
  const employee = await findEmployeeByWaNumber(waNumber);
  if (!employee) {
    await sendWhatsappText(
      waNumber,
      "This WhatsApp number isn't linked to a FieldFace account yet. Ask your supervisor to add it to your employee profile.",
    );
    return;
  }
  if (!employee.active) {
    await sendWhatsappText(waNumber, "Your account is inactive — contact your supervisor.");
    return;
  }

  if (rawMessage.type === "image") {
    await handleSelfie(rawMessage, waNumber, employee.id);
  } else if (rawMessage.type === "location") {
    await handleLocation(rawMessage, waNumber, employee.id);
  } else {
    await replyGenericHelp(waNumber);
  }
}
