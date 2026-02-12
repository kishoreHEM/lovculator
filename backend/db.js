// backend/db.js
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Explicitly load .env from backend folder
dotenv.config({ path: path.resolve(__dirname, ".env") });

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing in environment variables");
}

const isLocalDb =
  /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "") ||
  process.env.DB_SSL === "false";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  max: Number(process.env.PG_POOL_MAX || (process.env.NODE_ENV === "development" ? 5 : 20)),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 15000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000),
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.code || err.message);
});

// Global retry for transient network failures (Railway public proxy can reset sockets).
const rawQuery = pool.query.bind(pool);
const RETRYABLE_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"]);
pool.query = async (...args) => {
  let lastErr;
  const maxAttempts = Number(process.env.PG_QUERY_RETRIES || 3);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await rawQuery(...args);
    } catch (err) {
      lastErr = err;
      if (!RETRYABLE_CODES.has(err?.code) || attempt === maxAttempts) break;
      const delayMs = 150 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastErr;
};

export default pool;
