import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env only for local development
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.resolve(__dirname, '.env');
  console.log(`🧩 Loading local .env from: ${envPath}`);
  dotenv.config({ path: envPath });
}

const { Pool } = pkg;
const app = express();

let pool;

// Middleware
// NOTE: CORS should be configured carefully for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:3000', // Example
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Database connection
const initializeDatabaseConnection = async () => {
  try {
    const dbURL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
    if (!dbURL) throw new Error('DATABASE_URL not found in environment');

    console.log('🔗 Connecting to PostgreSQL database...');
    // Add Heroku-style connection check for production
    const isProduction = process.env.NODE_ENV === 'production' || dbURL.includes('ssl=true');
    
    const config = {
      connectionString: dbURL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20,
    };

    if (isProduction && !dbURL.includes('sslmode=disable')) {
        config.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(config);

    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database');
    await client.query('SELECT NOW()');
    client.release();
    return true;

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Table creation
async function createTables() {
  try {
    await pool.query(` CREATE TABLE IF NOT EXISTS love_stories ( id SERIAL PRIMARY KEY, couple_names VARCHAR(255) NOT NULL, story_title VARCHAR(500) NOT NULL, love_story TEXT NOT NULL, category VARCHAR(100) NOT NULL, mood VARCHAR(100) NOT NULL, together_since VARCHAR(50), allow_comments BOOLEAN DEFAULT true, anonymous_post BOOLEAN DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ) `);
    await pool.query(` CREATE TABLE IF NOT EXISTS story_likes ( id SERIAL PRIMARY KEY, story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE, user_ip VARCHAR(45), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(story_id, user_ip) ) `);
    await pool.query(` CREATE TABLE IF NOT EXISTS story_comments ( id SERIAL PRIMARY KEY, story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE, author_name VARCHAR(255) DEFAULT 'Anonymous', comment_text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ) `);
    console.log('✅ Story tables created or verified');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  }
}

async function createUserTables() {
  try {
    await pool.query(` CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, display_name VARCHAR(100), password_hash VARCHAR(255) NOT NULL, bio TEXT, location VARCHAR(100), relationship_status VARCHAR(50), avatar_url VARCHAR(500), cover_photo_url VARCHAR(500), is_verified BOOLEAN DEFAULT false, is_public BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ) `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);


    const userCheck = await pool.query('SELECT id FROM users WHERE id = 1');
    if (userCheck.rows.length === 0) {
      const passHash = await bcrypt.hash('defaultpassword', 10);
      await pool.query(`
        INSERT INTO users (id, username, email, display_name, password_hash, bio, location, relationship_status)
        VALUES (1, 'currentuser', 'default@lovculator.com', 'Current User', $1, 'Love enthusiast 💖', 'New York, USA', 'In a relationship')
      `, [passHash]);
      console.log('✅ Default user created for demo');
    }

    console.log('✅ User and Session tables created or verified');

  } catch (err) {
    console.error('❌ Error creating user tables:', err);
  }
}

// Middleware helper
const isAuthenticated = (req, res, next) => {
  if (req.session?.userId) return next();
  res.status(401).json({ error: 'Authentication required.' });
};

// Health check
app.get('/api/health', async (req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({ status: 'OK', database: pool ? 'connected' : 'disconnected', time: new Date().toISOString() });
  } catch (e) {
    res.json({ status: 'ERROR', database: 'error', error: e.message });
  }
});

// ========================
// AUTH + USER ROUTES (Simplified)
// ========================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });
    const existing = await pool.query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username or email in use.' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1,$2,$3,$4) RETURNING id,username,display_name',
      [username, email, hash, username]
    );
    req.session.userId = result.rows[0].id;
    // Set a flag to indicate the session is ready
    req.session.save(() => {
        res.status(201).json(result.rows[0]);
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    // Search by username OR email
    const result = await pool.query('SELECT * FROM users WHERE username=$1 OR email=$1', [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials.' });
    
    // Regenerate session upon successful login for security (Session Fixation)
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Login session failed.' });
      
      req.session.userId = user.id;
      // Set a flag to indicate the session is ready
      req.session.save(() => {
          res.json({ id: user.id, username: user.username, display_name: user.display_name });
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    // Clear cookie manually if destroy doesn't handle it immediately
    res.clearCookie('connect.sid'); // Replace with your actual cookie name if different
    res.json({ message: 'Logged out.' });
  });
});

// ========================
// STATIC FILE SERVING
// ========================

// Define the root directory of the frontend files
const FRONTEND_ROOT = path.resolve(__dirname, 'public');


// Serve frontend assets (js, css, images, etc.)
app.use(express.static(FRONTEND_ROOT));

// Fallback for all other GET requests to serve the SPA's entry point (index.html)
app.get('*', (req, res, next) => {
  // Only serve index.html if the request is NOT for an API route
  if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
  
  res.sendFile(path.resolve(FRONTEND_ROOT, 'index.html'));
});

// ========================
// SERVER STARTUP
// ========================

const startServer = async () => {
  try {
    const dbConnected = await initializeDatabaseConnection();

    if (dbConnected) {
      const PGStore = connectPgSimple(session);
      const sessionStore = new PGStore({
        pool,
        tableName: 'session_store',
        createTableIfMissing: true, // This is good for first-time setup
        ttl: 24 * 60 * 60,
      });

      app.use(
        session({
          store: sessionStore,
          secret:
            process.env.SESSION_SECRET ||
            '38v7n5Q@k9Lp!zG2x&R4tY0uA1eB6cI$o9mH8jJ0sK7wD6fE5', // USE .env FOR PROD
          resave: false,
          saveUninitialized: false,
          // Configure cookie based on environment
          cookie: {
            secure: process.env.NODE_ENV === 'production', // true in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' needed for cross-site (API/Client on different domains)
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24, // 24 hours
          },
        })
      );

      await createTables();
      await createUserTables();
    } else {
      // If DB fails, you might want to exit or run in a reduced capacity mode
      console.log('⚠️ Starting server without DB connection. API routes requiring DB will fail.');
    }

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Database: ${dbConnected ? 'Connected' : 'Not connected'}`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();