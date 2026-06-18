import 'dotenv/config';
// server entry
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { initSocket } from './sockets/index.js';
import { startStatusCleanupJob } from './jobs/cleanupStatuses.js';
import webpush from 'web-push';
import { db } from './config/db.js';
import { sql } from 'drizzle-orm';

// VAPID keys for web push notifications
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:aaisali228@gmail.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDJFeCC1ilNK1w8J-IvPFsCDF8brufd8uxPpmb12hFj8_GXE_tbSBoP1hfEvsFMV1fHA96yiQVHP-CAvocj8dXY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'jCm4qymIDwUsordGTdlm-ss5sVkFD8FAWmHmpOK4vEM';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Routes
import authRoutes    from './routes/auth.routes.js';
import chatRoutes    from './routes/chat.routes.js';
import userRoutes    from './routes/user.routes.js';
import statusRoutes  from './routes/status.routes.js';
import miscRoutes    from './routes/misc.routes.js';
import labelRoutes   from './routes/label.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));


const httpServer = createServer(app);

// CORS
const allowedOrigins = [
  'https://chatyapp.online',
  'https://www.chatyapp.online',
  'http://localhost:5173',
    'http://localhost:5173/',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));


//
// Body parsing

app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// API Routes
app.use('/api/auth',     authRoutes);
app.use('/api/chats',    chatRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/labels',   labelRoutes);
app.use('/api',          miscRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initSocket(io);

// Start cron jobs
startStatusCleanupJob();

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Auto-create push_subscriptions table if missing
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        subscription TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS push_sub_user_id_idx ON push_subscriptions (user_id);
    `);
    console.log('✅ Database: push_subscriptions table verified/created.');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }

  // Auto-migrate: per-admin isolation columns for welcome_messages and labels
  try {
    await db.execute(sql`ALTER TABLE welcome_messages ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE labels ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_name_key`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS labels_name_admin_idx ON labels (name, admin_id)`);
    console.log('✅ Database: per-admin isolation columns verified.');
  } catch (err) {
    console.error('❌ Database per-admin migration error:', err);
  }
});
