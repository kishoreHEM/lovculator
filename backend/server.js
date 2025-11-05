import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import fs from "fs";

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

// ======================================================
// 1️⃣ Security + Middleware
// ======================================================
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://lovculator.com"
        : "http://localhost:3000",
    credentials: true,
  })
);

// ✅ Force HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      const secureUrl = `https://${req.headers.host}${req.url}`;
      return res.redirect(301, secureUrl);
    }
    next();
  });
}

// ======================================================
// 2️⃣ PostgreSQL Database Connection
// ======================================================
let pool;
async function initializeDatabase() {
  try {
    const dbURL = process.env.DATABASE_URL;
    if (!dbURL) throw new Error("DATABASE_URL missing in .env");

    pool = new Pool({
      connectionString: dbURL,
      ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database");
    client.release();
    return true;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    return false;
  }
}

// ======================================================
// 3️⃣ Session Store
// ======================================================
async function setupSession() {
  const PGStore = connectPgSimple(session);
  app.use(
    session({
      store: new PGStore({
        pool,
        tableName: "session_store",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev_secret_key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      },
    })
  );
  console.log("✅ Session store configured");
}

// ======================================================
// 4️⃣ API Routes
// ======================================================
import authRoutes from "./backend/routes/auth.js";
import storyRoutes from "./backend/routes/stories.js";
import userRoutes from "./backend/routes/users.js";

app.use("/api/auth", authRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/users", userRoutes);

// ======================================================
// 5️⃣ Frontend Serving (Auto-detects correct folder)
// ======================================================
const possiblePaths = [
  path.resolve("./frontend"), // dev local
  path.join(__dirname, "frontend"), // same level as backend
  path.join(process.cwd(), "frontend"), // cwd fallback
  "/app/frontend", // Railway container
];

let FRONTEND_PATH = possiblePaths.find((p) =>
  fs.existsSync(path.join(p, "index.html"))
);

if (!FRONTEND_PATH) {
  console.warn("⚠️ Frontend not found in known paths, defaulting to /app/frontend");
  FRONTEND_PATH = "/app/frontend";
}

console.log("🌍 Frontend served from:", FRONTEND_PATH);
app.use(express.static(FRONTEND_PATH));

// ======================================================
// 6️⃣ Clean URL Routes (No .html)
// ======================================================
const cleanRoutes = [
  "/",
  "/login",
  "/signup",
  "/profile",
  "/love-stories",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

cleanRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
  });
});

// Fallback: serve index.html for non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// ======================================================
// 7️⃣ Start Server
// ======================================================
(async () => {
  const dbConnected = await initializeDatabase();
  if (dbConnected) await setupSession();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbConnected ? "Connected" : "Not connected"}`);
    console.log(`🌍 Frontend served from: ${FRONTEND_PATH}`);
  });
})();
