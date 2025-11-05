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

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ======================================================
// 1️⃣ SECURITY & BASE MIDDLEWARE
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
// 2️⃣ DATABASE CONNECTION
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
// 3️⃣ SESSION STORE
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
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      },
    })
  );
  console.log("✅ Session store configured");
}

// ======================================================
// 4️⃣ API ROUTES
// ======================================================
import authRoutes from "./routes/auth.js";
import storyRoutes from "./routes/stories.js";
import userRoutes from "./routes/users.js";

app.use("/api/auth", authRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/users", userRoutes);

// ======================================================
// 5️⃣ FRONTEND ROUTING (Static + Clean URLs)
// ======================================================
const FRONTEND_PATH = path.join(process.cwd(), "frontend");


// ✅ Serve static assets (CSS, JS, images)
app.use(express.static(FRONTEND_PATH));

// ✅ Clean URL redirects for your frontend pages
const frontendRoutes = [
  "/", // homepage
  "/login",
  "/signup",
  "/profile",
  "/love-stories",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/record",
];

// Serve the correct HTML page for each route
frontendRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, `${route === "/" ? "index" : route}.html`));
  });
});

// ✅ Catch-all fallback (for unknown routes)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// ======================================================
// 6️⃣ SERVER STARTUP
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
