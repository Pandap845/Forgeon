const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createForum,
  listForums,
  getForum,
  updateForum,
  deleteForum,
} = require('../controllers/forums_controller');

const router = express.Router();

// Require authentication for all forum operations (per team instruction)
router.use(authenticateToken);

router.get('/', listForums);
router.post('/', createForum);
router.get('/:id', getForum);
router.put('/:id', updateForum);
router.delete('/:id', deleteForum);

module.exports = router;
