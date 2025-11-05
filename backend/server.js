// backend/server.js
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
// 🧠 Middleware
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
// 🗄 Database Connection
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
// 🔐 Session Store
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
// 🧩 Import Routes
// ======================================================
import authRoutes from "./routes/auth.js";
import storyRoutes from "./routes/stories.js";
import userRoutes from "./routes/users.js";

app.use("/api/auth", authRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/users", userRoutes);

// ======================================================
// 🌍 Static Frontend Handling (Fixed for Railway + Local)
// ======================================================
let FRONTEND_PATH;

// Try local dev path (../frontend relative to /backend)
const LOCAL_FRONTEND_PATH = path.resolve(__dirname, "../frontend");

// Try Railway default deployment path
const RAILWAY_FRONTEND_PATH = "/app/frontend";

if (fs.existsSync(LOCAL_FRONTEND_PATH)) {
  FRONTEND_PATH = LOCAL_FRONTEND_PATH;
  console.log("🌍 Using local frontend path:", FRONTEND_PATH);
} else if (fs.existsSync(RAILWAY_FRONTEND_PATH)) {
  FRONTEND_PATH = RAILWAY_FRONTEND_PATH;
  console.log("🌍 Using Railway frontend path:", FRONTEND_PATH);
} else {
  FRONTEND_PATH = LOCAL_FRONTEND_PATH;
  console.warn(
    "⚠️ No frontend folder found in expected paths. " +
    "Make sure 'frontend/' exists and was committed to your repository."
  );
}

app.use(express.static(FRONTEND_PATH));

// ✅ Check if index.html exists
const indexPath = path.join(FRONTEND_PATH, "index.html");
if (fs.existsSync(indexPath)) {
  console.log("✅ index.html found successfully!");
} else {
  console.warn(`🚨 WARNING: index.html not found at ${indexPath}`);
}


// ======================================================
// 🚀 Clean URL Routes (No .html in URL)
// ======================================================
const cleanRoutes = [
  "signup",
  "login",
  "profile",
  "love-stories",
  "record",
  "about",
  "contact",
  "privacy",
  "terms",
];

cleanRoutes.forEach((route) => {
  app.get(`/${route}`, (req, res) =>
    res.sendFile(path.join(FRONTEND_PATH, `${route}.html`))
  );
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(FRONTEND_PATH, "404.html"));
});

// ======================================================
// 🏁 Start Server
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
