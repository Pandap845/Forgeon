const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { createThread, listThreads, getThread } = require('../controllers/threads_controller');

const router = express.Router();

router.use(authenticateToken);

router.get('/:id', getThread);
router.get('/', listThreads);
router.post('/', createThread);

module.exports = router;
