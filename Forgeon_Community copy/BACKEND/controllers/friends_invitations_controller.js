const mongoose = require('mongoose');
const { friends_invitation: FriendsInvitation, Friends, User } = require('../models');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function isInInvitation(invitation, userId) {
  const uid = String(userId);
  return String(invitation.sender) === uid || String(invitation.recipient) === uid;
}

async function createFriendsInvitation(req, res) {
  try {
    const senderId = req.user.userId;
    const { recipient, mutualFriends } = req.body;

    if (!recipient) {
      return res.status(400).json({ message: 'recipient is required.' });
    }

    if (!isObjectId(recipient)) {
      return res.status(400).json({ message: 'Invalid recipient id.' });
    }

    if (String(senderId) === String(recipient)) {
      return res.status(400).json({ message: 'You cannot invite yourself.' });
    }

    const recipientUser = await User.findOne({ _id: recipient, isDeleted: false });
    if (!recipientUser) {
      return res.status(404).json({ message: 'Recipient user not found.' });
    }

    const existingFriendship = await Friends.findOne({
      $or: [
        { userA: senderId, userB: recipient },
        { userA: recipient, userB: senderId },
      ],
    });
    if (existingFriendship) {
      return res.status(409).json({ message: 'Users are already friends.' });
    }

    const existingPending = await FriendsInvitation.findOne({
      status: 'pending',
      $or: [
        { sender: senderId, recipient },
        { sender: recipient, recipient: senderId },
      ],
    });
    if (existingPending) {
      return res.status(409).json({ message: 'A pending invitation already exists between these users.' });
    }

    const invitation = await FriendsInvitation.create({
      sender: senderId,
      recipient,
      mutualFriends: Number.isFinite(mutualFriends) ? mutualFriends : 0,
    });

    return res.status(201).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getFriendsInvitations(req, res) {
  try {
    const userId = req.user.userId;
    const filter = req.query.filter || 'all';

    const query = {};
    if (filter === 'sent') query.sender = userId;
    else if (filter === 'received') query.recipient = userId;
    else query.$or = [{ sender: userId }, { recipient: userId }];

    const invitations = await FriendsInvitation.find(query)
      .sort({ createdAt: -1 })
      .populate('sender', 'username email')
      .populate('recipient', 'username email');

    return res.status(200).json(invitations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getFriendsInvitationById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid invitation id.' });
    }

    const invitation = await FriendsInvitation.findById(id)
      .populate('sender', 'username email')
      .populate('recipient', 'username email');
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }

    if (!isInInvitation(invitation, req.user.userId)) {
      return res.status(403).json({ message: 'Forbidden invitation access.' });
    }

    return res.status(200).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateFriendsInvitation(req, res) {
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

    const invitation = await FriendsInvitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }

    const isSender = String(invitation.sender) === String(actorId);
    const isRecipient = String(invitation.recipient) === String(actorId);
    if (!isSender && !isRecipient) {
      return res.status(403).json({ message: 'Forbidden invitation access.' });
    }

    if (invitation.status !== 'pending') {
      return res.status(409).json({ message: 'Only pending invitations can be updated.' });
    }

    const allowedStatuses = isRecipient ? ['accepted', 'rejected'] : ['cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition.' });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    if (status === 'accepted') {
      const userA = String(invitation.sender) < String(invitation.recipient)
        ? invitation.sender
        : invitation.recipient;
      const userB = String(invitation.sender) < String(invitation.recipient)
        ? invitation.recipient
        : invitation.sender;

      await Friends.updateOne(
        { userA, userB },
        {
          $setOnInsert: {
            userA,
            userB,
            connectedBy: actorId,
            connectedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    return res.status(200).json(invitation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function deleteFriendsInvitation(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid invitation id.' });
    }

    const invitation = await FriendsInvitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found.' });
    }

    if (!isInInvitation(invitation, req.user.userId)) {
      return res.status(403).json({ message: 'Forbidden invitation access.' });
    }

    await invitation.deleteOne();
    return res.status(200).json({ message: 'Invitation deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createFriendsInvitation,
  getFriendsInvitations,
  getFriendsInvitationById,
  updateFriendsInvitation,
  deleteFriendsInvitation,
};
