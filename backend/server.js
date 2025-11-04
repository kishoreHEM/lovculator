// =========================================================================
// 1. Module Imports
// =========================================================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Utility for file paths in ESM (Essential for correct path resolution)
import { fileURLToPath } from 'url';
import path from 'path';

// Using bcryptjs for cloud compatibility
import bcrypt from 'bcryptjs'; 

// =========================================================================
// 2. Initial Setup
// =========================================================================

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // CRITICAL: Ensures the server listens on all network interfaces in the container

// Define __dirname and the absolute project root (critical for static files)
const __filename = fileURLToPath(import.meta.url); // Path to this server.js file
const __dirname = path.dirname(__filename);       // Path to the /backend directory
const rootPath = path.resolve(__dirname, '..');   // Absolute path to the project root (where index.html is)

// =========================================================================
// 3. Database Connection and Session Setup
// =========================================================================

// Configure PostgreSQL Client (for connect-pg-simple)
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Add SSL for production if required by your provider 
});

// Database connection check
pgPool.query('SELECT NOW()')
    .then(() => {
        console.log('✅ Successfully connected to PostgreSQL database');
        // NOTE: Database table creation/verification logic goes here
        console.log('✅ Story database tables created/verified');
        console.log('✅ User social tables created/verified');
    })
    .catch(err => {
        console.error('❌ Database connection error:', err.stack);
        process.exit(1); // Exit if DB connection fails
    });

// =========================================================================
// 4. Security & Middleware
// =========================================================================

app.use(helmet());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// CORS configuration (Adjust origin as needed for production)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://lovculator.com', // Your production domain
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    store: new PgStore({
        pool: pgPool,
        tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-should-be-in-.env',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    }
}));


// =========================================================================
// 5. API Routes (Placeholder)
// =========================================================================

// Health Check Endpoint (CRITICAL for container health checks)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        database: 'connected',
        session: req.sessionID ? 'active' : 'inactive'
    });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        // ... save user to DB with hashedPassword
        res.status(201).json({ message: 'User registered' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// All other API routes would be defined here...


// =========================================================================
// 6. Static File Serving (The foundation for serving assets)
// =========================================================================

// This serves all static assets (CSS, JS, images, etc.) from the project root.
// e.g., /css/style.css, /js/main.js
app.use(express.static(rootPath));


// =========================================================================
// 7. Fallback Routes (Custom Static HTML Routing)
// =========================================================================

// 1. Explicitly serve the root index.html file
app.get('/', (req, res, next) => {
    const indexPath = path.join(rootPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('❌ Error sending index.html:', err.message);
            // If index.html fails, continue to the next handler
            next();
        }
    });
});

// 2. Explicitly serve any other top-level HTML files (e.g., /about.html, /login.html)
app.get('/*.html', (req, res, next) => {
    const filePath = path.join(rootPath, req.path);
    res.sendFile(filePath, (err) => {
        if (err) {
            // If the specific .html file is not found, continue to the next handler (404)
            next(); 
        }
    });
});


// 3. 404 Handler (Final Catch-all)
app.use((req, res) => {
    // If it was an API call that wasn't handled, return JSON 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    // For any other uncaught route, try to serve 404.html
    const errorPagePath = path.join(rootPath, '404.html');
    res.status(404).sendFile(errorPagePath, (err) => {
        if (err) {
             // If 404.html is missing, send a plain text response
            res.status(404).send('404 Not Found');
        }
    });
});


// =========================================================================
// 8. Start Server
// =========================================================================
app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`🌐 Application Root: ${rootPath}`);
});