const mongoose = require('mongoose');
const { Groups, Category, User, GroupMemberships } = require('../models');
const userProgressionService = require('../services/userProgressionService');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function isEligibleToCreateGroups(userDoc) {
  const createdAt = new Date(userDoc.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAt.getTime() >= msInWeek;
}

// Creates a group owned by the authenticated user.
async function createGroup(req, res) {
  try {
    const creatorId = req.user.userId;
    const { name, description, category, coverImageUrl, iconImageUrl } = req.body;
    const coverFile = req.files?.coverImage?.[0];
    const iconFile = req.files?.iconImage?.[0];
    const finalCoverImageUrl = coverFile ? `/uploads/groups/${coverFile.filename}` : coverImageUrl;
    const finalIconImageUrl = iconFile ? `/uploads/groups/${iconFile.filename}` : iconImageUrl;

    if (!name || !description || !category) {
      return res.status(400).json({ message: 'name, description and category are required.' });
    }
    if (!finalCoverImageUrl || !finalIconImageUrl) {
      return res.status(400).json({ message: 'coverImage and iconImage are required.' });
    }
    if (!isObjectId(category)) {
      return res.status(400).json({ message: 'Invalid category id.' });
    }

    const creator = await User.findOne({ _id: creatorId, isDeleted: false });
    if (!creator) {
      return res.status(404).json({ message: 'Creator user not found.' });
    }
    if (!isEligibleToCreateGroups(creator)) {
      return res.status(403).json({ message: 'Account must be at least 1 week old to create groups.' });
    }

    const categoryDoc = await Category.findOne({ _id: category, isDeleted: false });
    if (!categoryDoc) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const group = await Groups.create({
      name: String(name).trim(),
      description,
      category,
      coverImageUrl: finalCoverImageUrl || '',
      iconImageUrl: finalIconImageUrl || '',
      creator: creatorId,
      memberCount: 1,
      isArchived: false,
      isDeleted: false,
    });

    await GroupMemberships.updateOne(
      { group: group._id, user: creatorId },
      {
        $setOnInsert: {
          group: group._id,
          user: creatorId,
          role: 'owner',
          joinedAt: new Date(),
          invitedBy: null,
        },
      },
      { upsert: true }
    );

    creator.groupsCount = (creator.groupsCount || 0) + 1;
    await creator.save();

    userProgressionService.afterGroupCreated(creatorId).catch((err) => console.warn('progression afterGroupCreated', err));

    return res.status(201).json(group);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Returns groups with optional creator filters.
async function getGroups(req, res) {
  try {
    const query = { isDeleted: false };
    const { creator, createdBy } = req.query;

    if (creator !== undefined) {
      if (!isObjectId(creator)) {
        return res.status(400).json({ message: 'Invalid creator id.' });
      }
      query.creator = creator;
    }

    if (createdBy !== undefined) {
      if (createdBy === 'me') {
        query.creator = req.user.userId;
      } else {
        return res.status(400).json({ message: 'createdBy only supports value "me".' });
      }
    }

    const groups = await Groups.find(query)
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .populate('creator', 'username email avatarUrl');

    return res.status(200).json(groups);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Returns one group by id.
async function getGroupById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }

    const group = await Groups.findOne({ _id: id, isDeleted: false })
      .populate('category', 'name')
      .populate('creator', 'username email avatarUrl');
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    return res.status(200).json(group);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Updates a group when requested by its creator.
async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }

    const group = await Groups.findOne({ _id: id, isDeleted: false });
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (String(group.creator) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Only the group creator can update this group.' });
    }

    const { name, description, category, coverImageUrl, iconImageUrl, isArchived } = req.body;

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ message: 'name cannot be empty.' });
      }
      group.name = normalizedName;
    }
    if (description !== undefined) group.description = description;
    if (coverImageUrl !== undefined) group.coverImageUrl = coverImageUrl;
    if (iconImageUrl !== undefined) group.iconImageUrl = iconImageUrl;
    if (isArchived !== undefined) group.isArchived = Boolean(isArchived);

    if (category !== undefined) {
      if (!isObjectId(category)) {
        return res.status(400).json({ message: 'Invalid category id.' });
      }
      const categoryDoc = await Category.findOne({ _id: category, isDeleted: false });
      if (!categoryDoc) {
        return res.status(404).json({ message: 'Category not found.' });
      }
      group.category = category;
    }

    await group.save();
    return res.status(200).json(group);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Soft-deletes a group when requested by its creator.
async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }

    const group = await Groups.findOne({ _id: id, isDeleted: false });
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    if (String(group.creator) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Only the group creator can delete this group.' });
    }

    group.isDeleted = true;
    await group.save();

    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
};
