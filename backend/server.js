import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';  
import bcrypt from 'bcryptjs';         
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env only in local environment
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.resolve(__dirname, '.env');
  console.log(`🧩 Loading local .env from: ${envPath}`);
  dotenv.config({ path: envPath });
}

const { Pool } = pkg;
const app = express();

// Database connection
let pool;

// 1. INITIAL MIDDLEWARE
app.use(cors()); 
app.use(express.json({ limit: '10mb' }));

// NOTE: The session middleware will be defined LATER inside startServer()
// once the 'pool' variable is successfully initialized.

const initializeDatabaseConnection = async () => {
  try {
    const dbURL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;

if (!dbURL) {
  throw new Error('No database connection URL found in environment variables');
}

    console.log('🔗 Connecting to PostgreSQL database...');

    pool = new Pool({
  connectionString: dbURL,
  ssl: { rejectUnauthorized: false },
});

    
    // Initialize the global pool variable
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20
    });

    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database');
    const result = await client.query('SELECT NOW()');
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Create stories tables
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS love_stories (
        id SERIAL PRIMARY KEY, couple_names VARCHAR(255) NOT NULL, story_title VARCHAR(500) NOT NULL, love_story TEXT NOT NULL,
        category VARCHAR(100) NOT NULL, mood VARCHAR(100) NOT NULL, together_since VARCHAR(50),
        allow_comments BOOLEAN DEFAULT true, anonymous_post BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_likes (
        id SERIAL PRIMARY KEY, story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE, user_ip VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(story_id, user_ip)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_comments (
        id SERIAL PRIMARY KEY, story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE, author_name VARCHAR(255) DEFAULT 'Anonymous',
        comment_text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Story database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

// Create user/social tables
async function createUserTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, 
                username VARCHAR(50) UNIQUE NOT NULL, 
                email VARCHAR(255) UNIQUE NOT NULL,       
                display_name VARCHAR(100),
                password_hash VARCHAR(255) NOT NULL,       
                bio TEXT, 
                location VARCHAR(100), 
                relationship_status VARCHAR(50), 
                avatar_url VARCHAR(500), 
                cover_photo_url VARCHAR(500),
                is_verified BOOLEAN DEFAULT false, 
                is_public BOOLEAN DEFAULT true, 
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS user_follows (
            id SERIAL PRIMARY KEY, follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE, following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id)
          )
        `);

        // Check if default user (ID 1) exists and insert if not
        const userCheck = await pool.query('SELECT id FROM users WHERE id = 1');
        if (userCheck.rows.length === 0) {
            const defaultPassHash = await bcrypt.hash('defaultpassword', 10);
            await pool.query(`
                INSERT INTO users (id, username, email, display_name, password_hash, bio, location, relationship_status)
                VALUES (1, 'currentuser', 'default@lovculator.com', 'Current User', $1, 'Love enthusiast and story sharer 💖', 'New York, USA', 'In a relationship')
            `, [defaultPassHash]);
            console.log('✅ Default user ID 1 created for demo purposes (Login: currentuser/defaultpassword)');
        }

        console.log('✅ User social tables created/verified');
    } catch (error) {
        console.error('❌ Error creating user tables:', error);
    }
}

// ========================
// API UTILITY FUNCTIONS
// ========================

// Middleware to check if the user is authenticated (NEW)
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next(); 
    } else {
        res.status(401).json({ error: 'Authentication required.' });
    }
};

const fetchUserWithCounts = async (user, userId) => {
    const idToQuery = userId || user.id;

    const followerCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1',
        [idToQuery]
    );

    const followingCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1',
        [idToQuery]
    );

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        location: user.location,
        relationship_status: user.relationship_status,
        is_public: user.is_public,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
        avatar_url: user.avatar_url || '/images/default-avatar.png',
        cover_photo_url: user.cover_photo_url || '/images/default-cover.jpg',
        follower_count: parseInt(followerCountResult.rows[0].count) || 0,
        following_count: parseInt(followingCountResult.rows[0].count) || 0,
    };
};

// ========================
// 🛑 API ROUTES (MUST BE BEFORE STATIC SERVING) 🛑
// ========================

// Health check
app.get('/api/health', async (req, res) => {
  try {
    if (pool) { await pool.query('SELECT 1'); }
    res.json({ status: 'OK', database: pool ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.json({ status: 'ERROR', database: 'error', error: error.message, timestamp: new Date().toISOString() });
  }
});

// ========================
// AUTHENTICATION API ROUTES
// ========================

// 1. POST User Registration (Sign Up)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username or email is already in use.' });
        }

        const saltRounds = 10; 
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, display_name
        `, [username, email, passwordHash, username]);

        const newUser = result.rows[0];
        req.session.userId = newUser.id;
        
        res.status(201).json({ 
            id: newUser.id, 
            username: newUser.username, 
            display_name: newUser.display_name
        });

    } catch (error) {
        console.error('❌ Error during user registration:', error);
        res.status(500).json({ error: 'Failed to register new user.' });
    }
});

// 2. POST User Login (Sign In)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username: loginIdentifier, password } = req.body;
        
        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Username/Email and password are required.' });
        }

        const userResult = await pool.query(
            'SELECT id, username, email, password_hash, display_name FROM users WHERE username = $1 OR email = $1', 
            [loginIdentifier]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        req.session.userId = user.id;
        
        res.json({ 
            id: user.id, 
            username: user.username, 
            display_name: user.display_name 
        });

    } catch (error) {
        console.error('❌ Error during user login:', error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});

// 3. POST User Logout (Sign Out)
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid'); 
        res.json({ message: 'Logged out successfully.' });
    });
});

// 4. GET Session Status (Used by AuthManager.checkSession)
app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const userResult = await pool.query('SELECT id, username, email, display_name FROM users WHERE id = $1', [req.session.userId]);
        const user = userResult.rows[0];

        if (!user) {
            req.session.destroy();
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user data for /me:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================
// USER PROFILE API ROUTES
// ========================

// 5. GET Current User (Requires Authentication)
app.get('/api/user/current', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId; // Guaranteed to be present by isAuthenticated middleware
        
        const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        
        if (userResult.rows.length === 0) {
            req.session.destroy();
            return res.status(404).json({ error: 'User not found' });
        }

        const userWithCounts = await fetchUserWithCounts(userResult.rows[0], userId);
        res.json(userWithCounts);

    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// 6. GET User Profile by Username (Public Route - No auth required)
app.get('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const userResult = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        const userWithCounts = await fetchUserWithCounts(user, user.id);
        res.json(userWithCounts);

    } catch (error) {
        console.error('Error fetching user profile by username:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// 7. PUT Update user profile (Requires Authentication and Ownership Check)
app.put('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Security check: Must be updating their own profile
        if (req.session.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to update this profile.' });
        }
        
        const { display_name, bio, location, relationship_status, avatar_url, cover_photo_url, is_public } = req.body;

        const result = await pool.query(`
            UPDATE users 
            SET display_name = $1, bio = $2, location = $3, relationship_status = $4, avatar_url = $5, cover_photo_url = $6, is_public = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `, [display_name, bio, location, relationship_status, avatar_url, cover_photo_url, is_public, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUserWithCounts = await fetchUserWithCounts(result.rows[0], userId);
        res.json(updatedUserWithCounts);
        
    } catch (error) {
        console.error('❌ Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// 8. Get user's love stories
app.get('/api/users/:username/stories', async (req, res) => {
  try {
    const { username } = req.params;
    
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // NOTE: For simplicity, still relying on couple_names loose matching
    const result = await pool.query(`
      SELECT ls.*, 
             COUNT(DISTINCT sl.id) as likes_count,
             COUNT(DISTINCT sc.id) as comments_count
      FROM love_stories ls
      LEFT JOIN story_likes sl ON ls.id = sl.story_id
      LEFT JOIN story_comments sc ON ls.id = sc.story_id
      WHERE ls.couple_names ILIKE $1 
      GROUP BY ls.id
      ORDER BY ls.created_at DESC
      LIMIT 20
    `, [`%${username}%`]); 

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user stories:', error);
    res.status(500).json({ error: 'Failed to fetch user stories' });
  }
});

// 9. Get user's followers/following counts (Public Route)
app.get('/api/users/:username/:type/count', async (req, res) => {
  try {
    const { username, type } = req.params;
    if (type !== 'followers' && type !== 'following') return res.status(400).json({ error: 'Invalid count type.' });
    
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    let query;
    if (type === 'followers') {
        query = 'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1';
    } else { 
        query = 'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1';
    }
    
    const countResult = await pool.query(query, [userId]);
    res.json({ count: parseInt(countResult.rows[0].count) || 0 });

  } catch (error) {
    console.error(`Error fetching ${req.params.type} count:`, error);
    res.status(500).json({ error: `Failed to fetch ${req.params.type} count.` });
  }
});

// ========================
// LOVE STORIES API ROUTES
// ========================

app.get('/api/stories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ls.*,
        COUNT(DISTINCT sl.id) as likes_count,
        COUNT(DISTINCT sc.id) as comments_count,
        false as user_liked
      FROM love_stories ls
      LEFT JOIN story_likes sl ON ls.id = sl.story_id
      LEFT JOIN story_comments sc ON ls.id = sc.story_id
      GROUP BY ls.id
      ORDER BY ls.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create new story (Requires Authentication)
app.post('/api/stories', isAuthenticated, async (req, res) => {
  try {
    const { coupleNames, storyTitle, loveStory, category, mood, togetherSince, allowComments = true, anonymousPost = false } = req.body;
    if (!coupleNames || !storyTitle || !loveStory || !category || !mood) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO love_stories 
       (couple_names, story_title, love_story, category, mood, together_since, allow_comments, anonymous_post) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [ anonymousPost ? 'Anonymous Couple' : coupleNames, storyTitle, loveStory, category, mood, togetherSince, allowComments, anonymousPost ]
    );

    res.status(201).json({ ...result.rows[0], likes_count: 0, comments_count: 0, user_liked: false });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Liking, commenting, and getting comments do not strictly require a logged-in user 
// in this model, so they remain public for flexibility.

app.post('/api/stories/:id/like', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const userIP = req.ip || req.connection.remoteAddress;

    const existingLike = await pool.query('SELECT id FROM story_likes WHERE story_id = $1 AND user_ip = $2', [storyId, userIP]);

    if (existingLike.rows.length > 0) {
      await pool.query('DELETE FROM story_likes WHERE story_id = $1 AND user_ip = $2', [storyId, userIP]);
    } else {
      await pool.query('INSERT INTO story_likes (story_id, user_ip) VALUES ($1, $2)', [storyId, userIP]);
    }

    const likeCount = await pool.query('SELECT COUNT(*) as count FROM story_likes WHERE story_id = $1', [storyId]);

    res.json({ 
      likes_count: parseInt(likeCount.rows[0].count),
      liked: existingLike.rows.length === 0
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

app.post('/api/stories/:id/comments', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const { author = 'Anonymous', text } = req.body;

    if (!text) { return res.status(400).json({ error: 'Comment text is required' }); }

    const result = await pool.query(
      'INSERT INTO story_comments (story_id, author_name, comment_text) VALUES ($1, $2, $3) RETURNING *',
      [storyId, author, text]
    );

    const commentCount = await pool.query('SELECT COUNT(*) as count FROM story_comments WHERE story_id = $1', [storyId]);

    res.json({
      comment: result.rows[0],
      comments_count: parseInt(commentCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.get('/api/stories/:id/comments', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    
    const result = await pool.query(
      'SELECT * FROM story_comments WHERE story_id = $1 ORDER BY created_at ASC',
      [storyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ========================
// SIMPLE STATIC FILE SERVING
// ========================

/// Serve static frontend files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// Handle non-API routes by serving index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// ========================
// SERVER INITIALIZATION
// ========================

const startServer = async () => {
  try {
    const dbConnected = await initializeDatabaseConnection();
    
    if (dbConnected) {
      
      // ✅ PG SESSION STORE INITIALIZATION
      const PGStore = connectPgSimple(session);
      const sessionStore = new PGStore({
          pool: pool, 
          tableName: 'session_store',
          createTableIfMissing: true,
          ttl: 24 * 60 * 60,
      });

      // ✅ EXPRESS SESSION MIDDLEWARE
      app.use(session({
          store: sessionStore, 
          secret: process.env.SESSION_SECRET || '38v7n5Q@k9Lp!zG2x&R4tY0uA1eB6cI$o9mH8jJ0sK7wD6fE5', 
          resave: false,
          saveUninitialized: false,
          cookie: {
              secure: process.env.NODE_ENV === 'production' ? true : false,
              sameSite: 'none', 
              httpOnly: true,
              maxAge: 1000 * 60 * 60 * 24 // 24 hours
          }
      }));
      
      await createTables();
      await createUserTables();
    } else {
      console.log('⚠️  Starting server without database connection');
    }
    
    const PORT = process.env.PORT || 3001;
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Database: ${dbConnected ? 'Connected' : 'Not connected'}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        throw error;
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();