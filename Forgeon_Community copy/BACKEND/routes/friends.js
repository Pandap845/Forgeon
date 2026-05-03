const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createFriend,
  getFriends,
  getFriendById,
  deleteFriend,
} = require('../controllers/friends_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createFriend);
router.get('/', getFriends);
router.get('/:id', getFriendById);
router.delete('/:id', deleteFriend);

module.exports = router;
