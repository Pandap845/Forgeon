const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createGroupMembership,
  getGroupMemberships,
  getGroupMembershipById,
  updateGroupMembership,
  deleteGroupMembership,
} = require('../controllers/group_memberships_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createGroupMembership);
router.get('/', getGroupMemberships);
router.get('/:id', getGroupMembershipById);
router.patch('/:id', updateGroupMembership);
router.delete('/:id', deleteGroupMembership);

module.exports = router;
