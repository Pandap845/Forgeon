const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createGroupsInvitation,
  getGroupsInvitations,
  getGroupsInvitationById,
  updateGroupsInvitation,
  deleteGroupsInvitation,
} = require('../controllers/groups_invitations_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createGroupsInvitation);
router.get('/', getGroupsInvitations);
router.get('/:id', getGroupsInvitationById);
router.patch('/:id', updateGroupsInvitation);
router.delete('/:id', deleteGroupsInvitation);

module.exports = router;
