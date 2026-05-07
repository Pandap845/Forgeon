const jwt = require('jsonwebtoken');
const Models = require('../models');
const userProgressionService = require('../services/userProgressionService');
const { publicAuthorFromLean, PUBLIC_USER_AUTHOR_FIELDS } = require('../utils/publicAuthor');

const AUTH_COOKIE_NAME = 'forgeon_auth_token';

function extractTokenOptional(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = req.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const tokenFromCookie = cookieToken ? decodeURIComponent(cookieToken.slice(AUTH_COOKIE_NAME.length + 1)) : null;
  return bearerToken || tokenFromCookie;
}

async function listComments(req, res) {
  try {
    const threadId = req.query.thread;
    if (!threadId) return res.status(400).json({ message: 'thread query param is required.' });

    const comments = await Models.Comments.find({ thread: threadId, isDeleted: false })
      .sort({ createdAt: 1 })
      .populate('author', PUBLIC_USER_AUTHOR_FIELDS);

    // try to extract current user id (optional)
    let currentUserId = null;
    const token = extractTokenOptional(req);
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = payload && payload.userId ? payload.userId : null;
      } catch (e) {
        // ignore invalid token
      }
    }

    const out = (comments || []).map((c) => {
      const authorPub = c.author ? publicAuthorFromLean(c.author) : null;
      return {
        _id: c._id,
        content: c.content,
        likesCount: c.likesCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        author: authorPub,
        isMine: currentUserId ? String(c.author?._id) === String(currentUserId) : false,
      };
    });

    return res.status(200).json(out);
  } catch (error) {
    console.error('listComments error', error);
    return res.status(500).json({ message: error.message });
  }
}

async function createComment(req, res) {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { thread, content } = req.body;
    if (!thread || !content || String(content).trim() === '') return res.status(400).json({ message: 'thread and content are required.' });

    const threadDoc = await Models.Threads.findOne({ _id: thread, isDeleted: false });
    if (!threadDoc) return res.status(404).json({ message: 'Thread not found.' });
    if (threadDoc.publishTo === 'group' && threadDoc.group) {
      const groupDoc = await Models.Groups.findOne({ _id: threadDoc.group, isDeleted: false }).select('_id isArchived').lean();
      if (!groupDoc) return res.status(404).json({ message: 'Group not found.' });
      if (groupDoc.isArchived) return res.status(403).json({ message: 'This group is archived and read-only.' });
    }

    const comment = await Models.Comments.create({ thread: threadDoc._id, author: userId, content: String(content).trim() });

    // increment thread comments count
    await Models.Threads.updateOne({ _id: threadDoc._id }, { $inc: { commentsCount: 1 } });

    await comment.populate('author', PUBLIC_USER_AUTHOR_FIELDS);

    userProgressionService.afterCommentCreated(userId).catch((err) => console.warn('progression afterCommentCreated', err));

    return res.status(201).json({
      _id: comment._id,
      content: comment.content,
      likesCount: comment.likesCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author ? publicAuthorFromLean(comment.author.toObject ? comment.author.toObject() : comment.author) : null,
      isMine: true,
    });
  } catch (error) {
    console.error('createComment error', error);
    return res.status(500).json({ message: error.message });
  }
}

async function updateComment(req, res) {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const id = req.params.id;
    const { content } = req.body;
    if (!content || String(content).trim() === '') return res.status(400).json({ message: 'content is required.' });

    const comment = await Models.Comments.findOne({ _id: id, isDeleted: false });
    if (!comment) return res.status(404).json({ message: 'Comment not found.' });
    if (String(comment.author) !== String(userId)) return res.status(403).json({ message: 'You can only edit your own comments.' });

    comment.content = String(content).trim();
    await comment.save();
    await comment.populate('author', PUBLIC_USER_AUTHOR_FIELDS);

    return res.status(200).json({
      _id: comment._id,
      content: comment.content,
      likesCount: comment.likesCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author ? publicAuthorFromLean(comment.author.toObject ? comment.author.toObject() : comment.author) : null,
      isMine: true,
    });
  } catch (error) {
    console.error('updateComment error', error);
    return res.status(500).json({ message: error.message });
  }
}

async function deleteComment(req, res) {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const id = req.params.id;

    const comment = await Models.Comments.findOne({ _id: id, isDeleted: false });
    if (!comment) return res.status(404).json({ message: 'Comment not found.' });
    if (String(comment.author) !== String(userId)) return res.status(403).json({ message: 'You can only delete your own comments.' });

    comment.isDeleted = true;
    await comment.save();

    // decrement thread comment count 
    try {
      await Models.Threads.updateOne({ _id: comment.thread }, { $inc: { commentsCount: -1 } });
      const t = await Models.Threads.findById(comment.thread);
      if (t && t.commentsCount < 0) {
        t.commentsCount = 0;
        await t.save();
      }
    } catch (e) {
      // ignore
    }

    return res.status(200).json({ message: 'Comment deleted.' });
  } catch (error) {
    console.error('deleteComment error', error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  listComments,
  createComment,
  updateComment,
  deleteComment,
};
