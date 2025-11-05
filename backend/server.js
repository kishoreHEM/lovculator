// ======================================================
// 🌐 Lovculator Server.js (Railway-Ready + Clean URLs)
// ======================================================
import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

// ======================================================
// 🧩 Middleware
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

// ======================================================
// 🗄️ Database Connection
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

    pool.on("error", (err) => {
      console.error("Unexpected DB error:", err);
      process.exit(-1);
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
// 💾 Session Configuration
// ======================================================
async function setupSession() {
  const PGStore = connectPgSimple(session);
  const store = new PGStore({
    pool,
    tableName: "session_store",
    createTableIfMissing: true,
    ttl: 24 * 60 * 60,
  });

  app.use(
    session({
      store,
      secret: process.env.SESSION_SECRET || "dev_secret_key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      },
    })
  );

  console.log("✅ Session store configured");
}

// ======================================================
// 📦 Import API Routes
// ======================================================
import authRoutes from "./routes/auth.js";
import storyRoutes from "./routes/stories.js";
import userRoutes from "./routes/users.js";

app.use("/api/auth", authRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/users", userRoutes);

// ======================================================
// 🎨 Frontend Static Path (with Railway Diagnostics)
// ======================================================
let frontendPath = path.resolve(__dirname, "../frontend");

if (!fs.existsSync(frontendPath)) {
  console.warn("⚠️ No frontend folder found in expected paths. Make sure 'frontend/' exists and was committed to your repository.");
  frontendPath = "/app/frontend";
}

console.log(`🌍 Frontend served from: ${frontendPath}`);

// 🧭 Diagnostic Check
try {
  const files = fs.readdirSync(frontendPath);
  console.log("📁 Frontend folder contents:", files);
  if (files.includes("index.html")) {
    console.log("✅ index.html found successfully!");
  } else {
    console.warn("🚨 WARNING: index.html not found inside frontend path!");
  }
} catch (err) {
  console.error("❌ Could not read frontend folder:", err.message);
}

app.use(express.static(frontendPath));

// ======================================================
// 🚦 Clean URL Route Handling
// ======================================================
const cleanRoutes = [
  "/", 
  "/login",
  "/signup",
  "/love-stories",
  "/profile",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/record"
];

cleanRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"), (err) => {
      if (err) {
        console.error("⚠️ Error serving clean route:", err);
        res.sendFile(path.join(frontendPath, "404.html"));
      }
    });
  });
});

// Catch-all route for frontend
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) res.sendFile(path.join(frontendPath, "404.html"));
  });
});

// ======================================================
// 🚀 Server Startup
// ======================================================
(async () => {
  const dbConnected = await initializeDatabase();
  if (dbConnected) await setupSession();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbConnected ? "Connected" : "Not connected"}`);
    console.log(`🌍 Frontend served from: ${frontendPath}`);
  });
})();
