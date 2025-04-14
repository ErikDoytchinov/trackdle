const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const logger = require('../config/logger');

exports.optionalProtect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      logger.info(`User ${req.user.email} authenticated via token`);
    } catch (err) {
      logger.error(`Token verification failed: ${err.message}`);
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};
