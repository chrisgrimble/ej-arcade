// Game rules, shared by game.js and tools/generate-levels.mjs.
// A state is an array of bottles; each bottle lists colour ids bottom -> top.

// The colour id of a rainbow layer. It matches any colour, and turns into the
// colour poured onto it, or the colour it's poured onto.
const RAINBOW = -1;

function topColour(bottle) {
  return bottle[bottle.length - 1];
}

// Number of top layers that would pour: the top run, stopping at any iced
// layer. `bottleSpecials` (optional) is that bottle's special properties.
function pourableRun(bottle, bottleSpecials) {
  let run = 0;
  for (let i = bottle.length - 1; i >= 0 && bottle[i] === topColour(bottle) && !bottleSpecials?.[i]?.iced; i--) run++;
  return run;
}

// `locks` (optional) lists each bottle's lock colour, or null if it's open;
// a locked bottle can't be poured from or into. `specials` (optional) is
// needed for iced layers, which can't be poured.
function canPour(state, from, to, cap, locks, specials) {
  if (from === to) return false;
  if (locks && (locks[from] !== null || locks[to] !== null)) return false;
  const src = state[from];
  const dst = state[to];
  if (pourableRun(src, specials?.[from]) === 0) return false;
  if (dst.length >= cap) return false;
  return dst.length === 0 || topColour(dst) === topColour(src) ||
    topColour(src) === RAINBOW || topColour(dst) === RAINBOW;
}

// The colour the poured layers end up: a rainbow takes on the colour it lands on.
function pouredColour(state, from, to) {
  const colour = topColour(state[from]);
  return colour === RAINBOW && state[to].length ? topColour(state[to]) : colour;
}

// How many layers a pour would move: the pourable run, as many as fit.
function pourAmount(state, from, to, cap, specials) {
  return Math.min(pourableRun(state[from], specials?.[from]), cap - state[to].length);
}

// Pour the run of matching top layers, as many as fit. Mutates state (but not
// specials; see pourSpecials) and returns how many layers moved.
function pour(state, from, to, cap, specials) {
  const src = state[from];
  const dst = state[to];
  const amount = pourAmount(state, from, to, cap, specials);
  const colour = pouredColour(state, from, to);
  // Rainbow layers on top of the target take on the colour poured onto them.
  if (colour !== RAINBOW) for (let i = dst.length - 1; i >= 0 && dst[i] === RAINBOW; i--) dst[i] = colour;
  for (let i = 0; i < amount; i++) {
    src.pop();
    dst.push(colour);
  }
  return amount;
}

// Full of a single colour.
function isFinished(bottle, cap) {
  return bottle.length === cap && bottle.every(c => c === bottle[0]);
}

// Won when every bottle is either empty or full of a single colour.
function isWon(state, cap) {
  return state.every(b => b.length === 0 || isFinished(b, cap));
}

function cloneState(state) {
  return state.map(b => b.slice());
}

// ---------- special layers ----------
// In a level, a plain layer is just its colour number. A special layer is an
// object with its colour and one or more special properties, for example
// { colour: 2, hidden: true }. A rainbow layer is { rainbow: true }: rainbow
// is its colour (RAINBOW, above) rather than a special property.
//
// During play the colours (the puzzle state above) and the special properties
// are kept side by side: `specials` has the same shape as the bottles, with an
// object per layer ({} for a plain one). Properties travel with their layer
// when it's poured.
//
// Special kinds so far:
//   hidden: face down, so its colour isn't shown. It turns face up once it's
//           the top layer of its bottle, or its bottle is finished. It doesn't
//           change which pours are allowed.
//   iced:   frozen, so it can't be poured, and nothing below it can either.
//           It melts once a layer of the same colour sits on top of it, or
//           its bottle is finished.
//
// To add a kind: give layers the new property in levels.js, apply its effects
// in settleSpecials (after each pour) and, if it limits pouring, in canPour and
// the solver, then draw it in game.js's render().

const SPECIAL_KINDS = ["hidden", "iced"];

function layerColour(layer) {
  if (typeof layer === "number") return layer;
  return layer.rainbow ? RAINBOW : layer.colour;
}

function layerSpecials(layer) {
  if (typeof layer === "number") return {};
  const specials = {};
  for (const kind of SPECIAL_KINDS) if (layer[kind]) specials[kind] = layer[kind];
  return specials;
}

// The plain colours of a level's bottles, for the rules and the solver.
function levelColours(level) {
  return level.bottles.map(b => b.map(layerColour));
}

// The special properties of a level's layers, settled as they'd be at the start.
function levelSpecials(level) {
  const specials = level.bottles.map(b => b.map(layerSpecials));
  return settleSpecials(levelColours(level), specials, level.capacity);
}

function cloneSpecials(specials) {
  return specials.map(b => b.map(s => ({ ...s })));
}

// Moves the special properties of the top `amount` layers along with a pour.
function pourSpecials(specials, from, to, amount) {
  const moved = specials[from].splice(specials[from].length - amount, amount);
  specials[to].push(...moved.reverse());
}

// Applies the rules for special layers after the bottles change. Returns new
// specials; doesn't change the ones passed in.
function settleSpecials(state, specials, cap) {
  return state.map((bottle, b) => {
    const finished = isFinished(bottle, cap);
    return bottle.map((_, depth) => {
      const s = { ...(specials[b][depth] || {}) };
      // Hidden: face up once on top of its bottle, or the bottle is finished.
      if (s.hidden && (depth === bottle.length - 1 || finished)) delete s.hidden;
      // Iced: melts under the same colour, or once the bottle is finished.
      if (s.iced && (bottle[depth + 1] === bottle[depth] || finished)) delete s.iced;
      return s;
    });
  });
}

function hasHiddenLayers(specials) {
  return specials.some(b => b.some(s => s.hidden));
}

function hasIcedLayers(specials) {
  return specials.some(b => b.some(s => s.iced));
}

// ---------- locked bottles ----------
// A level can have `locks`, one entry per bottle: the colour id that opens it,
// or null for an open bottle. A locked bottle can't be poured from or into
// until a bottle of its colour is finished. Once open it stays open, even if
// that bottle is poured out again, so `locks` is part of the game state.

function levelLocks(level) {
  return settleLocks(levelColours(level), level.locks ?? level.bottles.map(() => null), level.capacity);
}

// Opens any lock whose colour has a finished bottle. Returns new locks.
function settleLocks(state, locks, cap) {
  return locks.map(colour =>
    colour !== null && state.some(b => isFinished(b, cap) && b[0] === colour) ? null : colour);
}

function hasLocks(locks) {
  return locks.some(colour => colour !== null);
}

// 3 stars for the fewest possible moves, 2 for up to 50% more, otherwise 1.
function starsFor(moves, par) {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

// Shortest list of pours that wins from this state, as [from, to] pairs.
// Returns [] if already won, null if it can't be won, or undefined if it gave
// up after looking at `limit` states. `startLocks` and `startSpecials` are
// optional; of the specials, only ice matters to the solver.
function solve(start, cap, limit = 3000000, startLocks = null, startSpecials = null) {
  if (isWon(start, cap)) return [];
  if (startSpecials && !hasIcedLayers(startSpecials)) startSpecials = null;
  // Bottle order doesn't matter for solving, so sort to merge equivalent
  // states. Locks and ice stay with their bottle, so they're part of its key.
  const key = (s, locks, sp) => s.map((b, i) => (locks?.[i] ?? "") + ":" +
    b.map((c, d) => (sp?.[i][d].iced ? c + "*" : c)).join(",")).sort().join("|");
  // Each state remembers the state it came from and the pour that got there.
  const cameFrom = new Map([[key(start, startLocks, startSpecials), null]]);
  let frontier = [[start, startLocks, startSpecials]];
  while (frontier.length > 0) {
    const next = [];
    for (const [s, locks, sp] of frontier) {
      const sKey = key(s, locks, sp);
      for (let from = 0; from < s.length; from++) {
        for (let to = 0; to < s.length; to++) {
          if (!canPour(s, from, to, cap, locks, sp)) continue;
          const n = cloneState(s);
          const amount = pour(n, from, to, cap, sp);
          const nLocks = locks && settleLocks(n, locks, cap);
          let nSp = null;
          if (sp) {
            nSp = cloneSpecials(sp);
            pourSpecials(nSp, from, to, amount);
            nSp = settleSpecials(n, nSp, cap);
          }
          const nKey = key(n, nLocks, nSp);
          if (cameFrom.has(nKey)) continue;
          cameFrom.set(nKey, [sKey, from, to]);
          if (isWon(n, cap)) {
            const path = [];
            for (let step = cameFrom.get(nKey); step; step = cameFrom.get(step[0])) {
              path.unshift([step[1], step[2]]);
            }
            return path;
          }
          if (cameFrom.size > limit) return undefined;
          next.push([n, nLocks, nSp]);
        }
      }
    }
    frontier = next;
  }
  return null;
}
