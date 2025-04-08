const createApp = require('./app');
const logger = require('./config/logger');
const http = require('http');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 3001;
const app = createApp();
const server = http.createServer(app);

socketService.init(server);

server.on('error', (error) => {
  logger.error(`Server error: ${error.message}`);
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Shutting down.`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
