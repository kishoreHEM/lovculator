/**
 * 🚀 Lovculator - Production Server.js (Railway Ready)
 * Author: Kishore M
 */

import express from "express";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";

// ✅ Environment Setup
dotenv.config();
const app = express();
const { Pool } = pg;
const PgSession = connectPgSimple(session);

// ✅ Resolve Paths (ESM Safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Detect Frontend Path
const possibleFrontendPaths = [
  path.join(__dirname, "../frontend"),
  path.join(process.cwd(), "frontend"),
  "/app/frontend",
];

let frontendPath = possibleFrontendPaths.find((p) => {
  try {
    return fs.existsSync(path.join(p, "index.html"));
  } catch {
    return false;
  }
});

if (!frontendPath) {
  console.warn(
    "⚠️ No frontend folder found in expected paths. Make sure 'frontend/' exists and was committed to your repository."
  );
  frontendPath = "/frontend"; // fallback for Railway
} else {
  console.log(`🌍 Frontend served from: ${frontendPath}`);
}

// ✅ Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontendPath));

// --- Security & Performance ---
app.use(helmet());
app.use(compression());
app.disable("x-powered-by");

// ✅ Optional: Force HTTPS in Production
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https"
  ) {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// ✅ PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL database"))
  .catch((err) =>
    console.error("❌ Database connection failed:", err.message)
  );

// ✅ Session Store
app.use(
  session({
    store: new PgSession({ pool, tableName: "session_store" }),
    secret: process.env.SESSION_SECRET || "lovculator_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

console.log("✅ Session store configured");

// ✅ Import API Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import storiesRoutes from "./routes/stories.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);

// ✅ 404 for unknown API endpoints
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// ✅ Serve frontend routes (clean URLs)
const validPages = [
  "index",
  "login",
  "signup",
  "profile",
  "love-stories",
  "about",
  "contact",
  "privacy",
  "terms",
  "record",
];

validPages.forEach((page) => {
  const routePath = page === "index" ? "/" : `/${page}`;
  app.get(routePath, (req, res) => {
    const file = path.join(frontendPath, `${page}.html`);
    res.sendFile(file);
  });
});

// ✅ 404 Fallback for any other route
app.use((req, res) => {
  const file404 = path.join(frontendPath, "404.html");
  if (fs.existsSync(file404)) {
    res.status(404).sendFile(file404);
  } else {
    res.status(404).send("404 - Page Not Found");
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${pool ? "Connected" : "Not connected"}`);
  console.log(`🌍 Frontend served from: ${frontendPath}`);
});
