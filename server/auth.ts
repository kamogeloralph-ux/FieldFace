import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { ADMIN_COOKIE_NAME, EMPLOYEE_COOKIE_NAME, PLATFORM_COOKIE_NAME } from "@shared/const";
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
  role: "owner" | "supervisor" | "team_leader";
  isPlatformAdmin?: boolean;
}

export interface PlatformSession {
  platformAdminId: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 1000 * 60 * 60 * 12, // 12 hours
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function issueEmployeeSession(res: Response, session: EmployeeSession) {
  issueEmployeeSessionWithPreference(res, session, false);
}

export function issueEmployeeSessionWithPreference(res: Response, session: EmployeeSession, rememberMe: boolean) {
  const maxAge = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  const token = jwt.sign(session, SESSION_SECRET!, { expiresIn: rememberMe ? "30d" : "12h" });
  res.cookie(EMPLOYEE_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge });
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

export function issueAdminSession(res: Response, session: AdminSession, rememberMe = false) {
  const maxAge = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  const token = jwt.sign(session, SESSION_SECRET!, { expiresIn: rememberMe ? "30d" : "12h" });
  res.cookie(ADMIN_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge });
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

// --- Platform owner auth (Supabase Auth email/password, same pattern as admin) ---
// Platform admins are not tied to a single employer: they manage the list of
// companies as a whole (create/delete a company, or step into one to fix it).

export function issuePlatformSession(res: Response, session: PlatformSession, rememberMe = false) {
  const maxAge = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  const token = jwt.sign(session, SESSION_SECRET!, { expiresIn: rememberMe ? "30d" : "12h" });
  res.cookie(PLATFORM_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge });
}

export function readPlatformSession(req: Request): PlatformSession | null {
  const token = req.cookies?.[PLATFORM_COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET!) as PlatformSession;
  } catch {
    return null;
  }
}

export function clearPlatformSession(res: Response) {
  res.clearCookie(PLATFORM_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: -1 });
}
