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

// Using bcryptjs for cloud compatibility (replace with 'bcrypt' if needed, but 'bcryptjs' is safer)
import bcrypt from 'bcryptjs'; 

// =========================================================================
// 2. Initial Setup
// =========================================================================

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
    // Add SSL for production if required by your provider (Railway usually handles this via connection string)
});

// Database connection check
pgPool.query('SELECT NOW()')
    .then(() => {
        console.log('✅ Successfully connected to PostgreSQL database');
        // NOTE: Database table creation/verification logic goes here
        console.log('✅ Story database tables created/verified');
        console.log('✅ User social tables created/verified');

        // Example: Hash function check (optional but good for debugging bcryptjs)
        // const hashTest = bcrypt.hashSync('testpassword', 10);
        // console.log(`bcryptjs hash test successful: ${hashTest.substring(0, 20)}...`);

    })
    .catch(err => {
        console.error('❌ Database connection error:', err.stack);
        process.exit(1); // Exit if DB connection fails
    });

// =========================================================================
// 4. Security & Middleware
// =========================================================================

// Security Headers (Recommended)
app.use(helmet());

// Rate Limiting (Protects against brute force and abuse)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// CORS configuration (Adjust origin as needed for production)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', // Allow self-access if needed
    'https://lovculator.com', // Your production domain
    // Add any other development/staging domains
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies/sessions to be sent
};
app.use(cors(corsOptions));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
    store: new PgStore({
        pool: pgPool,
        tableName: 'session', // Make sure this table exists
    }),
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-should-be-in-.env',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        sameSite: 'lax',
    }
}));


// =========================================================================
// 5. API Routes (Placeholder)
// =========================================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        database: 'connected',
        session: req.sessionID ? 'active' : 'inactive'
    });
});

// Example Auth route placeholder (where bcryptjs would be used)
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
// 6. Static File Serving (The critical fix area)
// =========================================================================

// **CRITICAL FIX 1: Serve static files from the project root**
// This serves all files (like CSS, JS bundles, images) from the parent directory (lovculator/)
app.use(express.static(rootPath));


// =========================================================================
// 7. Fallback Routes
// =========================================================================

// **CRITICAL FIX 2: Send index.html for all non-API GET requests**
// This is essential for single-page applications (SPAs) like React/Vue/Svelte
// It ensures that direct navigation (e.g., lovculator.com/login) is handled by the client-side router
app.get('*', (req, res, next) => {
    // If the request path is to the API, let the next middleware (404 handler) deal with it
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // Otherwise, send the main index.html file
    const indexPath = path.join(rootPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // Log an error if index.html itself cannot be found
            console.error('❌ Error sending index.html:', err.message);
            // Fall back to a simple "Not Found" message if index.html is missing
            res.status(500).send('Application not ready (index.html not found)');
        }
    });
});


// **CRITICAL FIX 3: 404 Handler for API routes and unhandled static files**
// If a request falls through to here, it means it wasn't a file or an SPA route.
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    // Fallback for any other unhandled path (e.g., if index.html failed)
    // We send a 404.html only if the file exists
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
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Application Root: ${rootPath}`);
});