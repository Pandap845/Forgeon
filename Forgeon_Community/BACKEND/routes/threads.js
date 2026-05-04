const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { createThread, listThreads, getThread } = require('../controllers/threads_controller');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../uploads/threads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed.'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.use(authenticateToken);

router.get('/:id', getThread);
router.get('/', listThreads);
router.post('/', upload.single('threadImage'), createThread);

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }
  if (error && error.message === 'Only image files are allowed.') {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
});

module.exports = router;
