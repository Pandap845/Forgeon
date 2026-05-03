const express = require('express');
const { listComments, createComment, updateComment, deleteComment } = require('../controllers/comments_controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', listComments);
router.post('/', authenticateToken, createComment);
router.put('/:id', authenticateToken, updateComment);
router.delete('/:id', authenticateToken, deleteComment);

module.exports = router;
