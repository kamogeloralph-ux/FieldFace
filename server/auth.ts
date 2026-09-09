import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { ADMIN_COOKIE_NAME, EMPLOYEE_COOKIE_NAME } from "@shared/const";
import { supabaseAdmin } from "./storage";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and fill it in.");
}

export interface EmployeeSession {
  employeeId: string;
  employerId: string;
  siteId: string | null;
}

export interface AdminSession {
  adminUserId: string;
  employerId: string;
  role: "owner" | "supervisor";
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 1000 * 60 * 60 * 12, // 12 hours
};

// --- Employee PIN auth -----------------------------------------------------

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function issueEmployeeSession(res: Response, session: EmployeeSession) {
  const token = jwt.sign(session, SESSION_SECRET!, { expiresIn: "12h" });
  res.cookie(EMPLOYEE_COOKIE_NAME, token, COOKIE_OPTIONS);
}

export function readEmployeeSession(req: Request): EmployeeSession | null {
  const token = req.cookies?.[EMPLOYEE_COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET!) as EmployeeSession;
  } catch {
    return null;
  }
}

export function clearEmployeeSession(res: Response) {
  res.clearCookie(EMPLOYEE_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: -1 });
}

// --- Admin auth (Supabase Auth email/password) ------------------------------
// The browser signs in via supabase-js and sends us the access token once;
// we verify it server-side and mint our own short-lived cookie session so
// every subsequent tRPC call doesn't need to round-trip to Supabase Auth.

export async function verifySupabaseAccessToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export function issueAdminSession(res: Response, session: AdminSession) {
  const token = jwt.sign(session, SESSION_SECRET!, { expiresIn: "12h" });
  res.cookie(ADMIN_COOKIE_NAME, token, COOKIE_OPTIONS);
}

export function readAdminSession(req: Request): AdminSession | null {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET!) as AdminSession;
  } catch {
    return null;
  }
}

export function clearAdminSession(res: Response) {
  res.clearCookie(ADMIN_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: -1 });
}
