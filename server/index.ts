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
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/admin")) return res.sendFile(path.join(distPath, "admin.html"));
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`FieldFace server listening on :${port}`);
  startPayslipCron();
});
