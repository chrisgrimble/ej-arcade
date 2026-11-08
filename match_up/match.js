'use strict';
// Match Up: flip the cards over two at a time and find the pairs.

const SIZES = [
  { cards: 6, cols: 3, rows: 2 },
  { cards: 12, cols: 4, rows: 3 },
  { cards: 16, cols: 4, rows: 4 },
  { cards: 20, cols: 5, rows: 4 },
];
// Each theme needs at least as many pictures as the biggest grid has pairs.
const THEMES = [
  { name: 'Animals', pictures: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵'] },
  { name: 'Things that go', pictures: ['🚗', '🚌', '🚓', '🚑', '🚒', '🚜', '🚲', '🚀', '✈️', '🚂', '🚁', '⛵'] },
  { name: 'Fruit', pictures: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🍉', '🍋', '🍐', '🥥'] },
  { name: 'Under the sea', pictures: ['🐠', '🐙', '🦀', '🐳', '🐬', '🦈', '🐢', '🦑', '🐡', '🦞', '🐚', '🦭'] },
];
const SIZE_KEY = 'match-up-size';
const DONE_KEY = 'match-up-done';   // { theme name: most cards completed }

const $ = id => document.getElementById(id);
const area = $('area');
const grid = $('cards');

let size = SIZES[0];
try { size = SIZES.find(s => s.cards === Number(localStorage.getItem(SIZE_KEY))) || size; } catch {}
let done = {};
try { done = JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch {}

// ---------- Sounds ----------
let audio;
function tone(freq, endFreq, dur, type = 'sine', vol = 0.12, when = 0) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + when;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* no sound available */ }
}
// Every picture in a game gets its own note, so a pair sounds the same and
// can be remembered by ear. A pentatonic scale keeps any two notes friendly.
const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
const pickSound = () => tone(500, 650, 0.06, 'triangle', 0.08);
const flipSound = note => tone(note, note, 0.22, 'triangle', 0.12);
const matchSound = note => { tone(note, note, 0.15, 'triangle', 0.1, 0.12); tone(note * 1.5, note * 1.5, 0.25, 'triangle', 0.1, 0.24); };
const missSound = () => tone(330, 220, 0.25, 'sine', 0.1, 0.1);
const fanfare = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.12, i * 0.13));

// ---------- Menu ----------
function buildMenu() {
  const sizes = $('sizes');
  sizes.innerHTML = '';
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.className = 'size' + (s === size ? ' on' : '');
    b.setAttribute('aria-label', s.cards + ' cards');
    b.innerHTML = `<span class="grid" style="grid-template-columns: repeat(${s.cols}, 7px)">${'<i></i>'.repeat(s.cards)}</span>${s.cards}`;
    b.addEventListener('click', () => {
      size = s;
      try { localStorage.setItem(SIZE_KEY, s.cards); } catch {}
      pickSound();
      buildMenu();
    });
    sizes.appendChild(b);
  }

  const themes = $('themes');
  themes.innerHTML = '';
  for (const theme of THEMES) {
    const b = document.createElement('button');
    b.className = 'theme';
    b.innerHTML = `<span class="peek">${theme.pictures.slice(0, 3).join('')}</span>${theme.name}`;
    if (done[theme.name]) b.insertAdjacentHTML('beforeend', `<span class="done">⭐ ${done[theme.name]}</span>`);
    b.addEventListener('click', () => start(theme));
    themes.appendChild(b);
  }
}

$('home').addEventListener('click', () => { location.href = '../'; });

// ---------- Game state ----------
let theme, cards = [], up = [], matched = 0, goes = 0, busy = false;

function show(id) {
  for (const s of ['menu', 'play']) $(s).hidden = s !== id;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function start(chosen) {
  theme = chosen;
  const pairs = size.cards / 2;
  const pictures = shuffle([...theme.pictures]).slice(0, pairs);
  cards = shuffle(pictures.flatMap((picture, i) => [0, 1].map(() => ({ picture, note: NOTES[i] }))));
  up = [];
  matched = 0;
  goes = 0;
  busy = false;

  grid.innerHTML = '';
  for (const card of cards) {
    const b = document.createElement('button');
    b.className = 'card';
    b.setAttribute('aria-label', 'Hidden card');
    b.innerHTML = `<span class="inner"><span class="back">?</span><span class="face">${card.picture}</span></span>`;
    b.addEventListener('click', () => flip(card));
    card.el = b;
    grid.appendChild(b);
  }
  updateCount();
  $('win').hidden = true;
  show('play');
  pickSound();
  requestAnimationFrame(layout);
}

// Fit the grid to the screen, turning it on its side when the screen is taller than wide.
function layout() {
  const W = area.clientWidth, H = area.clientHeight;
  let { cols, rows } = size;
  if (H > W && cols > rows) [cols, rows] = [rows, cols];
  const gap = Math.max(6, Math.min(14, Math.min(W, H) * 0.02));
  const card = Math.floor(Math.min((W - gap * (cols - 1)) / cols, (H - 6 - gap * (rows - 1)) / rows, 170));
  grid.style.setProperty('--card', card + 'px');
  grid.style.setProperty('--gap', gap + 'px');
  grid.style.gridTemplateColumns = `repeat(${cols}, ${card}px)`;
}

function updateCount() {
  $('count').textContent = `${matched} / ${cards.length / 2} pairs`;
}

function flip(card) {
  if (busy || card.up) return;
  card.up = true;
  card.el.classList.add('up');
  card.el.setAttribute('aria-label', card.picture);
  flipSound(card.note);
  up.push(card);
  if (up.length < 2) return;

  goes++;
  const [a, b] = up;
  up = [];
  if (a.picture === b.picture) {
    matched++;
    updateCount();
    matchSound(a.note);
    for (const c of [a, b]) setTimeout(() => c.el.classList.add('matched'), 300);
    if (matched === cards.length / 2) setTimeout(win, 900);
    return;
  }
  // Not a pair: give a moment to look, then turn both back over.
  busy = true;
  missSound();
  setTimeout(() => { for (const c of [a, b]) c.el.classList.add('miss'); }, 350);
  setTimeout(() => {
    for (const c of [a, b]) {
      c.up = false;
      c.el.classList.remove('up', 'miss');
      c.el.setAttribute('aria-label', 'Hidden card');
    }
    busy = false;
  }, 1100);
}

// ---------- Buttons ----------
$('back').addEventListener('click', () => { show('menu'); buildMenu(); });
$('restart').addEventListener('click', () => start(theme));
$('again').addEventListener('click', () => start(theme));
$('next').addEventListener('click', () => { $('win').hidden = true; show('menu'); buildMenu(); });

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!$('play').hidden) layout(); }, 150);
});

// ---------- Well done! ----------
function win() {
  done[theme.name] = Math.max(done[theme.name] || 0, size.cards);
  try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch {}
  // Perfect memory takes one go per pair; lucky guesses can't beat that.
  const pairs = cards.length / 2;
  const stars = goes <= pairs * 1.5 ? 3 : goes <= pairs * 2.2 ? 2 : 1;
  $('stars').textContent = '⭐'.repeat(stars);
  $('goes').textContent = `${pairs} pairs in ${goes} goes`;
  fanfare();
  confetti();
  $('win').hidden = false;
}

function confetti() {
  const c = $('confetti');
  const ctx = c.getContext('2d');
  c.width = innerWidth;
  c.height = innerHeight;
  const colours = ['#ff4d4d', '#ffa64d', '#ffe14d', '#5be36b', '#4dc3ff', '#9b6bff', '#ff5fa2'];
  const bits = Array.from({ length: 140 }, () => ({
    x: Math.random() * c.width, y: -Math.random() * c.height * 0.6,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    r: Math.random() * 6, spin: (Math.random() - 0.5) * 0.3,
    colour: colours[Math.floor(Math.random() * colours.length)],
  }));
  const end = performance.now() + 3500;
  (function frame(now) {
    ctx.clearRect(0, 0, c.width, c.height);
    if (now > end) return;
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.r += b.spin;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.colour;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  })(performance.now());
}

buildMenu();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
