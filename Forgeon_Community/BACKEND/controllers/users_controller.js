const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SALT_ROUNDS = 10;

function toPublicUser(userDoc) {
  return {
    id: userDoc._id,
    username: userDoc.username,
    email: userDoc.email,
    birthday: userDoc.birthday,
    avatarUrl: userDoc.avatarUrl,
    level: userDoc.level,
    bio: userDoc.bio,
    postsPublished: userDoc.postsPublished,
    groupsCount: userDoc.groupsCount,
    isDeleted: userDoc.isDeleted,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

function createToken(userDoc) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured.');
  }

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

async function createUser(req, res) {
  try {
    const { username, email, password, birthday, avatarUrl, bio } = req.body;

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

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      birthday,
      avatarUrl,
      bio,
    });

    const token = createToken(user);
    return res.status(201).json({
      message: 'User created successfully.',
      token,
      user: toPublicUser(user),
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

    const token = createToken(user);
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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

    return res.status(200).json(toPublicUser(user));
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
    if (avatarUrl !== undefined) currentUser.avatarUrl = avatarUrl;
    if (bio !== undefined) currentUser.bio = bio;

    await currentUser.save();

    return res.status(200).json({
      message: 'User updated successfully.',
      user: toPublicUser(currentUser),
    });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user update request.' });
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

    user.isDeleted = true;
    await user.save();

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
}

module.exports = {
  createUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
