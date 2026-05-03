const mongoose = require('mongoose');
const { Threads, Forum, Groups, GroupMemberships } = require('../models');
const userProgressionService = require('../services/userProgressionService');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

async function createThread(req, res) {
  try {
    const { title, description, imageUrl, publishTo, group, forum } = req.body;
    if (!title || !description || !publishTo) {
      return res.status(400).json({ message: 'title, description and publishTo are required.' });
    }

    if (publishTo === 'group') {
      if (!group || !isObjectId(group)) return res.status(400).json({ message: 'Valid group id is required.' });
      // assert membership
      const membership = await GroupMemberships.findOne({ group, user: req.user.userId });
      if (!membership) return res.status(403).json({ message: 'Only group members can post to this group.' });
    }

    if (publishTo === 'forum') {
      if (!forum || !isObjectId(forum)) return res.status(400).json({ message: 'Valid forum id is required.' });
      const forumDoc = await Forum.findOne({ _id: forum, isDeleted: { $ne: true } });
      if (!forumDoc) return res.status(404).json({ message: 'Forum not found.' });
    }

    const thread = await Threads.create({
      title,
      description,
      imageUrl,
      publishTo,
      author: req.user.userId,
      group: publishTo === 'group' ? group : null,
      forum: publishTo === 'forum' ? forum : null,
      lastActivityBy: req.user.userId,
      lastActivityAt: new Date(),
    });

    userProgressionService
      .afterThreadCreated(req.user.userId, { imageUrl })
      .catch((err) => console.warn('progression afterThreadCreated', err));

    return res.status(201).json(thread);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// List recent threads for homepage: include general, forum (public), and group threads where user is member
async function listThreads(req, res) {
  try {
    const actorId = req.user && req.user.userId;
    const limit = Math.min(100, parseInt(req.query.limit || '10', 10));

    // Cleanup: soft-delete threads that are "floating" (publishTo=forum but forum missing)
    try {
      const orphans = await Threads.aggregate([
        { $match: { publishTo: 'forum', isDeleted: false } },
        { $lookup: { from: 'forums', localField: 'forum', foreignField: '_id', as: 'forumDoc' } },
        { $match: { $or: [ { forum: null }, { 'forumDoc.0': { $exists: false } } ] } },
        { $project: { _id: 1 } }
      ]).allowDiskUse(false);
      if (orphans && orphans.length) {
        const orphanIds = orphans.map(o => o._id);
        await Threads.updateMany({ _id: { $in: orphanIds } }, { $set: { isDeleted: true } });
      }
    } catch (cleanupErr) {
      console.warn('Failed to cleanup orphan forum threads', cleanupErr);
    }

    // if a forum filter is provided, return only threads for that forum
    const forumFilter = req.query.forum;
    let query;
    if (forumFilter) {
      // accept forum id, slug or name
      let forumIdToUse = null;
      if (isObjectId(forumFilter)) {
        forumIdToUse = forumFilter;
      } else {
        // try find by slug or exact case-insensitive name
        const forumDoc = await Forum.findOne({
          $or: [
            { slug: forumFilter },
            { name: forumFilter },
            { name: new RegExp('^' + forumFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
          ],
        }).select('_id').lean();
        if (forumDoc) forumIdToUse = forumDoc._id;
      }

      if (forumIdToUse) {
        query = { isDeleted: false, publishTo: 'forum', forum: forumIdToUse };
      } else {
        // forum not found - return empty list to avoid leaking other forums' threads
        return res.status(200).json([]);
      }
    } else {
      // get groups where user is member
      let memberGroupIds = [];
      if (actorId) {
        const memberships = await GroupMemberships.find({ user: actorId }).select('group');
        memberGroupIds = memberships.map((m) => m.group);
      }

      query = {
        isDeleted: false,
        $or: [
          { publishTo: 'general' },
          { publishTo: 'forum', forum: { $exists: true, $ne: null } },
          { $and: [{ publishTo: 'group' }, { group: { $in: memberGroupIds } }] },
        ],
      };
    }

    const threads = await Threads.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'username avatarUrl')
      .populate('group', 'name')
      .populate('forum', 'name slug')
      .lean();

    return res.status(200).json(threads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Get single thread by id
async function getThread(req, res) {
  try {
    const id = req.params.id;
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid thread id.' });

    const thread = await Threads.findOne({ _id: id, isDeleted: false })
      .populate('author', 'username avatarUrl')
      .populate('forum', 'name slug description')
      .populate('group', 'name')
      .lean();

    if (!thread) return res.status(404).json({ message: 'Thread not found.' });
    return res.status(200).json(thread);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createThread,
  listThreads,
  getThread,
};
