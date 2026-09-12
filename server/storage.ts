import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy .env.example to .env.");
}

// Server-side only client. Used for auth (session/user lookups) and the
// database. File storage now lives in Cloudflare R2 — see below.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

if (!process.env.CF_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error(
    "CF_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are not set. Copy .env.example to .env.",
  );
}

// R2 is S3-compatible, so the standard AWS SDK talks to it directly —
// just point it at the account's R2 endpoint instead of AWS.
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKETS = {
  selfies: process.env.R2_BUCKET_SELFIES || "fieldface-selfies",
  "site-photos": process.env.R2_BUCKET_SITE_PHOTOS || "fieldface-site-photos",
  payslips: process.env.R2_BUCKET_PAYSLIPS || "fieldface-payslips",
  schedules: process.env.R2_BUCKET_SCHEDULES || "fieldface-schedules",
} as const;

/** Decode a `data:image/jpeg;base64,....` string into a Buffer + content type. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  const [, contentType, base64] = match;
  if (contentType !== "image/jpeg" && contentType !== "image/png") throw new Error("Only JPEG and PNG images are accepted.");
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

function validateImage(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > 6 * 1024 * 1024) throw new Error("Image must be between 1 byte and 6 MB.");
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png) throw new Error("Image content does not match its declared format.");
}

async function putObject(bucket: keyof typeof BUCKETS, path: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKETS[bucket],
      Key: path,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function deleteObject(bucket: keyof typeof BUCKETS, path: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKETS[bucket], Key: path }));
}

export async function uploadSelfie(employeeId: string, dataUrl: string): Promise<string> {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  validateImage(buffer);
  const ext = contentType.split("/")[1] || "jpg";
  const path = `${employeeId}/${Date.now()}.${ext}`;
  await putObject("selfies", path, buffer, contentType);
  return path;
}

export async function uploadSitePhoto(siteId: string, dataUrl: string): Promise<string> {
  const { buffer, contentType } = decodeDataUrl(dataUrl);
  validateImage(buffer);
  const ext = contentType.split("/")[1] || "jpg";
  const path = `${siteId}/${Date.now()}.${ext}`;
  await putObject("site-photos", path, buffer, contentType);
  return path;
}

export function decodeScheduleDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Schedule must be a PDF, JPEG, or PNG file.");
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) throw new Error("Schedule must be between 1 byte and 10 MB.");
  const validPdf = contentType === "application/pdf" && buffer.subarray(0, 4).toString() === "%PDF";
  const validJpeg = contentType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const validPng = contentType === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!validPdf && !validJpeg && !validPng) throw new Error("Schedule file content does not match its declared format.");
  return { buffer, contentType };
}

export async function uploadSchedule(employerId: string, dataUrl: string, originalName: string): Promise<{ path: string; contentType: string }> {
  const { buffer, contentType } = decodeScheduleDataUrl(dataUrl);
  const safeName = originalName.replace(/[^a-z0-9._-]+/gi, "-").slice(-80) || "schedule";
  const path = `${employerId}/${Date.now()}-${safeName}`;
  await putObject("schedules", path, buffer, contentType);
  return { path, contentType };
}

export async function removeSchedule(path: string) {
  await deleteObject("schedules", path);
}

export async function uploadPayslipPdf(
  employeeId: string,
  year: number,
  month: number,
  pdfBuffer: Buffer,
): Promise<string> {
  const path = `${employeeId}/${year}-${String(month).padStart(2, "0")}.pdf`;
  await putObject("payslips", path, pdfBuffer, "application/pdf");
  return path;
}

export async function signedUrl(
  bucket: "selfies" | "site-photos" | "payslips" | "schedules",
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKETS[bucket], Key: path });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}
