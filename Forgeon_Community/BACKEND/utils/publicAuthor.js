/**
 * Public-facing author/creator shape for threads, comments, forums, etc.
 * Covers soft-deleted users (isDeleted), hard-deleted users (populate returns null),
 * and bare ObjectId refs when the User document no longer exists.
 */
function publicAuthorFromLean(author) {
  if (author == null) {
    return { _id: null, username: 'User Deleted', avatarUrl: '' };
  }
  if (typeof author === 'string' && /^[a-f0-9]{24}$/i.test(author)) {
    return { _id: author, username: 'User Deleted', avatarUrl: '' };
  }
  if (author != null && typeof author === 'object' && author._bsontype === 'ObjectID') {
    return { _id: author, username: 'User Deleted', avatarUrl: '' };
  }
  const id = author._id;
  if (!id) {
    return { _id: null, username: 'User Deleted', avatarUrl: '' };
  }
  if (author.isDeleted === true) {
    return {
      _id: id,
      username: 'User Deleted',
      avatarUrl: '',
    };
  }
  return {
    _id: id,
    username: author.username,
    avatarUrl: author.avatarUrl || '',
  };
}

/** Fields to populate on User refs when exposing authors publicly. */
const PUBLIC_USER_AUTHOR_FIELDS = 'username avatarUrl isDeleted';

function mapThreadAuthor(thread) {
  if (!thread || typeof thread !== 'object') return thread;
  const out = { ...thread };
  if (out.author !== undefined) {
    out.author = publicAuthorFromLean(out.author);
  }
  return out;
}

function mapThreadsAuthors(threads) {
  if (!Array.isArray(threads)) return threads;
  return threads.map(mapThreadAuthor);
}

/** Group membership `user` payload (includes level, email hidden if deleted). */
function publicGroupMemberUserLean(user) {
  if (!user || !user._id) return user;
  const pub = publicAuthorFromLean(user);
  return {
    ...pub,
    email: user.isDeleted ? '' : user.email || '',
    level: Number(user.level) || 1,
  };
}

module.exports = {
  publicAuthorFromLean,
  PUBLIC_USER_AUTHOR_FIELDS,
  mapThreadAuthor,
  mapThreadsAuthors,
  publicGroupMemberUserLean,
};
