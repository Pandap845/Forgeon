const { User, Threads, Comments, GroupMemberships, Friends } = require('../models');
const {
  ensureProgressionFields,
  getLevelFromXp,
  syncFrameBadgesForLevel,
  pushBadge,
  XP,
} = require('../utils/forgeonProgression');

async function saveProgressionState(userDoc) {
  ensureProgressionFields(userDoc);
  userDoc.level = getLevelFromXp(userDoc.experiencePoints);
  syncFrameBadgesForLevel(userDoc);
  await userDoc.save();
  return userDoc;
}

async function grantXp(userId, amount) {
  if (!amount) return null;
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) return null;
  ensureProgressionFields(user);
  user.experiencePoints = (user.experiencePoints || 0) + amount;
  return saveProgressionState(user);
}

async function afterUserRegistered(userId) {
  return grantXp(userId, XP.REGISTER);
}

async function afterThreadCreated(userId, threadPayload) {
  const user = await grantXp(userId, XP.THREAD);
  if (!user) return;
  if (threadPayload && threadPayload.imageUrl && String(threadPayload.imageUrl).trim()) {
    await grantXp(userId, XP.THREAD_IMAGE_BONUS);
    const u2 = await User.findById(userId);
    if (u2 && pushBadge(u2, 'thread_visionary')) await u2.save();
  }
  const count = await Threads.countDocuments({ author: userId, isDeleted: false });
  if (count === 1) {
    const u3 = await User.findById(userId);
    if (u3 && pushBadge(u3, 'first_thread')) await u3.save();
  }
}

async function afterCommentCreated(userId) {
  await grantXp(userId, XP.COMMENT);
  const n = await Comments.countDocuments({ author: userId, isDeleted: false });
  if (n >= 10) {
    const u = await User.findById(userId);
    if (u && pushBadge(u, 'voice_of_forum')) await u.save();
  }
}

async function afterForumCreated(userId) {
  await grantXp(userId, XP.FORUM_CREATED);
  const u = await User.findById(userId);
  if (u && pushBadge(u, 'forum_founder')) await u.save();
}

async function afterGroupCreated(userId) {
  await grantXp(userId, XP.GROUP_CREATED);
  const u = await User.findById(userId);
  if (u && pushBadge(u, 'guild_forge')) await u.save();
}

async function afterGroupMembershipCreated(userId, role) {
  await grantXp(userId, XP.GROUP_JOIN);
  if (role === 'member') {
    const u = await User.findById(userId);
    if (u && pushBadge(u, 'squad_joined')) await u.save();
  }
}

async function afterFriendCreated(userId) {
  await grantXp(userId, XP.FRIEND_ADDED);
  const n = await Friends.countDocuments({
    $or: [{ userA: userId }, { userB: userId }],
  });
  if (n >= 1) {
    const u = await User.findById(userId);
    if (u && pushBadge(u, 'ally_link')) await u.save();
  }
}

module.exports = {
  grantXp,
  saveProgressionState,
  afterUserRegistered,
  afterThreadCreated,
  afterCommentCreated,
  afterForumCreated,
  afterGroupCreated,
  afterGroupMembershipCreated,
  afterFriendCreated,
};
