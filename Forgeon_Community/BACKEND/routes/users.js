const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  createUser,
  loginUser,
  logoutUser,
  getBadgeCatalog,
  getUsers,
  getUserById,
  updateUser,
  uploadUserAvatar,
  deleteUser,
} = require('../controllers/users_controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const profilePicturesDir = path.resolve(__dirname, '../uploads/profile-pictures');
fs.mkdirSync(profilePicturesDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profilePicturesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/badge-catalog', getBadgeCatalog);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/', createUser);
router.use(authenticateToken);

router.post('/avatar', avatarUpload.single('avatar'), uploadUserAvatar);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

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
