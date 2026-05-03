const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { search } = require('../controllers/search_controller');

const router = express.Router();

router.use(authenticateToken);
router.get('/', search);

module.exports = router;
