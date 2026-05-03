const express = require('express');
const {
  createUser,
  loginUser,
  logoutUser,
  getBadgeCatalog,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/users_controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/badge-catalog', getBadgeCatalog);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/', createUser);
router.use(authenticateToken);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
