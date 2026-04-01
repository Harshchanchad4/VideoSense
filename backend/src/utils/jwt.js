const jwt = require('jsonwebtoken');

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Short-lived token for video streaming (no Authorization header possible on <video> src)
const signStreamToken = (videoId, userId) => {
  return jwt.sign({ videoId, userId, type: 'stream' }, process.env.JWT_SECRET, {
    expiresIn: '60s',
  });
};

const verifyStreamToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== 'stream') throw new Error('Invalid token type');
  return decoded;
};

module.exports = { signToken, verifyToken, signStreamToken, verifyStreamToken };
