const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  Groups,
  GroupMemberships,
  Friends,
  friends_invitation: FriendsInvitation,
  groups_invitation: GroupsInvitation,
} = require('../models');

/**
 * Run before removing the User document from MongoDB:
 * - Soft-delete all groups they created; remove memberships & group invitations for those groups.
 * - Remove their memberships in other groups.
 * - Remove friendships and friend invitations involving them.
 * - Remove group invitations they sent or received (by user id).
 */
async function runAccountDeletionSideEffects(userId) {
  if (!mongoose.isValidObjectId(userId)) return;
  const uid = new mongoose.Types.ObjectId(String(userId));

  const ownedGroups = await Groups.find({ creator: uid, isDeleted: false }).select('_id').lean();
  const ownedIds = (ownedGroups || []).map((g) => g._id);

  if (ownedIds.length) {
    await GroupMemberships.deleteMany({ group: { $in: ownedIds } });
    await Groups.updateMany({ _id: { $in: ownedIds } }, { $set: { isDeleted: true } });
    await GroupsInvitation.deleteMany({ group: { $in: ownedIds } });
  }

  await GroupMemberships.deleteMany({ user: uid });
  await Friends.deleteMany({ $or: [{ userA: uid }, { userB: uid }] });
  await FriendsInvitation.deleteMany({ $or: [{ sender: uid }, { recipient: uid }] });
  await GroupsInvitation.deleteMany({
    $or: [{ sender: uid }, { invitee: uid }],
  });
}

/** Best-effort removal of uploaded profile image from disk (BACKEND/uploads/profile-pictures). */
function tryRemoveUploadedProfilePicture(avatarUrl) {
  const s = String(avatarUrl || '').trim();
  if (!s.startsWith('/uploads/profile-pictures/')) return;
  const name = path.basename(s);
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return;
  const abs = path.join(__dirname, '..', 'uploads', 'profile-pictures', name);
  try {
    fs.unlinkSync(abs);
  } catch (_e) {
    // missing file or permission — ignore
  }
}

module.exports = {
  runAccountDeletionSideEffects,
  tryRemoveUploadedProfilePicture,
};
