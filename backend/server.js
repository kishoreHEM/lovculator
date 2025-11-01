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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

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

// ========================
// REDIRECTS & STATIC ROUTES
// ========================

// Specific page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/home', (req, res) => {
  res.redirect('/');
});

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

// ========================
// CATCH-ALL ROUTE (should be LAST)
// ========================

app.get('*', (req, res) => {
  // Don't serve API routes as HTML
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Serve index.html for any other unknown routes (SPA behavior)
  res.sendFile(path.join(__dirname, '..', 'index.html'));
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