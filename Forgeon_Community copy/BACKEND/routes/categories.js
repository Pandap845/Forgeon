const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require('../controllers/categories_controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', createCategory);
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
