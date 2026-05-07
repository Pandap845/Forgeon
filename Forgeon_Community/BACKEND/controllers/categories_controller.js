const mongoose = require('mongoose');
const { Category } = require('../models');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

//idk i found this on internet and it works fr 
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Creates a new category or restores a soft-deleted category with the same name.
async function createCategory(req, res) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'name is required.' });
    }

    const normalizedName = String(name).trim();
    if (!normalizedName) {
      return res.status(400).json({ message: 'name cannot be empty.' });
    }

    const existing = await Category.findOne({
      name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' },
    });
    if (existing && !existing.isDeleted) {
      return res.status(409).json({ message: 'Category name already exists.' });
    }

    if (existing && existing.isDeleted) {
      existing.isDeleted = false;
      existing.description = description !== undefined ? description : existing.description;
      await existing.save();
      return res.status(200).json(existing);
    }

    const category = await Category.create({
      name: normalizedName,
      description,
    });

    return res.status(201).json(category);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Returns all active categories ordered by name.
async function getCategories(req, res) {
  try {
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1, createdAt: -1 });
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Returns a single active category by id.
async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid category id.' });
    }

    const category = await Category.findOne({ _id: id, isDeleted: false });
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    return res.status(200).json(category);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Updates editable fields of an active category.
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid category id.' });
    }

    const category = await Category.findOne({ _id: id, isDeleted: false });
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const { name, description } = req.body;
    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ message: 'name cannot be empty.' });
      }

      if (normalizedName.toLowerCase() !== String(category.name || '').toLowerCase()) {
        const nameTaken = await Category.exists({
          name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' },
          isDeleted: false,
          _id: { $ne: id },
        });
        if (nameTaken) {
          return res.status(409).json({ message: 'Category name already exists.' });
        }
      }
      category.name = normalizedName;
    }

    if (description !== undefined) {
      category.description = description;
    }

    await category.save();
    return res.status(200).json(category);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Soft-deletes an active category.
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid category id.' });
    }

    const category = await Category.findOne({ _id: id, isDeleted: false });
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    category.isDeleted = true;
    await category.save();

    return res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
