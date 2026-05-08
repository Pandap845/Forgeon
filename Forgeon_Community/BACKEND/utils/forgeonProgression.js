/**
 * Forgeon progression: XP curve, levels, and badge catalog (max 15).
 * Frame-tier badges match FRONTEND/assets/scripts/avatar-frames.js unlock levels.
 */

const BADGE_CATALOG = [
  {
    id: 'rookie_ring',
    name: 'Rookie Ring',
    emoji: '⭕',
    description: 'Starter honor — same tier as the default profile frame.',
    rarity: 'common',
    category: 'frame',
    minLevel: 1,
    howToEarn: 'Reach level 1 (join the community).',
  },
  {
    id: 'bit_spawn',
    name: '8-Bit Spawn',
    emoji: '👾',
    description: 'Badge tied to the level-10 pixel frame unlock.',
    rarity: 'rare',
    category: 'frame',
    minLevel: 10,
    howToEarn: 'Reach level 10 to unlock the 8-Bit Spawn frame.',
  },
  {
    id: 'neon_drift',
    name: 'Neon Drift',
    emoji: '💠',
    description: 'Badge tied to the level-20 neon frame unlock.',
    rarity: 'rare',
    category: 'frame',
    minLevel: 20,
    howToEarn: 'Reach level 20 to unlock the Neon Drift frame.',
  },
  {
    id: 'boss_crest',
    name: 'Boss Slayer Crest',
    emoji: '👑',
    description: 'Badge tied to the level-30 Boss Slayer frame.',
    rarity: 'epic',
    category: 'frame',
    minLevel: 30,
    howToEarn: 'Reach level 30 to unlock the Boss Slayer frame.',
  },
  {
    id: 'cyber_raid',
    name: 'Cyber Raider',
    emoji: '🛰️',
    description: 'Badge tied to the level-40 Cyber Raid frame.',
    rarity: 'epic',
    category: 'frame',
    minLevel: 40,
    howToEarn: 'Reach level 40 to unlock the Cyber Raid frame.',
  },
  {
    id: 'void_veil',
    name: 'Void Veil',
    emoji: '🌌',
    description: 'Badge tied to the level-50 Void Veil frame.',
    rarity: 'epic',
    category: 'frame',
    minLevel: 50,
    howToEarn: 'Reach level 50 to unlock the Void Veil frame.',
  },
  {
    id: 'titan_forge',
    name: 'Titan Forged',
    emoji: '🔥',
    description: 'Badge tied to the level-60 Titan Forge frame.',
    rarity: 'legendary',
    category: 'frame',
    minLevel: 60,
    howToEarn: 'Reach level 60 to unlock the Titan Forge frame.',
  },
  {
    id: 'mythic_legend',
    name: 'Mythic Legend',
    emoji: '✨',
    description: 'Badge tied to the level-70 Mythic Legend frame.',
    rarity: 'legendary',
    category: 'frame',
    minLevel: 70,
    howToEarn: 'Reach level 70 to unlock the Mythic Legend frame.',
  },
  {
    id: 'first_thread',
    name: 'First Thread',
    emoji: '🧵',
    description: 'Published your first community thread.',
    rarity: 'common',
    category: 'activity',
    howToEarn: 'Create any thread (general, forum, or group).',
  },
  {
    id: 'forum_founder',
    name: 'Forum Founder',
    emoji: '🏛️',
    description: 'Created a dedicated forum space.',
    rarity: 'rare',
    category: 'activity',
    howToEarn: 'Create a new forum.',
  },
  {
    id: 'squad_joined',
    name: 'Squad Rookie',
    emoji: '🤝',
    description: 'Joined a group as a member.',
    rarity: 'common',
    category: 'activity',
    howToEarn: 'Join a group (first membership as a non-owner member).',
  },
  {
    id: 'guild_forge',
    name: 'Guild Forge',
    emoji: '⚒️',
    description: 'Founded your own group.',
    rarity: 'epic',
    category: 'activity',
    howToEarn: 'Create a new group.',
  },
  {
    id: 'thread_visionary',
    name: 'Thread Visionary',
    emoji: '🖼️',
    description: 'Shared a thread with media.',
    rarity: 'rare',
    category: 'activity',
    howToEarn: 'Publish a thread that includes an image URL.',
  },
  {
    id: 'voice_of_forum',
    name: 'Voice of the Forum',
    emoji: '💬',
    description: 'Ten thoughtful comments across threads.',
    rarity: 'rare',
    category: 'activity',
    howToEarn: 'Publish 10 comments in total.',
  },
  {
    id: 'ally_link',
    name: 'Ally Link',
    emoji: '🔗',
    description: 'Connected with another player.',
    rarity: 'common',
    category: 'activity',
    howToEarn: 'Add your first friend.',
  },
];

const BADGE_IDS = new Set(BADGE_CATALOG.map((b) => b.id));

/** Level shown in UI, frames, and badges never exceeds this; XP can still grow beyond. */
const MAX_LEVEL = 70;

/** Minimum level required to create a group (enforced in groups_controller). */
const MIN_LEVEL_CREATE_GROUP = 10;

/**
 * XP curve: step cost scales by current level index (used by xpTotalForLevel / xpStepForLevel).
 * Tune together with `XP` rewards below.
 */
const XP_CURVE_MULTIPLIER = 100;

const FRAME_BADGE_THRESHOLDS = BADGE_CATALOG.filter((b) => b.category === 'frame').map((b) => ({
  id: b.id,
  minLevel: b.minLevel,
}));

/** Cumulative XP required to *start* at `level` (1-indexed). */
function xpTotalForLevel(level) {
  if (level <= 1) return 0;
  let sum = 0;
  for (let L = 1; L < level; L += 1) {
    sum += XP_CURVE_MULTIPLIER * L;
  }
  return sum;
}

/** XP needed to go from `level` → `level + 1`. */
function xpStepForLevel(level) {
  return XP_CURVE_MULTIPLIER * Math.max(1, level);
}

function getUncappedLevelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (xpTotalForLevel(level + 1) <= xp) {
    level += 1;
    if (level > 9999) break;
  }
  return level;
}

function getLevelFromXp(totalXp) {
  return Math.min(MAX_LEVEL, getUncappedLevelFromXp(totalXp));
}

function getXpProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = getLevelFromXp(xp);
  if (level >= MAX_LEVEL) {
    const atMax = xpTotalForLevel(MAX_LEVEL);
    const surplus = Math.max(0, xp - atMax);
    return {
      level: MAX_LEVEL,
      experiencePoints: xp,
      xpIntoCurrentLevel: surplus,
      xpToNextLevel: 0,
      percentToNextLevel: 100,
      isMaxLevel: true,
    };
  }
  const atLevelStart = xpTotalForLevel(level);
  const into = xp - atLevelStart;
  const need = xpStepForLevel(level);
  const pct = need > 0 ? Math.min(100, Math.round((into / need) * 1000) / 10) : 100;
  return {
    level,
    experiencePoints: xp,
    xpIntoCurrentLevel: into,
    xpToNextLevel: need,
    percentToNextLevel: pct,
    isMaxLevel: false,
  };
}

function badgeMeta(id) {
  return BADGE_CATALOG.find((b) => b.id === id) || null;
}

function hasBadge(userDoc, id) {
  const list = userDoc.badges || [];
  return list.some((b) => b && String(b.id) === id);
}

function pushBadge(userDoc, id) {
  if (!BADGE_IDS.has(id) || hasBadge(userDoc, id)) return false;
  if (!userDoc.badges) userDoc.badges = [];
  userDoc.badges.push({ id, earnedAt: new Date() });
  return true;
}

function syncFrameBadgesForLevel(userDoc) {
  const level = userDoc.level || 1;
  let added = false;
  FRAME_BADGE_THRESHOLDS.forEach(({ id, minLevel }) => {
    if (level >= minLevel && pushBadge(userDoc, id)) added = true;
  });
  return added;
}

function ensureProgressionFields(userDoc) {
  const legacyLevel = Math.max(1, parseInt(userDoc.level, 10) || 1);
  const rawXp = userDoc.experiencePoints;
  if (rawXp == null || Number.isNaN(Number(rawXp))) {
    userDoc.experiencePoints = xpTotalForLevel(legacyLevel);
  } else if (Number(rawXp) === 0 && legacyLevel > 1) {
    userDoc.experiencePoints = xpTotalForLevel(legacyLevel);
  }
  userDoc.level = getLevelFromXp(userDoc.experiencePoints);
}

function serializeBadgeEntry(entry) {
  const meta = badgeMeta(entry.id);
  if (!meta) return null;
  return {
    id: entry.id,
    name: meta.name,
    emoji: meta.emoji,
    description: meta.description,
    rarity: meta.rarity,
    category: meta.category,
    howToEarn: meta.howToEarn,
    earnedAt: entry.earnedAt,
  };
}

function progressionPayload(userDoc) {
  ensureProgressionFields(userDoc);
  const prog = getXpProgress(userDoc.experiencePoints);
  const earned = (userDoc.badges || [])
    .map(serializeBadgeEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

  return {
    experiencePoints: prog.experiencePoints,
    level: prog.level,
    xpIntoCurrentLevel: prog.xpIntoCurrentLevel,
    xpToNextLevel: prog.xpToNextLevel,
    percentToNextLevel: prog.percentToNextLevel,
    isMaxLevel: Boolean(prog.isMaxLevel),
    maxLevel: MAX_LEVEL,
    badgesEarned: earned,
    badgeCatalogTotal: BADGE_CATALOG.length,
  };
}

/** XP rewards per action — tune here (used by userProgressionService via loadForgeonProgression in dev). */
const XP = {
  THREAD: 120,
  THREAD_IMAGE_BONUS: 55,
  COMMENT: 35,
  FORUM_CREATED: 320,
  GROUP_CREATED: 260,
  GROUP_JOIN: 95,
  FRIEND_ADDED: 110,
  REGISTER: 80,
};

module.exports = {
  BADGE_CATALOG,
  BADGE_IDS,
  MAX_LEVEL,
  MIN_LEVEL_CREATE_GROUP,
  XP_CURVE_MULTIPLIER,
  xpTotalForLevel,
  getLevelFromXp,
  getXpProgress,
  badgeMeta,
  hasBadge,
  pushBadge,
  syncFrameBadgesForLevel,
  ensureProgressionFields,
  progressionPayload,
  XP,
};
