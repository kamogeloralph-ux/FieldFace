import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy .env.example to .env.");
}

// Server-side only client. Uses the service role key, so this file must
// never be imported from client code.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** Decode a `data:image/jpeg;base64,....` string into a Buffer + content type. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

export async function uploadSelfie(employeeId: string, dataUrl: string): Promise<string> {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  const ext = contentType.split("/")[1] || "jpg";
  const path = `${employeeId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("selfies").upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Selfie upload failed: ${error.message}`);
  return path;
}

export async function uploadSitePhoto(siteId: string, dataUrl: string): Promise<string> {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  const ext = contentType.split("/")[1] || "jpg";
  const path = `${siteId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("site-photos").upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Site photo upload failed: ${error.message}`);
  return path;
}

export async function uploadPayslipPdf(
  employeeId: string,
  year: number,
  month: number,
  pdfBuffer: Buffer,
): Promise<string> {
  const path = `${employeeId}/${year}-${String(month).padStart(2, "0")}.pdf`;
  const { error } = await supabaseAdmin.storage.from("payslips").upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`Payslip upload failed: ${error.message}`);
  return path;
}

export async function signedUrl(bucket: "selfies" | "site-photos" | "payslips", path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Could not sign URL: ${error?.message}`);
  return data.signedUrl;
}
