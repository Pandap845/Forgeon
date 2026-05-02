const mongoose = require('mongoose');
const { Friends, User } = require('../models');

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function toSortedPair(idA, idB) {
  return String(idA) < String(idB)
    ? { userA: idA, userB: idB }
    : { userA: idB, userB: idA };
}

function isParticipant(friendship, userId) {
  const uid = String(userId);
  return String(friendship.userA) === uid || String(friendship.userB) === uid;
}

// Creates a friendship between the authenticated user and a target user.
async function createFriend(req, res) {
  try {
    const actorId = req.user.userId;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!isObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }
    if (String(actorId) === String(userId)) {
      return res.status(400).json({ message: 'You cannot add yourself as friend.' });
    }

    const targetUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const pair = toSortedPair(actorId, userId);
    const existing = await Friends.findOne(pair);
    if (existing) {
      return res.status(409).json({ message: 'Friendship already exists.' });
    }

    const friendship = await Friends.create({
      ...pair,
      connectedBy: actorId,
      connectedAt: new Date(),
    });

    return res.status(201).json(friendship);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Returns friendships for the authenticated user.
async function getFriends(req, res) {
  try {
    const actorId = req.user.userId;
    const queryUserId = req.query.userId;

    if (queryUserId && String(queryUserId) !== String(actorId)) {
      return res.status(403).json({ message: 'You can only list your own friendships.' });
    }

    const targetUserId = queryUserId || actorId;
    const friendships = await Friends.find({
      $or: [{ userA: targetUserId }, { userB: targetUserId }],
    })
      .sort({ createdAt: -1 })
      .populate('userA', 'username email avatarUrl')
      .populate('userB', 'username email avatarUrl')
      .populate('connectedBy', 'username email');

    return res.status(200).json(friendships);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Returns one friendship when the authenticated user is a participant.
async function getFriendById(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid friendship id.' });
    }

    const friendship = await Friends.findById(id)
      .populate('userA', 'username email avatarUrl')
      .populate('userB', 'username email avatarUrl')
      .populate('connectedBy', 'username email');
    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found.' });
    }

    if (!isParticipant(friendship, req.user.userId)) {
      return res.status(403).json({ message: 'Forbidden friendship access.' });
    }

    return res.status(200).json(friendship);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Deletes a friendship when the authenticated user is part of it.
async function deleteFriend(req, res) {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid friendship id.' });
    }

    const friendship = await Friends.findById(id);
    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found.' });
    }

    if (!isParticipant(friendship, req.user.userId)) {
      return res.status(403).json({ message: 'Forbidden friendship access.' });
    }

    await friendship.deleteOne();
    return res.status(200).json({ message: 'Friendship deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = {
  createFriend,
  getFriends,
  getFriendById,
  deleteFriend,
};
