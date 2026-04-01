const express = require('express');
const multer = require('multer');
const router = express.Router();

const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const upload = require('../middleware/upload');
const {
  uploadVideo,
  listVideos,
  getVideo,
  streamVideo,
  deleteVideo,
  getStreamToken,
} = require('../controllers/videoController');

router.get('/', auth, listVideos);

router.post(
  '/upload',
  auth,
  requireRole('editor', 'admin'),
  (req, res, next) => {
    // Inline Multer error handler — Multer errors don't propagate to global error handler
    upload.single('video')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 500}MB.`,
          });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  uploadVideo
);

router.get('/:id/stream', streamVideo);
router.get('/:id/stream-token', auth, getStreamToken);
router.get('/:id', auth, getVideo);
router.delete('/:id', auth, requireRole('editor', 'admin'), deleteVideo);

module.exports = router;
