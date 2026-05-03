const Forum = require('../models/Forum');

function slugify(name) {
  return name.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

exports.createForum = async (req, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = slugify(name);
    const createdBy = (req.user && (req.user.userId || req.user.id || req.user._id)) || null;
    const forum = new Forum({ name, slug, description, imageUrl, createdBy });
    await forum.save();
    return res.status(201).json(forum);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Forum with that name already exists' });
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};

exports.listForums = async (_req, res) => {
  try {
    const forums = await Forum.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json(forums);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getForum = async (req, res) => {
  try {
    const forum = await Forum.findById(req.params.id).lean();
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    return res.json(forum);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.updateForum = async (req, res) => {
  try {
    const { name, description, imageUrl } = req.body;
    const updates = {};
    if (name) {
      updates.name = name;
      updates.slug = slugify(name);
    }
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const forum = await Forum.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!forum) return res.status(404).json({ error: 'Forum not found' });
    return res.json(forum);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Forum with that name already exists' });
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteForum = async (req, res) => {
  try {
    const forumId = req.params.id;
    const forum = await Forum.findById(forumId);
    if (!forum) return res.status(404).json({ error: 'Forum not found' });

    // find threads belonging to this forum
    const threads = await require('../models').Threads.find({ forum: forum._id }).select('_id').lean();
    const threadIds = (threads || []).map(t => t._id);

    // soft-delete comments belonging to those threads
    if (threadIds.length) {
      const Comments = require('../models').Comments;
      await Comments.updateMany({ thread: { $in: threadIds } }, { $set: { isDeleted: true } });
    }

    // soft-delete threads
    await require('../models').Threads.updateMany({ forum: forum._id }, { $set: { isDeleted: true } });

    // finally delete the forum document
    await Forum.findByIdAndDelete(forum._id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};
