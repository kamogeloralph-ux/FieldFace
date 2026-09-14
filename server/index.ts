import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { startPayslipCron } from "./cron";
import { db, ensureProductionSchema } from "./db";
import { dailyReportShares, employees, employers, payslips, sites, timeEntries } from "../drizzle/schema";
import { signedUrl } from "./storage";
import { verifyDailyReportShareToken } from "./auth";
import { localDayBounds } from "./timezone";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});
app.use(express.json({ limit: "12mb" })); // selfies come through as base64 in tRPC input
app.use(cookieParser());

const requestWindows = new Map<string, { startedAt: number; count: number }>();
app.use("/api", (req, res, next) => {
  const now = Date.now();
  const ip = req.ip ?? "unknown";
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= 60_000) requestWindows.set(ip, { startedAt: now, count: 1 });
  else {
    current.count += 1;
    if (current.count > 240) return res.status(429).json({ error: "Too many requests. Try again shortly." });
  }
  next();
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true, database: "ok", now: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/share/payslip/:id", async (req, res) => {
  try {
    const [payslip] = await db.select({ pdfPath: payslips.pdfPath }).from(payslips).where(eq(payslips.id, req.params.id)).limit(1);
    if (!payslip) return res.status(404).send("Payslip not found.");
    return res.redirect(302, await signedUrl("payslips", payslip.pdfPath, 300));
  } catch {
    return res.status(404).send("Payslip is unavailable.");
  }
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

app.get("/share/daily-report/:token", async (req, res) => {
  const [shortShare] = await db.select({ employerId: dailyReportShares.employerId, date: dailyReportShares.reportDate, expiresAt: dailyReportShares.expiresAt })
    .from(dailyReportShares)
    .where(eq(dailyReportShares.token, req.params.token))
    .limit(1);
  const share = shortShare && shortShare.expiresAt > new Date()
    ? { employerId: shortShare.employerId, date: shortShare.date }
    : verifyDailyReportShareToken(req.params.token);
  if (!share) return res.status(404).send("This daily report link is invalid or has expired.");
  try {
    const [employer] = await db.select({ name: employers.name, timezone: employers.timezone }).from(employers).where(eq(employers.id, share.employerId));
    if (!employer) return res.status(404).send("Daily report not found.");
    const { start, end } = localDayBounds(share.date, employer.timezone ?? "Africa/Johannesburg");
    const [employeeRows, siteRows, entryRows] = await Promise.all([
      db.select({ id: employees.id, fullName: employees.fullName, active: employees.active }).from(employees).where(eq(employees.employerId, share.employerId)),
      db.select({ id: sites.id, name: sites.name }).from(sites).where(eq(sites.employerId, share.employerId)),
      db.select().from(timeEntries).where(and(gte(timeEntries.occurredAt, start), lte(timeEntries.occurredAt, end))),
    ]);
    const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee]));
    const siteById = new Map(siteRows.map((site) => [site.id, site.name]));
    const entries = await Promise.all(entryRows.filter((entry) => employeeById.has(entry.employeeId)).map(async (entry) => ({
      employeeName: employeeById.get(entry.employeeId)?.fullName ?? "Unknown",
      siteName: entry.siteId ? siteById.get(entry.siteId) ?? "Unknown site" : "No site",
      entryType: entry.entryType === "clock_in" ? "Clocked in" : "Clocked out",
      occurredAt: new Date(entry.occurredAt).toISOString(),
      withinGeofence: entry.withinGeofence,
      distanceMeters: Math.round(entry.distanceMeters),
      selfieUrl: await signedUrl("selfies", entry.selfieUrl, 3600),
    })));
    entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const clockedIn = new Set<string>();
    for (const entry of [...entryRows].reverse()) {
      if (!employeeById.has(entry.employeeId)) continue;
      if (entry.entryType === "clock_in") clockedIn.add(entry.employeeId);
      else clockedIn.delete(entry.employeeId);
    }
    const rows = entries.map((entry) => `<tr><td>${escapeHtml(entry.employeeName)}</td><td>${escapeHtml(entry.siteName)}</td><td>${entry.entryType}</td><td>${escapeHtml(new Date(entry.occurredAt).toLocaleString())}</td><td>${entry.withinGeofence ? "Within area" : `Outside area (~${entry.distanceMeters}m)`}</td><td><img src="${entry.selfieUrl}" alt="Selfie" /></td></tr>`).join("");
    res.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily Report - ${escapeHtml(employer.name)}</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:1100px;margin:32px auto;padding:0 20px}h1{margin-bottom:4px}p{color:#64748b}.summary{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.card{border:1px solid #dbe3ea;border-radius:10px;padding:14px 18px;min-width:140px}.label{font-size:12px;color:#64748b}.value{font-size:24px;font-weight:700;margin-top:4px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #dbe3ea;padding:9px;text-align:left}th{background:#f1f5f9}img{width:48px;height:48px;object-fit:cover;border-radius:6px}@media print{body{margin:0}.summary{break-inside:avoid}}</style></head><body><h1>${escapeHtml(employer.name)} — Daily Report</h1><p>${escapeHtml(share.date)}</p><div class="summary"><div class="card"><div class="label">Active employees</div><div class="value">${employeeRows.filter((employee) => employee.active).length}</div></div><div class="card"><div class="label">Currently clocked in</div><div class="value">${clockedIn.size}</div></div><div class="card"><div class="label">Outside designated area</div><div class="value">${entries.filter((entry) => !entry.withinGeofence).length}</div></div></div><table><thead><tr><th>Employee</th><th>Site</th><th>Action</th><th>Time</th><th>Geofence</th><th>Selfie</th></tr></thead><tbody>${rows || "<tr><td colspan=6>No activity recorded for this day.</td></tr>"}</tbody></table></body></html>`);
  } catch {
    return res.status(404).send("Daily report is unavailable.");
  }
});

if (process.env.NODE_ENV === "production") {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  const runtimeConfigScript = `<script>window.__FIELDFACE_SUPABASE_URL__=${JSON.stringify(process.env.VITE_SUPABASE_URL || "")};window.__FIELDFACE_SUPABASE_ANON_KEY__=${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || "")};</script>`;
  const sendHtml = async (fileName: string, res: express.Response) => {
    const html = await fs.readFile(path.join(distPath, fileName), "utf8");
    res.type("html").send(html.replace("</head>", `${runtimeConfigScript}</head>`));
  };

  // Serve the owner-console entrypoint directly. It has its own browser root
  // and never falls through to the employee application.
  app.get("/admin.html", (_req, res) => { void sendHtml("admin.html", res); });
  app.get(/^\/admin\.html(?:\/.*)?$/, (_req, res) => { void sendHtml("admin.html", res); });

  app.get("/sw.js", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.sendFile(path.join(distPath, "sw.js")); });
  app.use(express.static(distPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    void sendHtml("index.html", res);
  });
}

const port = Number(process.env.PORT) || 3001;
ensureProductionSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`FieldFace server listening on :${port}`);
      startPayslipCron();
    });
  })
  .catch((error) => {
    console.error("FieldFace schema bootstrap failed:", error);
    process.exit(1);
  });
