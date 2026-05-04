const mongoose = require('mongoose');
const { Threads, Groups, GroupMemberships } = require('../models');
const { PUBLIC_USER_AUTHOR_FIELDS, mapThreadsAuthors, mapThreadAuthor } = require('../utils/publicAuthor');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

async function assertMember(groupId, userId) {
  const group = await Groups.findOne({ _id: groupId, isDeleted: false, isArchived: false });
  if (!group) {
    return { ok: false, status: 404, message: 'Group not found.' };
  }

  const membership = await GroupMemberships.findOne({ group: groupId, user: userId });
  if (!membership) {
    return { ok: false, status: 403, message: 'Only group members can access group threads.' };
  }

  return { ok: true };
}

async function createGroupThread(req, res) {
  try {
    const { title, description, imageUrl, group } = req.body;
    if (!title || !description || !group) {
      return res.status(400).json({ message: 'title, description and group are required.' });
    }
    if (!isObjectId(group)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }

    const memberCheck = await assertMember(group, req.user.userId);
    if (!memberCheck.ok) {
      return res.status(memberCheck.status).json({ message: memberCheck.message });
    }

    const thread = await Threads.create({
      title,
      description,
      imageUrl,
      publishTo: 'group',
      author: req.user.userId,
      group,
      lastActivityBy: req.user.userId,
      lastActivityAt: new Date(),
    });

    return res.status(201).json(thread);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getGroupThreads(req, res) {
  try {
    const { group } = req.query;
    if (!group || !isObjectId(group)) {
      return res.status(400).json({ message: 'Valid group query parameter is required.' });
    }

    const memberCheck = await assertMember(group, req.user.userId);
    if (!memberCheck.ok) {
      return res.status(memberCheck.status).json({ message: memberCheck.message });
    }

    const threads = await Threads.find({
      group,
      publishTo: 'group',
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .populate('author', PUBLIC_USER_AUTHOR_FIELDS)
      .populate('group', 'name')
      .lean();

    return res.status(200).json(mapThreadsAuthors(threads));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getGroupThreadById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid thread id.' });
    }

    const thread = await Threads.findOne({ _id: id, publishTo: 'group', isDeleted: false })
      .populate('author', PUBLIC_USER_AUTHOR_FIELDS)
      .populate('group', 'name')
      .lean();
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    const memberCheck = await assertMember(thread.group._id, req.user.userId);
    if (!memberCheck.ok) {
      return res.status(memberCheck.status).json({ message: memberCheck.message });
    }

    return res.status(200).json(mapThreadAuthor(thread));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateGroupThread(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid thread id.' });
    }

    const thread = await Threads.findOne({ _id: id, publishTo: 'group', isDeleted: false });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    const memberCheck = await assertMember(thread.group, req.user.userId);
    if (!memberCheck.ok) {
      return res.status(memberCheck.status).json({ message: memberCheck.message });
    }

    if (String(thread.author) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Only the author can update this thread.' });
    }

    const { title, description, imageUrl } = req.body;
    if (title !== undefined) thread.title = title;
    if (description !== undefined) thread.description = description;
    if (imageUrl !== undefined) thread.imageUrl = imageUrl;
    thread.lastActivityBy = req.user.userId;
    thread.lastActivityAt = new Date();
    await thread.save();

    return res.status(200).json(thread);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteGroupThread(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid thread id.' });
    }

    const thread = await Threads.findOne({ _id: id, publishTo: 'group', isDeleted: false });
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    const memberCheck = await assertMember(thread.group, req.user.userId);
    if (!memberCheck.ok) {
      return res.status(memberCheck.status).json({ message: memberCheck.message });
    }

    if (String(thread.author) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Only the author can delete this thread.' });
    }

    thread.isDeleted = true;
    thread.lastActivityBy = req.user.userId;
    thread.lastActivityAt = new Date();
    await thread.save();

    return res.status(200).json({ message: 'Thread deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createGroupThread,
  getGroupThreads,
  getGroupThreadById,
  updateGroupThread,
  deleteGroupThread,
};
