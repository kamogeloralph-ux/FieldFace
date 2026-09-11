import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { startPayslipCron } from "./cron";
import { db } from "./db";
import { payslips } from "../drizzle/schema";
import { signedUrl } from "./storage";

const app = express();
app.use(express.json({ limit: "12mb" })); // selfies come through as base64 in tRPC input
app.use(cookieParser());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Short, shareable bearer link for a payslip. The UUID is intentionally the
// only identifier in the public URL; the private R2 URL stays server-side.
app.get("/share/payslip/:payslipId", async (req, res, next) => {
  try {
    const [payslip] = await db.select().from(payslips).where(eq(payslips.id, req.params.payslipId));
    if (!payslip) return res.status(404).send("Payslip not found.");
    return res.redirect(302, await signedUrl("payslips", payslip.pdfPath, 3600));
  } catch (error) {
    return next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const path = await import("node:path");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  // Redirect the legacy filename before express.static can serve admin.html
  // directly. The owner console must always enter through the /admin router
  // and must never fall through to the employee application.
  app.get("/admin.html", (_req, res) => res.redirect(301, "/admin/login"));

  app.use(express.static(distPath));

  // The platform-owner console is built from admin.html but is exposed at /admin.
  app.get("/admin", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));
  app.get("/admin/*", (_req, res) => res.sendFile(path.join(distPath, "admin.html")));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`FieldFace server listening on :${port}`);
  startPayslipCron();
});
