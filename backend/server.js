import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';  

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const { Pool } = pkg;
const app = express();

// 1. INITIAL MIDDLEWARE (MUST BE HERE)
app.use(cors()); 
app.use(express.json({ limit: '10mb' }));

// Database connection with better error handling
let pool;

const initializeDatabaseConnection = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('🔗 Connecting to PostgreSQL database...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20
    });

    // Test the connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('📊 Database time:', result.rows[0].now);
    
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Please check your DATABASE_URL environment variable');
    return false;
  }
};

// Create tables
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS love_stories (
        id SERIAL PRIMARY KEY,
        couple_names VARCHAR(255) NOT NULL,
        story_title VARCHAR(500) NOT NULL,
        love_story TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        mood VARCHAR(100) NOT NULL,
        together_since VARCHAR(50),
        allow_comments BOOLEAN DEFAULT true,
        anonymous_post BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_likes (
        id SERIAL PRIMARY KEY,
        story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE,
        user_ip VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(story_id, user_ip)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_comments (
        id SERIAL PRIMARY KEY,
        story_id INTEGER REFERENCES love_stories(id) ON DELETE CASCADE,
        author_name VARCHAR(255) DEFAULT 'Anonymous',
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

// User Profiles Table
async function createUserTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        display_name VARCHAR(100),
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
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message_text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ User social tables created/verified');
  } catch (error) {
    console.error('❌ Error creating user tables:', error);
  }
}

// ========================
// CACHE HEADERS
// ========================

// HTML files - very short cache
app.use('/*.html', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  next();
});

// CSS files - medium cache (1 hour instead of 1 year)
app.use('/css/*', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  next();
});

// JS files - medium cache (1 hour instead of 1 year)  
app.use('/js/*', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  next();
});

// Images - long cache (ok to keep long)
app.use('/images/*', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
  next();
});

// Service Worker - no cache
app.use('/sw.js', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Manifest - no cache
app.use('/manifest.json', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// ========================
// CLEAN URL ROUTES (Your original routes)
// ========================

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/index', (req, res) => {
  res.redirect('/');
});

// Profile routes
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'profile.html'));
});

app.get('/profile/:username', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'profile.html'));
});

// Clean URL routes
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'contact.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'terms.html'));
});

app.get('/record', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'record.html'));
});

app.get('/love-stories', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'love-stories.html'));
});

// ========================
// REDIRECT .html URLs TO CLEAN URLs (THIS SECTION NOW HAS PRIORITY)
// ========================

// Redirect specific .html pages to clean URLs
app.get('/about.html', (req, res) => {
  res.redirect(301, '/about');
});

app.get('/contact.html', (req, res) => {
  res.redirect(301, '/contact');
});

app.get('/privacy.html', (req, res) => {
  res.redirect(301, '/privacy');
});

app.get('/terms.html', (req, res) => {
  res.redirect(301, '/terms');
});

app.get('/record.html', (req, res) => {
  res.redirect(301, '/record');
});

app.get('/love-stories.html', (req, res) => {
  res.redirect(301, '/love-stories');
});

app.get('/profile.html', (req, res) => {
  res.redirect(301, '/profile');
});

// Generic .html redirect (catch any others)
app.get('/*.html', (req, res) => {
  const cleanPath = req.path.replace(/\.html$/, '');
  res.redirect(301, cleanPath);
});

// ========================
// API ROUTES
// ========================

// Health check with database status
app.get('/api/health', async (req, res) => {
  try {
    if (pool) {
      await pool.query('SELECT 1');
      res.json({ 
        status: 'OK', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        status: 'OK', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.json({ 
      status: 'ERROR', 
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================
// PROFILE API ROUTES
// ========================

// Get current user (temporary mock for demo)
app.get('/api/user/current', async (req, res) => {
  try {
    // For now, return a mock user
    // In a real app, you'd get this from authentication/session
    const mockUser = {
      id: 1,
      username: 'currentuser',
      display_name: 'Current User',
      bio: 'This is my bio! I love sharing love stories.',
      location: 'New York, USA',
      relationship_status: 'In a relationship',
      avatar_url: '/images/default-avatar.png',
      cover_photo_url: '/images/default-cover.jpg',
      is_verified: false,
      is_public: true,
      created_at: new Date().toISOString(),
      follower_count: 42,
      following_count: 37
    };
    
    res.json(mockUser);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user profile by username
app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Mock user data for demo
    const mockUsers = {
      'currentuser': {
        id: 1,
        username: 'currentuser',
        display_name: 'Current User',
        bio: 'This is my bio! I love sharing love stories.',
        location: 'New York, USA',
        relationship_status: 'In a relationship',
        avatar_url: '/images/default-avatar.png',
        cover_photo_url: '/images/default-cover.jpg',
        is_verified: false,
        is_public: true,
        created_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0
      },
      'johndoe': {
        id: 2,
        username: 'johndoe',
        display_name: 'John Doe',
        bio: 'Romantic at heart ❤️',
        location: 'California, USA',
        relationship_status: 'Married',
        avatar_url: '/images/default-avatar.png',
        cover_photo_url: '/images/default-cover.jpg',
        is_verified: true,
        is_public: true,
        created_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0
      }
    };
    
    const user = mockUsers[username];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user's love stories
app.get('/api/users/:username/stories', async (req, res) => {
  try {
    const { username } = req.params;
    
    // For demo, return some stories
    const result = await pool.query(`
      SELECT ls.*, 
             COUNT(DISTINCT sl.id) as likes_count,
             COUNT(DISTINCT sc.id) as comments_count
      FROM love_stories ls
      LEFT JOIN story_likes sl ON ls.id = sl.story_id
      LEFT JOIN story_comments sc ON ls.id = sc.story_id
      WHERE ls.couple_names ILIKE $1 OR $1 = 'currentuser'
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

// Get user's followers count
app.get('/api/users/:username/followers/count', async (req, res) => {
  try {
    // Mock data for demo
    res.json({ count: 42 });
  } catch (error) {
    console.error('Error fetching followers count:', error);
    res.status(500).json({ error: 'Failed to fetch followers count' });
  }
});

// Get user's following count
app.get('/api/users/:username/following/count', async (req, res) => {
  try {
    // Mock data for demo
    res.json({ count: 37 });
  } catch (error) {
    console.error('Error fetching following count:', error);
    res.status(500).json({ error: 'Failed to fetch following count' });
  }
});

// ========================
// LOVE STORIES API ROUTES
// ========================

// Get all stories
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

// Create new story
app.post('/api/stories', async (req, res) => {
  try {
    const {
      coupleNames,
      storyTitle,
      loveStory,
      category,
      mood,
      togetherSince,
      allowComments = true,
      anonymousPost = false
    } = req.body;

    // Validate required fields
    if (!coupleNames || !storyTitle || !loveStory || !category || !mood) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO love_stories 
       (couple_names, story_title, love_story, category, mood, together_since, allow_comments, anonymous_post) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        anonymousPost ? 'Anonymous Couple' : coupleNames,
        storyTitle,
        loveStory,
        category,
        mood,
        togetherSince,
        allowComments,
        anonymousPost
      ]
    );

    const newStory = result.rows[0];
    
    // Get the full story with counts
    const fullStory = await pool.query(`
      SELECT 
        ls.*,
        0 as likes_count,
        0 as comments_count,
        false as user_liked
      FROM love_stories ls
      WHERE ls.id = $1
    `, [newStory.id]);

    res.status(201).json(fullStory.rows[0]);
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Like a story
app.post('/api/stories/:id/like', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const userIP = req.ip || req.connection.remoteAddress;

    // Check if already liked
    const existingLike = await pool.query(
      'SELECT id FROM story_likes WHERE story_id = $1 AND user_ip = $2',
      [storyId, userIP]
    );

    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM story_likes WHERE story_id = $1 AND user_ip = $2',
        [storyId, userIP]
      );
    } else {
      // Like
      await pool.query(
        'INSERT INTO story_likes (story_id, user_ip) VALUES ($1, $2)',
        [storyId, userIP]
      );
    }

    // Get updated like count
    const likeCount = await pool.query(
      'SELECT COUNT(*) as count FROM story_likes WHERE story_id = $1',
      [storyId]
    );

    res.json({ 
      likes_count: parseInt(likeCount.rows[0].count),
      liked: existingLike.rows.length === 0
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Add comment
app.post('/api/stories/:id/comments', async (req, res) => {
  try {
    const storyId = parseInt(req.params.id);
    const { author = 'Anonymous', text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const result = await pool.query(
      'INSERT INTO story_comments (story_id, author_name, comment_text) VALUES ($1, $2, $3) RETURNING *',
      [storyId, author, text]
    );

    // Get updated comment count
    const commentCount = await pool.query(
      'SELECT COUNT(*) as count FROM story_comments WHERE story_id = $1',
      [storyId]
    );

    res.json({
      comment: result.rows[0],
      comments_count: parseInt(commentCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a story
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


app.use(express.static(path.join(__dirname, '..')));

// ========================
// CATCH-ALL ROUTE (should be LAST)
// ========================

app.use((req, res) => {
  // Check if it's an API route that wasn't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // For all other non-matched routes, send the 404 page
  res.status(404).sendFile(path.join(__dirname, '..', '404.html')); 
  // Make sure you have a '404.html' file in your root folder!
});

// ========================
// SERVER INITIALIZATION
// ========================

const startServer = async () => {
  try {
    // First initialize database connection
    const dbConnected = await initializeDatabaseConnection();
    
    if (dbConnected) {
      // Then create tables
      await createTables();
      await createUserTables();
      console.log('✅ Database initialization completed');
    } else {
      console.log('⚠️  Starting server without database connection');
    }
    
    const PORT = process.env.PORT || 3001;
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
      console.log(`📊 Database: ${dbConnected ? 'Connected' : 'Not connected'}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
    });
    
    // Handle server errors gracefully
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try these solutions:');
        console.log('   1. Run: kill -9 $(lsof -ti:3001)');
        console.log('   2. Or change PORT in your .env file to 3002');
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