const createApp = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
