import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { initSocket } from './sockets/index.js';
import { startStatusCleanupJob } from './jobs/cleanupStatuses.js';

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
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://chatapp.dofordollars.com',
  'http://chatapp.dofordollars.com'
];

app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
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
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initSocket(io);

// Start cron jobs
startStatusCleanupJob();

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
