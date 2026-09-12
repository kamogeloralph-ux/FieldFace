import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { startPayslipCron } from "./cron";
import { db, ensureProductionSchema } from "./db";
import { payslips } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { signedUrl } from "./storage";

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

if (process.env.NODE_ENV === "production") {
  const path = await import("node:path");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  // Serve the owner-console entrypoint directly. It has its own browser root
  // and never falls through to the employee application.
  app.get("/admin.html", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));
  app.get(/^\/admin\.html(?:\/.*)?$/, (_req, res) => res.sendFile(path.join(distPath, "admin.html")));

  app.get("/sw.js", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.sendFile(path.join(distPath, "sw.js")); });
  app.use(express.static(distPath));

  // The platform-owner console is available at both /admin.html and /admin.
  app.get("/admin", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));
  app.get("/admin/*", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
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
