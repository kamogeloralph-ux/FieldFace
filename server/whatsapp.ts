import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

function requireConfig() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are not set. Copy the WhatsApp section of .env.example into .env.",
    );
  }
}

/** Digits-only phone identifier the way Meta sends/expects it (no "+", no spaces). */
export function normalizeWaNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

async function callGraph(path: string, body: unknown) {
  requireConfig();
  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`WhatsApp API error (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function sendWhatsappText(to: string, body: string) {
  return callGraph(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

/**
 * Sends the native "Send location" prompt button. Falls back to a plain text
 * instruction if the interactive message type is rejected (some WABA tiers /
 * older API versions don't support location_request_message).
 */
export async function sendWhatsappLocationRequest(to: string, body: string) {
  try {
    return await callGraph(`${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: { text: body },
        action: { name: "send_location" },
      },
    });
  } catch {
    return sendWhatsappText(
      to,
      `${body}\n\n(Tap the paperclip/+ icon → Location → Send your current location.)`,
    );
  }
}

/** Two-step download: resolve the media ID to a temporary URL, then fetch the bytes. */
export async function downloadWhatsappMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  requireConfig();
  const metaResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!metaResponse.ok) throw new Error(`Could not resolve WhatsApp media ${mediaId}`);
  const meta = (await metaResponse.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error(`WhatsApp media ${mediaId} has no download URL`);

  const fileResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!fileResponse.ok) throw new Error(`Could not download WhatsApp media ${mediaId}`);
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  return { buffer, mimeType: meta.mime_type || "image/jpeg" };
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyWhatsappSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!APP_SECRET) {
    // Fail closed: without an app secret configured we cannot verify authenticity,
    // so refuse to treat the payload as trusted rather than silently accepting it.
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
