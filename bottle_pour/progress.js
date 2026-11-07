// Saves each player's level, keyed by their name.
//
// Progress goes in a cookie. Chrome ignores cookies on pages opened straight
// from disk (file://), so when cookies don't stick we fall back to localStorage.

const COOKIE_DAYS = 365;
// A page can set BOTTLE_POUR_STORAGE_PREFIX first to keep its saves separate
// (see the --storage option of tools/bundle.mjs).
const KEY_PREFIX = globalThis.BOTTLE_POUR_STORAGE_PREFIX ?? "bottlePour_";
const LAST_PLAYER_KEY = KEY_PREFIX + "lastPlayer";

// Names match regardless of case or surrounding spaces.
function playerKey(name) {
  return KEY_PREFIX + "player_" + encodeURIComponent(name.trim().toLowerCase());
}

const cookiesWork = (() => {
  try {
    document.cookie = `${KEY_PREFIX}test=1; path=/; SameSite=Lax`;
    const ok = document.cookie.includes(`${KEY_PREFIX}test=1`);
    document.cookie = `${KEY_PREFIX}test=; max-age=0; path=/`;
    return ok;
  } catch {
    return false;
  }
})();

function readValue(key) {
  if (cookiesWork) {
    const match = document.cookie.split("; ").find(c => c.startsWith(key + "="));
    return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeValue(key, value) {
  if (cookiesWork) {
    const maxAge = COOKIE_DAYS * 24 * 60 * 60;
    document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (e.g. private browsing) - progress just won't be kept.
  }
}

// Every stored key, from whichever storage is in use.
function storedKeys() {
  if (cookiesWork) {
    return document.cookie.split("; ").filter(Boolean).map(c => c.slice(0, c.indexOf("=")));
  }
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  } catch {
    return [];
  }
}

// A save holds the name as the player typed it, when they last played,
// `unlocked` (the furthest level index they can play) and `stars` (their best
// rating per level index, 0 = not solved yet).
function parseSave(raw) {
  if (raw === null) return null;
  // Older saves stored just the next level number.
  if (/^\d+$/.test(raw)) return { unlocked: parseInt(raw, 10), stars: [] };
  try {
    const saved = JSON.parse(raw);
    return {
      name: typeof saved.name === "string" ? saved.name : undefined,
      lastPlayed: Number(saved.lastPlayed) || 0,
      unlocked: Number.isInteger(saved.unlocked) && saved.unlocked >= 0 ? saved.unlocked : 0,
      stars: Array.isArray(saved.stars) ? saved.stars.map(s => Number(s) || 0) : [],
    };
  } catch {
    return null;
  }
}

function loadProgress(name) {
  const saved = parseSave(readValue(playerKey(name)));
  return saved ? { unlocked: saved.unlocked, stars: saved.stars } : { unlocked: 0, stars: [] };
}

function saveProgress(name, progress) {
  const save = { name: name.trim(), lastPlayed: Date.now(), unlocked: progress.unlocked, stars: progress.stars };
  writeValue(playerKey(name), JSON.stringify(save));
}

// Everyone who has played on this device, most recently played first, as
// { name, unlocked, totalStars }. Saves from before names were stored show
// the lower-case name used as the key.
function listPlayers() {
  const prefix = KEY_PREFIX + "player_";
  return storedKeys()
    .filter(key => key.startsWith(prefix))
    .map(key => {
      const saved = parseSave(readValue(key));
      if (!saved) return null;
      return {
        name: saved.name || decodeURIComponent(key.slice(prefix.length)),
        lastPlayed: saved.lastPlayed || 0,
        unlocked: saved.unlocked,
        totalStars: saved.stars.reduce((sum, s) => sum + s, 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .map(({ lastPlayed, ...player }) => player);
}

function loadLastPlayer() {
  return readValue(LAST_PLAYER_KEY) || "";
}

function saveLastPlayer(name) {
  writeValue(LAST_PLAYER_KEY, name.trim());
}
