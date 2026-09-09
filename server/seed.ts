/**
 * One-time bootstrap script.
 *
 * Usage:
 *   1. In the Supabase dashboard, go to Authentication -> Users -> Add user,
 *      and create the first supervisor's login (email + password). Copy their
 *      User UID.
 *   2. Run:
 *        pnpm tsx server/seed.ts "Acme Roadworks" "owner@acme.com" "<user-uid>"
 *
 * This creates the employer record and links that Supabase Auth user as the
 * 'owner' admin for it. Everything else (sites, employees) is managed from
 * admin.html after that.
 */
import "dotenv/config";
import { db } from "./db";
import { adminUsers, employers } from "../drizzle/schema";

async function main() {
  const [employerName, email, userId] = process.argv.slice(2);
  if (!employerName || !email || !userId) {
    console.error('Usage: pnpm tsx server/seed.ts "Employer Name" "owner@email.com" "<supabase-auth-user-uuid>"');
    process.exit(1);
  }

  const [employer] = await db.insert(employers).values({ name: employerName, contactEmail: email }).returning();
  await db.insert(adminUsers).values({
    id: userId,
    employerId: employer.id,
    fullName: employerName + " Owner",
    email,
    role: "owner",
  });

  console.log(`Created employer "${employer.name}" (${employer.id}) and linked ${email} as owner.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
