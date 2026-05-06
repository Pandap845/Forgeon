require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  User,
  Threads,
  Forum,
  Comments,
  Groups,
  Category,
  Friends,
  friends_invitation: FriendsInvitation,
  groups_invitation: GroupsInvitation,
  GroupMemberships,
} = require("./models");

const DEFAULT_USERS_FILE = "C:\\Users\\aguil\\Downloads\\forgeon.users.json";
const cliArgs = process.argv.slice(2);
const usersFlagIndex = cliArgs.indexOf("--users");
const cliUsersFile =
  usersFlagIndex >= 0
    ? cliArgs[usersFlagIndex + 1]
    : cliArgs[0] && !cliArgs[0].startsWith("--")
      ? cliArgs[0]
      : null;
const USERS_FILE = cliUsersFile || process.env.SEED_USERS_FILE || DEFAULT_USERS_FILE;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const GROUP_IMAGE_PRESETS = [
  ["consoles.jpg", "consolesProfile.jpg"],
  ["factorio.jpg", "factorioProfile.jpg"],
  ["fortnite.jpg", "fortniteProfile.jpg"],
  ["pokemon.png", "pokemonProfile.jpg"],
  ["zenlessZoneZero.jpg", "zenlessZoneZeroProfile.png"],
  ["marioWorld.jpg", "marioProfile.jpg"],
  ["mincraf.jpg", "minecraftLogo.png"],
];

function asDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value.$date) return new Date(value.$date);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object" && value.$oid) return new mongoose.Types.ObjectId(value.$oid);
  if (typeof value === "string" && mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(value);
  return null;
}

function sanitizeUserAvatar(url) {
  const out = String(url || "").trim();
  if (!out) return "";
  return out.startsWith("/uploads/profile-pictures/") ? out : "";
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Users JSON file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Users JSON must be an array.");
  }
  return parsed;
}

function normalizeUsers(rawUsers) {
  const usedUsernames = new Set();
  const usedEmails = new Set();
  const users = [];

  for (const raw of rawUsers) {
    const username = String(raw.username || "").trim();
    const email = String(raw.email || "").trim().toLowerCase();
    if (!username || !email) continue;

    const userKey = username.toLowerCase();
    if (usedUsernames.has(userKey) || usedEmails.has(email)) continue;
    usedUsernames.add(userKey);
    usedEmails.add(email);

    const badges = Array.isArray(raw.badges)
      ? raw.badges
          .filter((badge) => badge && badge.id)
          .map((badge) => ({
            id: String(badge.id).trim(),
            earnedAt: asDate(badge.earnedAt, new Date()),
          }))
      : [];

    const normalized = {
      username,
      email,
      passwordHash:
        String(raw.passwordHash || "").trim() ||
        "$2b$10$7HXif577TrmPZAz07bPKyOL2fqbgXpjP0eiKxESXlaGK5pIKHEJBW",
      birthday: asDate(raw.birthday, undefined),
      avatarUrl: sanitizeUserAvatar(raw.avatarUrl),
      level: Number.isFinite(raw.level) ? raw.level : 1,
      experiencePoints: Number.isFinite(raw.experiencePoints) ? raw.experiencePoints : 0,
      badges,
      bio: String(raw.bio || ""),
      postsPublished: Number.isFinite(raw.postsPublished) ? raw.postsPublished : 0,
      groupsCount: Number.isFinite(raw.groupsCount) ? raw.groupsCount : 0,
      isDeleted: Boolean(raw.isDeleted),
      createdAt: asDate(raw.createdAt, new Date("2026-03-01T12:00:00.000Z")),
      updatedAt: asDate(raw.updatedAt, new Date("2026-05-06T12:00:00.000Z")),
    };

    const providedId = asObjectId(raw._id);
    if (providedId) normalized._id = providedId;

    users.push(normalized);
  }

  return users;
}

function readUploadFiles(relativeDir) {
  const fullDir = path.resolve(__dirname, "uploads", relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((name) => fs.statSync(path.join(fullDir, name)).isFile())
    .sort((a, b) => a.localeCompare(b));
}

function uploadUrl(folder, fileName) {
  return `/uploads/${folder}/${fileName}`;
}

function chooseGroupImagePairs(groupFiles) {
  const result = [];
  for (const [cover, icon] of GROUP_IMAGE_PRESETS) {
    if (groupFiles.includes(cover) && groupFiles.includes(icon)) {
      result.push({ cover, icon });
    }
  }
  return result;
}

function sortedFriendPair(a, b) {
  return String(a) < String(b) ? [a, b] : [b, a];
}

function buildCategorySeeds() {
  return [
    { name: "RPG", description: "Role-playing games and builds." },
    { name: "FPS", description: "Shooter games, aim guides, and loadouts." },
    { name: "Battle Royale", description: "Drops, circles, and clutch wins." },
    { name: "Sandbox", description: "Creative worlds and open-ended gameplay." },
    { name: "Retro", description: "Classic titles, emulation, and history." },
    { name: "Strategy", description: "Planning, optimization, and tactics." },
    { name: "Anime Games", description: "Anime-inspired combat and character games." },
    { name: "Nintendo", description: "Nintendo franchises, games, and community posts." },
    { name: "Pokemon", description: "Pokemon teams, events, and battle ideas." },
    { name: "General Gaming", description: "Cross-game discussion and discoveries." },
  ];
}

async function clearDatabase() {
  await Promise.all([
    Comments.deleteMany({}),
    Threads.deleteMany({}),
    GroupMemberships.deleteMany({}),
    FriendsInvitation.deleteMany({}),
    GroupsInvitation.deleteMany({}),
    Friends.deleteMany({}),
    Groups.deleteMany({}),
    Forum.deleteMany({}),
    Category.deleteMany({}),
    User.deleteMany({}),
  ]);
}

async function recalculateGroupMemberCount() {
  const grouped = await GroupMemberships.aggregate([
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);

  if (!grouped.length) return;
  await Groups.bulkWrite(
    grouped.map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { memberCount: row.count } },
      },
    }))
  );
}

async function recalculateUserCounters() {
  const postsByUser = await Threads.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$author", count: { $sum: 1 } } },
  ]);
  const groupsByCreator = await Groups.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$creator", count: { $sum: 1 } } },
  ]);

  const postsMap = new Map(postsByUser.map((row) => [String(row._id), row.count]));
  const groupsMap = new Map(groupsByCreator.map((row) => [String(row._id), row.count]));
  const allUsers = await User.find({}, { _id: 1 }).lean();

  if (!allUsers.length) return;
  await User.bulkWrite(
    allUsers.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            postsPublished: postsMap.get(String(user._id)) || 0,
            groupsCount: groupsMap.get(String(user._id)) || 0,
          },
        },
      },
    }))
  );
}

async function recalculateThreadActivity() {
  const commentsStats = await Comments.aggregate([
    { $match: { isDeleted: false } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$thread",
        commentsCount: { $sum: 1 },
        lastCommentAt: { $last: "$createdAt" },
        lastCommentBy: { $last: "$author" },
      },
    },
  ]);

  if (!commentsStats.length) return;
  await Threads.bulkWrite(
    commentsStats.map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            commentsCount: row.commentsCount,
            lastActivityAt: row.lastCommentAt,
            lastActivityBy: row.lastCommentBy,
          },
        },
      },
    }))
  );
}

async function seed() {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI or MONGODB_URI environment variable.");
  }

  const rawUsers = readJsonArray(USERS_FILE);
  const users = normalizeUsers(rawUsers);
  if (users.length < 6) {
    throw new Error("Users JSON must contain at least 6 valid users.");
  }

  const groupFiles = readUploadFiles("groups");
  const threadFiles = readUploadFiles("threads");
  if (!threadFiles.length) {
    throw new Error("No thread images found in BACKEND\\uploads\\threads.");
  }

  const groupImagePairs = chooseGroupImagePairs(groupFiles);
  if (groupImagePairs.length < 4) {
    throw new Error("Not enough group image pairs (normal + profile) in BACKEND\\uploads\\groups.");
  }

  await mongoose.connect(MONGO_URI);

  try {
    await clearDatabase();

    const createdUsers = await User.insertMany(users);
    const activeUsers = createdUsers.filter((u) => !u.isDeleted);
    if (activeUsers.length < 5) {
      throw new Error("Need at least 5 active users in users JSON for relations.");
    }

    const categories = await Category.insertMany(buildCategorySeeds());
    const categoryByName = new Map(categories.map((c) => [c.name, c]));

    const forumSeeds = [
      {
        name: "Pokemon Strategy Hub",
        slug: "pokemon-strategy-hub",
        description: "Teams, counters, and competitive ideas for Pokemon.",
        imageUrl: uploadUrl("groups", groupFiles.includes("pokemon.png") ? "pokemon.png" : groupFiles[0]),
        createdBy: activeUsers[0]._id,
      },
      {
        name: "Fortnite Tactics",
        slug: "fortnite-tactics",
        description: "Rotation routes, loot choices, and ranked tips.",
        imageUrl: uploadUrl("groups", groupFiles.includes("fortnite.jpg") ? "fortnite.jpg" : groupFiles[1] || groupFiles[0]),
        createdBy: activeUsers[1]._id,
      },
      {
        name: "Retro Classics",
        slug: "retro-classics",
        description: "Classic game experiences, secrets, and throwbacks.",
        imageUrl: uploadUrl("groups", groupFiles.includes("marioWorld.jpg") ? "marioWorld.jpg" : groupFiles[2] || groupFiles[0]),
        createdBy: activeUsers[2]._id,
      },
      {
        name: "Sandbox Builders",
        slug: "sandbox-builders",
        description: "Build showcases, seeds, and co-op project ideas.",
        imageUrl: uploadUrl("groups", groupFiles.includes("mincraf.jpg") ? "mincraf.jpg" : groupFiles[3] || groupFiles[0]),
        createdBy: activeUsers[3]._id,
      },
    ];
    const forums = await Forum.insertMany(forumSeeds);

    const groupTemplates = [
      {
        name: "Console Legends",
        description: "A group for console players sharing discoveries, events, and clips.",
        categoryName: "General Gaming",
      },
      {
        name: "Factorio Engineers",
        description: "Factory optimization, blueprints, and throughput discussions.",
        categoryName: "Strategy",
      },
      {
        name: "Fortnite Ranked Squad",
        description: "Drops, rotations, and ranked BR teamwork.",
        categoryName: "Battle Royale",
      },
      {
        name: "Pokemon Masters",
        description: "Pokemon team building, events, and PvP strategy.",
        categoryName: "Pokemon",
      },
      {
        name: "Zenless Zone Crew",
        description: "Agents, builds, and event progression for ZZZ players.",
        categoryName: "Anime Games",
      },
      {
        name: "Mario Universe",
        description: "Mario games, speedrun routes, and Nintendo nostalgia.",
        categoryName: "Nintendo",
      },
      {
        name: "Minecraft Builders",
        description: "Survival tips, world showcases, and building challenges.",
        categoryName: "Sandbox",
      },
    ];

    const groupsToCreate = Math.min(groupTemplates.length, groupImagePairs.length);
    const groupSeeds = [];
    for (let i = 0; i < groupsToCreate; i += 1) {
      const template = groupTemplates[i];
      const pair = groupImagePairs[i];
      const creator = activeUsers[i % activeUsers.length];
      const categoryDoc = categoryByName.get(template.categoryName) || categories[0];

      groupSeeds.push({
        name: template.name,
        description: template.description,
        category: categoryDoc._id,
        coverImageUrl: uploadUrl("groups", pair.cover),
        iconImageUrl: uploadUrl("groups", pair.icon),
        creator: creator._id,
        memberCount: 1,
        isArchived: false,
        isDeleted: false,
      });
    }
    const groups = await Groups.insertMany(groupSeeds);

    const ownerMemberships = groups.map((group) => ({
      group: group._id,
      user: group.creator,
      role: "owner",
      joinedAt: new Date("2026-05-02T15:00:00.000Z"),
      invitedBy: null,
    }));

    const extraMemberships = [];
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const used = new Set([String(group.creator)]);
      const extraCount = Math.min(3, Math.max(1, activeUsers.length - 1));

      for (let j = 0; j < extraCount; j += 1) {
        const candidate = activeUsers[(i + j + 1) % activeUsers.length];
        if (used.has(String(candidate._id))) continue;
        used.add(String(candidate._id));
        extraMemberships.push({
          group: group._id,
          user: candidate._id,
          role: "member",
          joinedAt: new Date("2026-05-03T16:00:00.000Z"),
          invitedBy: group.creator,
        });
      }
    }

    await GroupMemberships.insertMany([...ownerMemberships, ...extraMemberships]);

    const memberships = await GroupMemberships.find({ group: { $in: groups.map((g) => g._id) } }).lean();
    const membersByGroup = new Map();
    for (const membership of memberships) {
      const key = String(membership.group);
      if (!membersByGroup.has(key)) membersByGroup.set(key, []);
      membersByGroup.get(key).push(membership.user);
    }

    let threadImageCursor = 0;
    function nextThreadImage() {
      const file = threadFiles[threadImageCursor % threadFiles.length];
      threadImageCursor += 1;
      return uploadUrl("threads", file);
    }

    const threadSeeds = [];

    for (let i = 0; i < 5; i += 1) {
      const author = activeUsers[i % activeUsers.length];
      const createdAt = new Date(Date.UTC(2026, 4, 4, 12 + i, 0, 0));
      threadSeeds.push({
        title: `General Thread #${i + 1}`,
        description: `General discussion topic ${i + 1} for the Forgeon community.`,
        imageUrl: nextThreadImage(),
        publishTo: "general",
        author: author._id,
        group: null,
        forum: null,
        likesCount: i * 2,
        commentsCount: 0,
        lastActivityBy: author._id,
        lastActivityAt: createdAt,
        isDeleted: false,
        createdAt,
        updatedAt: createdAt,
      });
    }

    for (let i = 0; i < forums.length; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const author = activeUsers[(i + j + 2) % activeUsers.length];
        const createdAt = new Date(Date.UTC(2026, 4, 5, 10 + i, j * 15, 0));
        threadSeeds.push({
          title: `${forums[i].name} Topic ${j + 1}`,
          description: `Discussion ${j + 1} inside forum "${forums[i].name}".`,
          imageUrl: nextThreadImage(),
          publishTo: "forum",
          author: author._id,
          forum: forums[i]._id,
          group: null,
          likesCount: j + 1,
          commentsCount: 0,
          lastActivityBy: author._id,
          lastActivityAt: createdAt,
          isDeleted: false,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const members = membersByGroup.get(String(group._id)) || [group.creator];
      for (let j = 0; j < 2; j += 1) {
        const authorId = members[(i + j) % members.length];
        const createdAt = new Date(Date.UTC(2026, 4, 6, 8 + i, j * 20, 0));
        threadSeeds.push({
          title: `${group.name} Thread ${j + 1}`,
          description: `Group post ${j + 1} for "${group.name}" members.`,
          imageUrl: nextThreadImage(),
          publishTo: "group",
          author: authorId,
          group: group._id,
          forum: null,
          likesCount: j,
          commentsCount: 0,
          lastActivityBy: authorId,
          lastActivityAt: createdAt,
          isDeleted: false,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    const createdThreads = await Threads.insertMany(threadSeeds);

    const commentsToCreate = [];
    for (let i = 0; i < createdThreads.length; i += 1) {
      const thread = createdThreads[i];
      const commentCount = 2 + (i % 2);
      const authorPool =
        thread.publishTo === "group"
          ? membersByGroup.get(String(thread.group)) || activeUsers.map((u) => u._id)
          : activeUsers.map((u) => u._id);

      for (let j = 0; j < commentCount; j += 1) {
        const author = authorPool[(i + j) % authorPool.length];
        commentsToCreate.push({
          thread: thread._id,
          author,
          content: `Sample comment ${j + 1} on "${thread.title}".`,
          likesCount: j,
          isDeleted: false,
          createdAt: new Date(new Date(thread.createdAt).getTime() + (j + 1) * 10 * 60 * 1000),
          updatedAt: new Date(new Date(thread.createdAt).getTime() + (j + 1) * 10 * 60 * 1000),
        });
      }
    }
    await Comments.insertMany(commentsToCreate);

    const friendshipDocs = [];
    const usedFriendPairs = new Set();
    const nUsers = activeUsers.length;

    function pushFriendship(idxA, idxB, connectedByIdx) {
      if (idxA === idxB) return;
      const userAId = activeUsers[idxA % nUsers]._id;
      const userBId = activeUsers[idxB % nUsers]._id;
      const [sortedA, sortedB] = sortedFriendPair(userAId, userBId);
      const key = `${String(sortedA)}:${String(sortedB)}`;
      if (usedFriendPairs.has(key)) return;
      usedFriendPairs.add(key);
      friendshipDocs.push({
        userA: sortedA,
        userB: sortedB,
        connectedBy: activeUsers[connectedByIdx % nUsers]._id,
        connectedAt: new Date("2026-05-05T12:00:00.000Z"),
      });
    }

    for (let i = 0; i < Math.min(nUsers - 1, 10); i += 1) pushFriendship(i, i + 1, i);
    for (let i = 0; i < Math.min(nUsers - 2, 6); i += 1) pushFriendship(i, i + 2, i + 1);
    if (friendshipDocs.length) {
      await Friends.insertMany(friendshipDocs);
    }

    const friendInvitationDocs = [];
    const invitationStatuses = ["pending", "pending", "rejected", "cancelled", "accepted"];
    const usedPendingFriendPairs = new Set();
    let invitationCursor = 0;

    for (let i = 0; i < nUsers && friendInvitationDocs.length < 10; i += 1) {
      const sender = activeUsers[i]._id;
      const recipient = activeUsers[(i + 3) % nUsers]._id;
      if (String(sender) === String(recipient)) continue;

      const [a, b] = sortedFriendPair(sender, recipient);
      const pairKey = `${String(a)}:${String(b)}`;
      if (usedFriendPairs.has(pairKey)) continue;

      const status = invitationStatuses[invitationCursor % invitationStatuses.length];
      invitationCursor += 1;

      if (status === "pending" && usedPendingFriendPairs.has(pairKey)) continue;
      if (status === "pending") usedPendingFriendPairs.add(pairKey);

      friendInvitationDocs.push({
        sender,
        recipient,
        mutualFriends: i % 4,
        status,
        sentAt: new Date(Date.UTC(2026, 4, 5, 9 + i, 0, 0)),
        respondedAt: status === "pending" ? null : new Date(Date.UTC(2026, 4, 5, 10 + i, 0, 0)),
      });
    }
    if (friendInvitationDocs.length) {
      await FriendsInvitation.insertMany(friendInvitationDocs);
    }

    const currentMemberships = await GroupMemberships.find({ group: { $in: groups.map((g) => g._id) } }).lean();
    const memberSets = new Map();
    for (const row of currentMemberships) {
      const key = String(row.group);
      if (!memberSets.has(key)) memberSets.set(key, new Set());
      memberSets.get(key).add(String(row.user));
    }

    const groupInvitationDocs = [];
    const acceptedMemberships = [];
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const senderId = group.creator;
      const groupKey = String(group._id);
      const membersSet = memberSets.get(groupKey) || new Set([String(senderId)]);

      const nonMembers = activeUsers.filter((u) => !membersSet.has(String(u._id)));
      if (!nonMembers.length) continue;

      const pendingInvitee = nonMembers[0];
      groupInvitationDocs.push({
        group: group._id,
        sender: senderId,
        invitee: pendingInvitee._id,
        inviteeEmail: null,
        message: `Join ${group.name} and share your latest game discoveries!`,
        status: "pending",
        sentAt: new Date(Date.UTC(2026, 4, 6, 12 + i, 0, 0)),
        respondedAt: null,
        expiresAt: new Date(Date.UTC(2026, 4, 20, 12 + i, 0, 0)),
      });

      if (nonMembers[1]) {
        groupInvitationDocs.push({
          group: group._id,
          sender: senderId,
          invitee: nonMembers[1]._id,
          inviteeEmail: null,
          message: `We'd like you in ${group.name}.`,
          status: "rejected",
          sentAt: new Date(Date.UTC(2026, 4, 4, 12 + i, 0, 0)),
          respondedAt: new Date(Date.UTC(2026, 4, 4, 18 + i, 0, 0)),
          expiresAt: null,
        });
      }

      if (nonMembers[2]) {
        groupInvitationDocs.push({
          group: group._id,
          sender: senderId,
          invitee: nonMembers[2]._id,
          inviteeEmail: null,
          message: `Welcome to ${group.name}!`,
          status: "accepted",
          sentAt: new Date(Date.UTC(2026, 4, 3, 11 + i, 0, 0)),
          respondedAt: new Date(Date.UTC(2026, 4, 3, 13 + i, 0, 0)),
          expiresAt: null,
        });

        acceptedMemberships.push({
          group: group._id,
          user: nonMembers[2]._id,
          role: "member",
          invitedBy: senderId,
          joinedAt: new Date(Date.UTC(2026, 4, 3, 13 + i, 0, 0)),
        });
        membersSet.add(String(nonMembers[2]._id));
      }

      groupInvitationDocs.push({
        group: group._id,
        sender: senderId,
        invitee: null,
        inviteeEmail: `community.invite+${i}@forgeon.dev`,
        message: `Email invitation to ${group.name}.`,
        status: "revoked",
        sentAt: new Date(Date.UTC(2026, 4, 2, 10 + i, 0, 0)),
        respondedAt: new Date(Date.UTC(2026, 4, 2, 12 + i, 0, 0)),
        expiresAt: null,
      });
    }

    if (groupInvitationDocs.length) {
      await GroupsInvitation.insertMany(groupInvitationDocs);
    }

    if (acceptedMemberships.length) {
      await GroupMemberships.insertMany(acceptedMemberships);
    }

    await recalculateGroupMemberCount();
    await recalculateThreadActivity();
    await recalculateUserCounters();

    const [userCount, categoryCount, forumCount, groupCount, threadCount, commentCount, friendshipCount] =
      await Promise.all([
        User.countDocuments({}),
        Category.countDocuments({}),
        Forum.countDocuments({}),
        Groups.countDocuments({}),
        Threads.countDocuments({}),
        Comments.countDocuments({}),
        Friends.countDocuments({}),
      ]);

    console.log("Sample seeding completed successfully.");
    console.log(
      JSON.stringify(
        {
          users: userCount,
          categories: categoryCount,
          forums: forumCount,
          groups: groupCount,
          threads: threadCount,
          comments: commentCount,
          friendships: friendshipCount,
          usersSource: USERS_FILE,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Sample seeding failed:", error.message);
    process.exit(1);
  });
