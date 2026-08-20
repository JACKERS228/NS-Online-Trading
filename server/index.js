const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('./db');
const engine = require('./engine/simulation');
const { router: authRouter } = require('./routes/auth');
const marketRouter = require('./routes/market');
const tradeRouter = require('./routes/trade');
const wizardRouter = require('./routes/wizard');
const auctionRouter = require('./routes/auction');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware with security headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/wizard', wizardRouter);
app.use('/api/auction', auctionRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: Date.now(),
    clientsConnected: engine.subscribers.size
  });
});

// Serve frontend in production build if present
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client not built yet. Run in development mode.');
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await db.init();
    await engine.start();

    app.listen(PORT, () => {
      console.log(`[Server] NationStates Online Trading Server running on http://localhost:${PORT}`);
      console.log(`[Server] Real-time market feed broadcasting on http://localhost:${PORT}/api/market/stream`);
    });
  } catch (err) {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  }
}

startServer();
