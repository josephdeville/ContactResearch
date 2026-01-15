const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../../config/config');
const db = require('../db/client');

// Import routes
const researchRoutes = require('./routes/research');
const exportRoutes = require('./routes/export');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/research', researchRoutes);
app.use('/api/export', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(config.server.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   GTM Contact Intelligence System                         ║
║   Server running on port ${PORT}                            ║
║   Environment: ${config.server.nodeEnv}                           ║
╚═══════════════════════════════════════════════════════════╝

Available endpoints:
  GET  /health                                    - Health check
  POST /api/research                              - Start research job
  GET  /api/research/:jobId                       - Get job status
  GET  /api/contacts/:contactId                   - Get contact dossier
  GET  /api/signals/:contactId                    - Get intelligence signals
  GET  /api/playbook/:contactId                   - Get GTM playbook
  GET  /api/linkedin/recent-activity/:contactId   - Get LinkedIn activity
  GET  /api/linkedin/engagement-patterns/:contactId - Get engagement analysis
  GET  /api/export/clay/:contactId                - Export to Clay format
  GET  /api/export/csv                            - Export multiple contacts to CSV

LinkedIn scraping is ACTIVE - respecting rate limits
`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await db.end();
  process.exit(0);
});

module.exports = app;
