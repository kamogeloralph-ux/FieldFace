import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { startPayslipCron } from "./cron";

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

if (process.env.NODE_ENV === "production") {
  const path = await import("node:path");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  app.use(express.static(distPath));

  // The platform-owner console is built from admin.html but is exposed at /admin.
  // Keep /admin.html as a compatibility URL for existing bookmarks.
  app.get("/admin.html", (_req, res) => res.redirect(301, "/admin"));
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
