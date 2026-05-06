const mongoose = require('mongoose');
const {
  groups_invitation: GroupsInvitation,
  GroupMemberships,
  Groups,
  User,
} = require('../models');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

async function createGroupsInvitation(req, res) {
  try {
    const senderId = req.user.userId;
    const { group, invitee, inviteeEmail, message, expiresAt } = req.body;

    if (!group) {
      return res.status(400).json({ message: 'group is required.' });
    }
    if (!isObjectId(group)) {
      return res.status(400).json({ message: 'Invalid group id.' });
    }
    if (!invitee && !inviteeEmail) {
      return res.status(400).json({ message: 'invitee or inviteeEmail is required.' });
    }
    if (invitee && !isObjectId(invitee)) {
      return res.status(400).json({ message: 'Invalid invitee id.' });
    }

    const groupDoc = await Groups.findOne({ _id: group, isDeleted: false, isArchived: false });
    if (!groupDoc) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const senderMembership = await GroupMemberships.findOne({ group, user: senderId });
    if (!senderMembership) {
      return res.status(403).json({ message: 'Only group members can send invitations.' });
    }

    let inviteeUserId = null;
    let normalizedInviteeEmail = null;
    if (invitee) {
      const inviteeUser = await User.findOne({ _id: invitee, isDeleted: false });
      if (!inviteeUser) {
        return res.status(404).json({ message: 'Invitee user not found.' });
      }
      if (String(invitee) === String(senderId)) {
        return res.status(400).json({ message: 'You cannot invite yourself.' });
      }

      const existingMembership = await GroupMemberships.findOne({ group, user: invitee });
      if (existingMembership) {
        return res.status(409).json({ message: 'User is already a member of this group.' });
      }
      inviteeUserId = invitee;
    } else {
      normalizedInviteeEmail = String(inviteeEmail).toLowerCase().trim();
      if (!normalizedInviteeEmail) {
        return res.status(400).json({ message: 'inviteeEmail cannot be empty.' });
      }
      const matchedUser = await User.findOne({ email: normalizedInviteeEmail, isDeleted: false });
      if (matchedUser) {
        inviteeUserId = matchedUser._id;
        const existingMembership = await GroupMemberships.findOne({ group, user: inviteeUserId });
        if (existingMembership) {
          return res.status(409).json({ message: 'User is already a member of this group.' });
        }
      }
    }

    const invitation = await GroupsInvitation.create({
      group,
      sender: senderId,
      invitee: inviteeUserId,
      inviteeEmail: normalizedInviteeEmail,
      message,
      expiresAt: expiresAt || null,
    });

    return res.status(201).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getGroupsInvitations(req, res) {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('email');
    const userEmail = user?.email || null;
    const filter = req.query.filter || 'all';

    const receivedFilter = {
      $or: [{ invitee: userId }, ...(userEmail ? [{ inviteeEmail: userEmail }] : [])],
    };
    const sentFilter = { sender: userId };

    let query = {};
    if (filter === 'sent') query = sentFilter;
    else if (filter === 'received') query = receivedFilter;
    else query = { $or: [sentFilter, receivedFilter] };

    const invitations = await GroupsInvitation.find(query)
      .sort({ createdAt: -1 })
      .populate('group', 'name iconImageUrl coverImageUrl')
      .populate('sender', 'username email')
      .populate('invitee', 'username email');

    return res.status(200).json(invitations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getGroupsInvitationById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid invitation id.' });
    }

    const invitation = await GroupsInvitation.findById(id)
      .populate('group', 'name iconImageUrl coverImageUrl')
      .populate('sender', 'username email')
      .populate('invitee', 'username email');
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select('email');
    const isSender = String(invitation.sender?._id || invitation.sender) === String(userId);
    const isInvitee = invitation.invitee && String(invitation.invitee?._id || invitation.invitee) === String(userId);
    const emailInvitee = invitation.inviteeEmail && user?.email && invitation.inviteeEmail === user.email;

    if (!isSender && !isInvitee && !emailInvitee) {
      return res.status(403).json({ message: 'Forbidden invitation access.' });
    }

    return res.status(200).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateGroupsInvitation(req, res) {
  try {
    const { id } = req.params;
    const actorId = req.user.userId;
    const { status } = req.body;

    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid invitation id.' });
    }
    if (!status) {
      return res.status(400).json({ message: 'status is required.' });
    }

    const invitation = await GroupsInvitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }
    if (invitation.status !== 'pending') {
      return res.status(409).json({ message: 'Only pending invitations can be updated.' });
    }

    const actorUser = await User.findById(actorId).select('email');
    const isSender = String(invitation.sender) === String(actorId);
    const isInvitee = invitation.invitee && String(invitation.invitee) === String(actorId);
    const isEmailInvitee = invitation.inviteeEmail && actorUser?.email === invitation.inviteeEmail;

    const senderStatuses = ['revoked'];
    const inviteeStatuses = ['accepted', 'rejected'];
    const allowedStatuses = isSender ? senderStatuses : isInvitee || isEmailInvitee ? inviteeStatuses : [];
    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({ message: 'Invalid status transition for current user.' });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    if (status === 'accepted') {
      const targetUserId = invitation.invitee || actorId;
      const existingMembership = await GroupMemberships.findOne({ group: invitation.group, user: targetUserId });
      if (!existingMembership) {
        await GroupMemberships.create({
          group: invitation.group,
          user: targetUserId,
          role: 'member',
          invitedBy: invitation.sender,
          joinedAt: new Date(),
        });
        await Groups.updateOne({ _id: invitation.group }, { $inc: { memberCount: 1 } });
      }
    }

    return res.status(200).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteGroupsInvitation(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid invitation id.' });
    }

    const invitation = await GroupsInvitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select('email');
    const isSender = String(invitation.sender) === String(userId);
    const isInvitee = invitation.invitee && String(invitation.invitee) === String(userId);
    const isEmailInvitee = invitation.inviteeEmail && user?.email === invitation.inviteeEmail;

    if (!isSender && !isInvitee && !isEmailInvitee) {
      return res.status(403).json({ message: 'Forbidden invitation access.' });
    }

    await invitation.deleteOne();
    return res.status(200).json({ message: 'Invitation deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createGroupsInvitation,
  getGroupsInvitations,
  getGroupsInvitationById,
  updateGroupsInvitation,
  deleteGroupsInvitation,
};
