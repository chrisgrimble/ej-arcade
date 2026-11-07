'use strict';
// High score tables, one for the four-course rally and one for Badlands, kept in localStorage.
const TABLE_SIZE = 10, NAME_LEN = 3;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NAME_PATTERN = /^[A-Z?]{3}$/;
const INITIALS_KEY = 'mudlark-initials';
const tableCache = {};

// Storage can be unavailable or full (private windows, blocked site data), so the game
// carries on with in-memory tables if reading or writing fails.
function readStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

const tableKey = free => (free ? 'mudlark-scores-badlands' : 'mudlark-scores-rally');

function loadTable(free) {
  if (tableCache[free]) return tableCache[free];
  let rows = [];
  try { rows = JSON.parse(readStored(tableKey(free))) || []; } catch { /* corrupt entry: start afresh */ }
  if (!Array.isArray(rows)) rows = [];
  rows = rows
    .filter(r => r && NAME_PATTERN.test(r.name) && Number.isFinite(r.score) && r.score > 0)
    .map(r => ({ name: r.name, score: r.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TABLE_SIZE);
  return (tableCache[free] = rows);
}

function saveTable(free, rows) {
  tableCache[free] = rows;
  writeStored(tableKey(free), JSON.stringify(rows));
}

const topScore = free => (loadTable(free)[0] || { score: 0 }).score;

function qualifies(free, score) {
  const rows = loadTable(free);
  return score > 0 && (rows.length < TABLE_SIZE || score > rows[rows.length - 1].score);
}

// Returns the new entry's position in the table.
function addTableEntry(free, name, score) {
  const entry = { name, score };
  const rows = [...loadTable(free), entry].sort((a, b) => b.score - a.score).slice(0, TABLE_SIZE);
  saveTable(free, rows);
  writeStored(INITIALS_KEY, name);
  requestPersistentStorage();
  return rows.indexOf(entry);
}

function lastInitials() {
  const name = readStored(INITIALS_KEY);
  return /^[A-Z]{3}$/.test(name) ? name : 'AAA';
}

// Earlier versions kept a single best score per mode; carry it over once as a table entry.
function migrateOldBests() {
  for (const free of [false, true]) {
    const key = free ? 'mudlark-rally-best-free' : 'mudlark-rally-best';
    const old = Number(readStored(key));
    if (old > 0 && !loadTable(free).length) saveTable(free, [{ name: '???', score: old }]);
    if (readStored(tableKey(free))) {
      try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    }
  }
}

// Ask the browser not to clear the game's storage when space runs low. Browsers decide
// for themselves; Chrome tends to agree for an installed app or a frequently used site.
function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
