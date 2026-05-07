const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Threads, GroupMemberships } = require('../models');
const { runAccountDeletionSideEffects, tryRemoveUploadedProfilePicture } = require('../services/accountDeletionService');
const { progressionPayload, ensureProgressionFields, syncFrameBadgesForLevel, getLevelFromXp } = require('../utils/forgeonProgression');
const userProgressionService = require('../services/userProgressionService');

async function syncPostsPublishedFromThreads(userDoc) {
  const n = await Threads.countDocuments({ author: userDoc._id, isDeleted: false });
  if ((userDoc.postsPublished || 0) !== n) {
    userDoc.postsPublished = n;
  }
}

async function countActiveGroupMemberships(userId) {
  const memberships = await GroupMemberships.find({ user: userId }).populate('group', 'isDeleted').lean();
  return memberships.filter((m) => m.group && m.group.isDeleted !== true).length;
}

async function persistProgressionIfNeeded(userDoc) {
  await syncPostsPublishedFromThreads(userDoc);
  ensureProgressionFields(userDoc);
  userDoc.level = getLevelFromXp(userDoc.experiencePoints);
  syncFrameBadgesForLevel(userDoc);
  if (userDoc.isModified && userDoc.isModified()) {
    await userDoc.save();
  }
}

async function userPayloadWithStats(userDoc) {
  const base = toPublicUser(userDoc);
  base.groupsJoinedCount = await countActiveGroupMemberships(userDoc._id);
  return base;
}

const SALT_ROUNDS = 10;
const AUTH_COOKIE_NAME = 'forgeon_auth_token'; // The most important shit ever

function toPublicUser(userDoc) {
  ensureProgressionFields(userDoc);
  const prog = progressionPayload(userDoc);
  return {
    id: userDoc._id,
    username: userDoc.username,
    email: userDoc.email,
    birthday: userDoc.birthday,
    avatarUrl: userDoc.avatarUrl,
    bio: userDoc.bio,
    postsPublished: userDoc.postsPublished,
    groupsCount: userDoc.groupsCount,
    isDeleted: userDoc.isDeleted,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
    level: prog.level,
    experiencePoints: prog.experiencePoints,
    xpIntoCurrentLevel: prog.xpIntoCurrentLevel,
    xpToNextLevel: prog.xpToNextLevel,
    percentToNextLevel: prog.percentToNextLevel,
    isMaxLevel: prog.isMaxLevel,
    maxLevel: prog.maxLevel,
    badgesEarned: prog.badgesEarned,
    badgeCatalogTotal: prog.badgeCatalogTotal,
  };
}

//token generator
function createToken(userDoc) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured.');
  }

  //Return the token  
  return jwt.sign(
    {
      userId: userDoc._id.toString(),
      username: userDoc.username,
      email: userDoc.email,
    },
    secret,
    { expiresIn: '1d' }
  );
}

//Auth cookie 
function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  })
}

function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
}

async function createUser(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email, and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedUsername = String(username).trim();

    const [usernameTaken, emailTaken] = await Promise.all([
      User.exists({ username: normalizedUsername }),
      User.exists({ email: normalizedEmail }),
    ]);

    if (usernameTaken) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    if (emailTaken) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    //Hash the password before saving the user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      avatarUrl: '',
    });

    await userProgressionService.afterUserRegistered(user._id).catch(() => {});

    const savedUser = await User.findById(user._id);
    const token = createToken(savedUser || user);
    setAuthCookie(res, token);
    const saved = savedUser || user;
    await persistProgressionIfNeeded(saved);
    return res.status(201).json({
      message: 'User created successfully.',
      token,
      user: await userPayloadWithStats(saved),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function loginUser(req, res) {
  try {
    const { email, username, password } = req.body;

    if (!password || (!email && !username)) {
      return res.status(400).json({ message: 'Provide password and either email or username.' });
    }

    const query = email
      ? { email: String(email).toLowerCase().trim(), isDeleted: false }
      : { username: String(username).trim(), isDeleted: false };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    await persistProgressionIfNeeded(user);

    //Create a JWT token for the authenticated user
    const token = createToken(user);
    setAuthCookie(res, token);
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: await userPayloadWithStats(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

function logoutUser(_req, res) {
  clearAuthCookie(res);
  return res.status(200).json({ message: 'Logout successful.' });
}

function getBadgeCatalog(_req, res) {
  const { BADGE_CATALOG } = require('../utils/forgeonProgression');
  return res.status(200).json(BADGE_CATALOG);
}

async function getUsers(req, res) {
  try {
    const users = await User.find({ isDeleted: false }).sort({ createdAt: -1 });
    return res.status(200).json(users.map(toPublicUser));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getUserById(req, res) {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await persistProgressionIfNeeded(user);

    return res.status(200).json(await userPayloadWithStats(user));
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    if (req.user.userId !== id) {
      return res.status(403).json({ message: 'You can only update your own user.' });
    }

    const currentUser = await User.findOne({ _id: id, isDeleted: false });
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { username, email, password, birthday, avatarUrl, bio } = req.body;

    if (username && username !== currentUser.username) {
      const usernameTaken = await User.exists({ username: String(username).trim(), _id: { $ne: id } });
      if (usernameTaken) {
        return res.status(409).json({ message: 'Username already exists.' });
      }
      currentUser.username = String(username).trim();
    }

    if (email && String(email).toLowerCase().trim() !== currentUser.email) {
      const normalizedEmail = String(email).toLowerCase().trim();
      const emailTaken = await User.exists({ email: normalizedEmail, _id: { $ne: id } });
      if (emailTaken) {
        return res.status(409).json({ message: 'Email already exists.' });
      }
      currentUser.email = normalizedEmail;
    }

    if (password) {
      currentUser.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    if (birthday !== undefined) currentUser.birthday = birthday;
    if (avatarUrl !== undefined) {
      const trimmed = String(avatarUrl).trim();
      if (trimmed && !trimmed.startsWith('/uploads/profile-pictures/')) {
        return res.status(400).json({ message: 'Avatar can only be set to uploaded profile images.' });
      }
      currentUser.avatarUrl = trimmed;
    }
    if (bio !== undefined) currentUser.bio = bio;

    await currentUser.save();

    await persistProgressionIfNeeded(currentUser);

    return res.status(200).json({
      message: 'User updated successfully.',
      user: await userPayloadWithStats(currentUser),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user update request.' });
  }
}

async function uploadUserAvatar(req, res) {
  try {
    const userId = req.user.userId;
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required (form field name: avatar).' });
    }

    const publicPath = `/uploads/profile-pictures/${req.file.filename}`;
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.avatarUrl = publicPath;
    await user.save();

    return res.status(200).json({
      message: 'Avatar updated.',
      avatarUrl: publicPath,
      user: await userPayloadWithStats(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (req.user.userId !== id) {
      return res.status(403).json({ message: 'You can only delete your own user.' });
    }

    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    tryRemoveUploadedProfilePicture(user.avatarUrl);
    await runAccountDeletionSideEffects(id);
    await User.deleteOne({ _id: id });

    clearAuthCookie(res);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
}

module.exports = {
  createUser,
  loginUser,
  logoutUser,
  getBadgeCatalog,
  getUsers,
  getUserById,
  updateUser,
  uploadUserAvatar,
  deleteUser,
};
