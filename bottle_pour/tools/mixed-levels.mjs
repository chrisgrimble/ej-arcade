// Generates levels that mix locked bottles, iced, rainbow and hidden layers,
// checking each one with the solver in rules.js. Prints one levels.js line
// (plus a comment) per level.
//
//   node tools/mixed-levels.mjs 51 52 53    # just those levels
//   node tools/mixed-levels.mjs             # every level in SPECS
//
// The same level number always gives the same level, so it can be rerun.

import fs from "fs";
import { fileURLToPath } from "url";
import vm from "vm";

const dir = fileURLToPath(new URL("..", import.meta.url));
vm.runInThisContext(fs.readFileSync(dir + "rules.js", "utf8"));

const CAP = 4;
const SOLVE_LIMIT = 2000000;
const HINT_LIMIT = 200000;   // as in game.js
const MAX_TRIES = 60;

// What each level is made of. `empties` is the number of empty bottles,
// `lockSpare` locks one of them, `lockFull` locks a bottle with liquid in it,
// and `par` is the range of fewest moves wanted.
const SPECS = {
  51: { colours: 5, empties: 2, ice: 1, lockSpare: true, par: [14, 20] },
  52: { colours: 5, empties: 2, rainbows: 2, ice: 1, par: [14, 20] },
  53: { colours: 6, empties: 2, rainbows: 2, lockFull: true, par: [16, 22] },
  54: { colours: 6, empties: 2, ice: 2, hidden: 4, par: [16, 22] },
  55: { colours: 6, empties: 2, ice: 2, lockSpare: true, par: [16, 22] },
  56: { colours: 6, empties: 2, rainbows: 2, hidden: 4, par: [16, 23] },
  57: { colours: 6, empties: 2, rainbows: 2, ice: 1, lockSpare: true, par: [17, 23] },
  58: { colours: 7, empties: 2, ice: 3, lockFull: true, par: [18, 25] },
  59: { colours: 7, empties: 3, rainbows: 3, lockSpare: true, par: [18, 25] },
  60: { colours: 7, empties: 2, rainbows: 2, ice: 2, hidden: 5, par: [18, 25] },
  61: { colours: 7, empties: 3, ice: 2, lockFull: true, lockSpare: true, par: [19, 26] },
  62: { colours: 7, empties: 3, rainbows: 2, ice: 2, lockSpare: true, par: [19, 26] },
  63: { colours: 7, empties: 2, ice: 2, hidden: 8, par: [19, 26] },
  64: { colours: 7, empties: 2, rainbows: 3, ice: 2, par: [20, 27] },
  65: { colours: 7, empties: 3, rainbows: 2, lockFull: true, lockSpare: true, hidden: 4, par: [20, 27] },
  66: { colours: 8, empties: 3, ice: 3, lockSpare: true, par: [21, 28] },
  67: { colours: 8, empties: 2, rainbows: 3, hidden: 6, par: [21, 28] },
  68: { colours: 8, empties: 2, rainbows: 2, ice: 2, lockFull: true, par: [22, 29] },
  69: { colours: 8, empties: 3, rainbows: 2, ice: 3, lockSpare: true, hidden: 4, par: [22, 30] },
  70: { colours: 8, empties: 3, rainbows: 3, ice: 2, lockFull: true, lockSpare: true, hidden: 4, par: [22, 30] },
};

function makeRandom(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const permutations = list => list.length <= 1 ? [list] :
  list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p]));

// One random attempt at a level: { bottles, locks } in levels.js form, or null.
function deal(spec, rand) {
  const { colours, empties } = spec;
  const layers = shuffle([...Array(colours)].flatMap((_, c) => [c, c, c, c]), rand);
  const colourBottles = [...Array(colours)].map((_, i) => layers.slice(i * CAP, (i + 1) * CAP));
  // No bottle that's nearly sorted to begin with.
  if (colourBottles.some(b => b[3] === b[2] || (b[0] === b[1] && b[1] === b[2]))) return null;
  const bottles = [...colourBottles, ...[...Array(empties)].map(() => [])];
  const layerAt = bottles.map(b => b.map(colour => ({ colour })));
  const spots = () => shuffle(layerAt.flatMap((b, i) => b.map((layer, d) => ({ i, d, layer }))), rand);

  // Rainbows replace one layer each of different colours, in different bottles.
  const rainbowBottles = new Set();
  for (const colour of shuffle([...Array(colours).keys()], rand).slice(0, spec.rainbows || 0)) {
    const spot = spots().find(s => s.layer.colour === colour && !rainbowBottles.has(s.i));
    if (!spot) return null;
    rainbowBottles.add(spot.i);
    layerAt[spot.i][spot.d] = { rainbow: true };
  }
  // Ice on plain layers, never right under its own colour (it would melt at once).
  const iceSpots = spots().filter(({ i, d, layer }) =>
    !layer.rainbow && layerAt[i][d + 1]?.colour !== layer.colour);
  if (iceSpots.length < (spec.ice || 0)) return null;
  for (const { layer } of iceSpots.slice(0, spec.ice || 0)) layer.iced = true;
  // Hidden layers anywhere but the top, not on ice.
  const hideSpots = spots().filter(({ i, d, layer }) => d < layerAt[i].length - 1 && !layer.iced);
  for (const { layer } of hideSpots.slice(0, spec.hidden || 0)) layer.hidden = true;

  let locks = null;
  if (spec.lockFull || spec.lockSpare) {
    locks = bottles.map(() => null);
    const keys = shuffle([...Array(colours).keys()], rand);
    if (spec.lockFull) {
      // A bottle with liquid, locked by a colour it doesn't hold.
      const i = Math.floor(rand() * colours);
      const key = keys.find(c => !layerAt[i].some(layer => layer.colour === c));
      locks[i] = key;
      keys.splice(keys.indexOf(key), 1);
    }
    if (spec.lockSpare) locks[colours] = keys[0];
  }

  const level = {
    capacity: CAP,
    bottles: layerAt.map(b => b.map(layer =>
      layer.rainbow ? { rainbow: true } : (layer.iced || layer.hidden ? layer : layer.colour))),
  };
  if (locks) level.locks = locks;
  return level;
}

function solveLevel(level, limit = SOLVE_LIMIT) {
  return solve(levelColours(level), CAP, limit, level.locks ? levelLocks(level) : null, levelSpecials(level));
}

// How many ways of giving the rainbows the short colours can be won. Each
// rainbow should really be able to become more than one colour.
function rainbowChoices(level) {
  const colours = levelColours(level);
  const spots = colours.flatMap((b, i) => b.map((c, d) => [i, d, c])).filter(s => s[2] === RAINBOW);
  if (spots.length === 0) return null;
  const counts = {};
  colours.flat().forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  const short = Object.keys(counts).map(Number).filter(c => c !== RAINBOW && counts[c] < CAP);
  return permutations(short).filter(order => {
    const assigned = { ...level, bottles: level.bottles.map(b => b.slice()) };
    spots.forEach(([i, d], n) => {
      const layer = assigned.bottles[i][d];
      assigned.bottles[i][d] = { ...layer, rainbow: undefined, colour: order[n] };
    });
    return solveLevel(assigned, SOLVE_LIMIT / 2);
  }).length;
}

function describe(spec) {
  const parts = [];
  if (spec.lockFull && spec.lockSpare) parts.push("two locked bottles");
  else if (spec.lockFull || spec.lockSpare) parts.push("a locked bottle");
  if (spec.ice) parts.push(spec.ice === 1 ? "an iced layer" : `${spec.ice} iced layers`);
  if (spec.rainbows) parts.push(`${spec.rainbows} rainbow layers`);
  if (spec.hidden) parts.push("some layers hidden");
  return parts.join(", ");
}

function generate(number) {
  const spec = SPECS[number];
  const rand = makeRandom(number * 7919);
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const level = deal(spec, rand);
    if (!level) continue;
    const path = solveLevel(level);
    if (!path || path.length < spec.par[0] || path.length > spec.par[1]) continue;
    if (spec.rainbows && rainbowChoices(level) < 2) continue;
    const hint = spec.hidden ? "hint after reveal" : (solveLevel(level, HINT_LIMIT) ? "hint ok" : "no hint at start");
    const ordered = { capacity: level.capacity, par: path.length, bottles: level.bottles };
    if (level.locks) ordered.locks = level.locks;
    const json = JSON.stringify(ordered).replace(/^\{"capacity":4,"par":(\d+),/, "{ capacity: 4, par: $1, ")
      .replace(',"locks":', ", locks: ").replace('"bottles":', "bottles: ").replace(/\}$/, " }");
    return `  // Level ${number}: ${level.bottles.length} bottles, par ${path.length}, ${describe(spec)}\n  ${json},` +
      `\n  // (attempt ${attempt}, ${hint})`;
  }
  return `  // Level ${number}: NOT FOUND in ${MAX_TRIES} tries`;
}

const numbers = process.argv.slice(2).map(Number);
for (const number of numbers.length ? numbers : Object.keys(SPECS).map(Number)) {
  console.log(generate(number));
}
