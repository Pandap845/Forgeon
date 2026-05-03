const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createFriendsInvitation,
  getFriendsInvitations,
  getFriendsInvitationById,
  updateFriendsInvitation,
  deleteFriendsInvitation,
} = require('../controllers/friends_invitations_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createFriendsInvitation);
router.get('/', getFriendsInvitations);
router.get('/:id', getFriendsInvitationById);
router.patch('/:id', updateFriendsInvitation);
router.delete('/:id', deleteFriendsInvitation);

module.exports = router;
