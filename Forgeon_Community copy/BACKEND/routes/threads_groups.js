const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createGroupThread,
  getGroupThreads,
  getGroupThreadById,
  updateGroupThread,
  deleteGroupThread,
} = require('../controllers/threads_groups_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createGroupThread);
router.get('/', getGroupThreads);
router.get('/:id', getGroupThreadById);
router.patch('/:id', updateGroupThread);
router.delete('/:id', deleteGroupThread);

module.exports = router;
