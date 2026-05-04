const { User, Groups, Threads } = require('../models');
const { publicAuthorFromLean, PUBLIC_USER_AUTHOR_FIELDS } = require('../utils/publicAuthor');

const ALLOWED_SCOPES = new Set(['all', 'groups', 'threads', 'users']);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseScope(rawScope) {
  const scope = String(rawScope || 'all').toLowerCase().trim();
  return ALLOWED_SCOPES.has(scope) ? scope : null;
}

function parseLimit(rawLimit) {
  const n = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(n)) return 10;
  return Math.min(Math.max(n, 1), 50);
}

function mapUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    level: user.level,
    bio: user.bio,
  };
}

function mapGroup(group) {
  return {
    id: group._id,
    name: group.name,
    description: group.description,
    iconImageUrl: group.iconImageUrl,
    coverImageUrl: group.coverImageUrl,
    memberCount: group.memberCount,
    category: group.category
      ? {
          id: group.category._id,
          name: group.category.name,
        }
      : null,
    creator: group.creator
      ? (() => {
          const c = publicAuthorFromLean(group.creator);
          return { id: c._id, username: c.username };
        })()
      : null,
  };
}

function mapThread(thread) {
  return {
    id: thread._id,
    title: thread.title,
    description: thread.description,
    imageUrl: thread.imageUrl,
    publishTo: thread.publishTo,
    likesCount: thread.likesCount,
    commentsCount: thread.commentsCount,
    author: thread.author
      ? (() => {
          const a = publicAuthorFromLean(thread.author);
          return { id: a._id, username: a.username };
        })()
      : null,
    group: thread.group
      ? {
          id: thread.group._id,
          name: thread.group.name,
        }
      : null,
  };
}

async function search(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const scope = parseScope(req.query.scope);
    const limit = parseLimit(req.query.limit);

    if (!scope) {
      return res.status(400).json({ message: 'Invalid scope. Use all, groups, threads, or users.' });
    }

    if (!q) {
      return res.status(200).json({
        query: '',
        scope,
        counts: { groups: 0, threads: 0, users: 0 },
        results: { groups: [], threads: [], users: [] },
      });
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const shouldSearchGroups = scope === 'all' || scope === 'groups';
    const shouldSearchThreads = scope === 'all' || scope === 'threads';
    const shouldSearchUsers = scope === 'all' || scope === 'users';

    const [groups, threads, users] = await Promise.all([
      shouldSearchGroups
        ? Groups.find({
            isDeleted: false,
            isArchived: false,
            $or: [{ name: regex }, { description: regex }],
          })
            .sort({ memberCount: -1, createdAt: -1 })
            .limit(limit)
            .populate('category', 'name')
            .populate('creator', PUBLIC_USER_AUTHOR_FIELDS)
        : Promise.resolve([]),
      shouldSearchThreads
        ? Threads.find({
            isDeleted: false,
            $or: [{ title: regex }, { description: regex }],
          })
            .sort({ lastActivityAt: -1, createdAt: -1 })
            .limit(limit)
            .populate('author', PUBLIC_USER_AUTHOR_FIELDS)
            .populate('group', 'name')
        : Promise.resolve([]),
      shouldSearchUsers
        ? User.find({
            isDeleted: false,
            $or: [{ username: regex }, { email: regex }, { bio: regex }],
          })
            .sort({ level: -1, createdAt: -1 })
            .limit(limit)
        : Promise.resolve([]),
    ]);

    const mappedGroups = groups.map(mapGroup);
    const mappedThreads = threads.map(mapThread);
    const mappedUsers = users.map(mapUser);

    return res.status(200).json({
      query: q,
      scope,
      counts: {
        groups: mappedGroups.length,
        threads: mappedThreads.length,
        users: mappedUsers.length,
      },
      results: {
        groups: mappedGroups,
        threads: mappedThreads,
        users: mappedUsers,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  search,
};
