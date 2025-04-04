const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  gamesPlayed: { type: Number, default: 0 },
  correctGuesses: { type: Number, default: 0 },
  averageAttempts: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 },
  totalPlaytime: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  canPlayDaily: { type: Boolean, default: true },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
