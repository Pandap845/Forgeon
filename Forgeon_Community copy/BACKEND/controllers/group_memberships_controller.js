const mongoose = require('mongoose');
const { GroupMemberships, Groups, User } = require('../models');
const userProgressionService = require('../services/userProgressionService');
const { publicAuthorFromLean, publicGroupMemberUserLean, PUBLIC_USER_AUTHOR_FIELDS } = require('../utils/publicAuthor');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

async function getActorMembership(groupId, actorId) {
  return GroupMemberships.findOne({ group: groupId, user: actorId });
}

// Creates a group membership with ownership validations.
async function createGroupMembership(req, res) {
  try {
    const actorId = req.user.userId;
    const { group, user, role } = req.body;

    if (!group) {
      return res.status(400).json({ message: 'group is required.' });
    }
    if (!isObjectId(group)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }

    const targetUserId = user || actorId;
    if (!isObjectId(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const groupDoc = await Groups.findOne({ _id: group, isDeleted: false, isArchived: false });
    if (!groupDoc) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const targetUser = await User.findOne({ _id: targetUserId, isDeleted: false });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const actorMembership = await getActorMembership(group, actorId);
    const isSelfJoin = String(targetUserId) === String(actorId);
    if (!isSelfJoin && (!actorMembership || actorMembership.role !== 'owner')) {
      return res.status(403).json({ message: 'Only group owners can add other users.' });
    }

    const membershipExists = await GroupMemberships.exists({ group, user: targetUserId });
    if (membershipExists) {
      return res.status(409).json({ message: 'User is already a member of this group.' });
    }

    const normalizedRole = role === 'owner' ? 'owner' : 'member';
    if (normalizedRole === 'owner' && (!actorMembership || actorMembership.role !== 'owner')) {
      return res.status(403).json({ message: 'Only group owners can assign owner role.' });
    }

    const membership = await GroupMemberships.create({
      group,
      user: targetUserId,
      role: normalizedRole,
      invitedBy: isSelfJoin ? null : actorId,
      joinedAt: new Date(),
    });

    await Groups.updateOne({ _id: group }, { $inc: { memberCount: 1 } });

    userProgressionService
      .afterGroupMembershipCreated(targetUserId, normalizedRole)
      .catch((err) => console.warn('progression afterGroupMembershipCreated', err));

    return res.status(201).json(membership);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Returns memberships filtered by group or by authenticated user.
async function getGroupMemberships(req, res) {
  try {
    const actorId = req.user.userId;
    const { group, user } = req.query;
    const query = {};

    if (group !== undefined) {
      if (!isObjectId(group)) {
        return res.status(400).json({ message: 'Invalid group id.' });
      }
      const actorMembership = await getActorMembership(group, actorId);
      if (!actorMembership) {
        return res.status(403).json({ message: 'Only group members can list group memberships.' });
      }
      query.group = group;
    }

    if (user !== undefined) {
      if (!isObjectId(user)) {
        return res.status(400).json({ message: 'Invalid user id.' });
      }
      if (String(user) !== String(actorId)) {
        return res.status(403).json({ message: 'You can only list your own memberships.' });
      }
      query.user = user;
    }

    if (!group && !user) {
      query.user = actorId;
    }

    const USER_POP = 'username email avatarUrl level isDeleted';
    const rows = await GroupMemberships.find(query)
      .sort({ createdAt: -1 })
      .populate('group', 'name isArchived isDeleted')
      .populate('user', USER_POP)
      .populate('invitedBy', PUBLIC_USER_AUTHOR_FIELDS)
      .lean();

    const mapped = (rows || []).map((m) => ({
      ...m,
      user: m.user ? publicGroupMemberUserLean(m.user) : m.user,
      invitedBy: m.invitedBy ? publicAuthorFromLean(m.invitedBy) : m.invitedBy,
    }));

    return res.status(200).json(mapped);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Returns a single membership if requester belongs to the same group.
async function getGroupMembershipById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid membership id.' });
    }

    const USER_POP = 'username email avatarUrl level isDeleted';
    const membership = await GroupMemberships.findById(id)
      .populate('group', 'name isArchived isDeleted')
      .populate('user', USER_POP)
      .populate('invitedBy', PUBLIC_USER_AUTHOR_FIELDS)
      .lean();
    if (!membership) {
      return res.status(404).json({ message: 'Membership not found.' });
    }

    const actorMembership = await getActorMembership(membership.group._id || membership.group, req.user.userId);
    if (!actorMembership) {
      return res.status(403).json({ message: 'Forbidden membership access.' });
    }

    return res.status(200).json({
      ...membership,
      user: membership.user ? publicGroupMemberUserLean(membership.user) : membership.user,
      invitedBy: membership.invitedBy ? publicAuthorFromLean(membership.invitedBy) : membership.invitedBy,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Updates a membership role when requested by a group owner.
async function updateGroupMembership(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid membership id.' });
    }
    if (!role || !['owner', 'member'].includes(role)) {
      return res.status(400).json({ message: 'role must be owner or member.' });
    }

    const membership = await GroupMemberships.findById(id);
    if (!membership) {
      return res.status(404).json({ message: 'Membership not found.' });
    }

    const actorMembership = await getActorMembership(membership.group, req.user.userId);
    if (!actorMembership || actorMembership.role !== 'owner') {
      return res.status(403).json({ message: 'Only group owners can update roles.' });
    }

    if (String(membership.user) === String(req.user.userId) && role !== 'owner') {
      return res.status(400).json({ message: 'Owner cannot demote themselves here.' });
    }

    membership.role = role;
    await membership.save();

    return res.status(200).json(membership);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Removes a membership while preserving at least one owner in the group.
async function deleteGroupMembership(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid membership id.' });
    }

    const membership = await GroupMemberships.findById(id);
    if (!membership) {
      return res.status(404).json({ message: 'Membership not found.' });
    }

    const actorId = req.user.userId;
    const actorMembership = await getActorMembership(membership.group, actorId);
    const isSelfRemoval = String(membership.user) === String(actorId);

    if (!isSelfRemoval && (!actorMembership || actorMembership.role !== 'owner')) {
      return res.status(403).json({ message: 'Only group owners can remove other members.' });
    }
    if (isSelfRemoval && !actorMembership) {
      return res.status(403).json({ message: 'Forbidden membership access.' });
    }

    if (membership.role === 'owner') {
      const otherOwnerExists = await GroupMemberships.exists({
        group: membership.group,
        role: 'owner',
        _id: { $ne: membership._id },
      });
      if (!otherOwnerExists) {
        return res.status(409).json({ message: 'Group must keep at least one owner.' });
      }
    }

    await membership.deleteOne();

    const groupDoc = await Groups.findById(membership.group);
    if (groupDoc) {
      groupDoc.memberCount = Math.max(0, (groupDoc.memberCount || 0) - 1);
      await groupDoc.save();
    }

    return res.status(200).json({ message: 'Membership deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createGroupMembership,
  getGroupMemberships,
  getGroupMembershipById,
  updateGroupMembership,
  deleteGroupMembership,
};
