'use strict';
// Puzzle Pals: jigsaw puzzles for kids, from 9 to 20 pieces.

const SIZES = [
  { pieces: 9, cols: 3, rows: 3 },
  { pieces: 12, cols: 4, rows: 3 },
  { pieces: 16, cols: 4, rows: 4 },
  { pieces: 20, cols: 5, rows: 4 },
];
const SIZE_KEY = 'puzzle-pals-size';
const DONE_KEY = 'puzzle-pals-done';   // { scene name: most pieces completed }

const $ = id => document.getElementById(id);
const area = $('area');
const board = $('board');

let size = SIZES[0];
try { size = SIZES.find(s => s.pieces === Number(localStorage.getItem(SIZE_KEY))) || size; } catch {}
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
const pickSound = () => tone(500, 650, 0.06, 'triangle', 0.08);
const snapSound = () => { tone(880, 1320, 0.08, 'square', 0.05); tone(1320, 1760, 0.1, 'triangle', 0.08, 0.06); };
const fanfare = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.12, i * 0.13));

// ---------- Menu ----------
function buildMenu() {
  const sizes = $('sizes');
  sizes.innerHTML = '';
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.className = 'size' + (s === size ? ' on' : '');
    b.setAttribute('aria-label', s.pieces + ' pieces');
    b.innerHTML = `<span class="grid" style="grid-template-columns: repeat(${s.cols}, 7px)">${'<i></i>'.repeat(s.pieces)}</span>${s.pieces}`;
    b.addEventListener('click', () => {
      size = s;
      try { localStorage.setItem(SIZE_KEY, s.pieces); } catch {}
      pickSound();
      buildMenu();
    });
    sizes.appendChild(b);
  }

  const pictures = $('pictures');
  pictures.innerHTML = '';
  for (const scene of SCENES) {
    const b = document.createElement('button');
    b.className = 'picture';
    const thumb = document.createElement('canvas');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    thumb.width = 240 * dpr;
    thumb.height = 180 * dpr;
    const ctx = thumb.getContext('2d');
    ctx.scale(dpr, dpr);
    scene.draw(ctx, 240, 180);
    b.appendChild(thumb);
    b.append(scene.name);
    if (done[scene.name]) b.insertAdjacentHTML('beforeend', `<span class="done">⭐ ${done[scene.name]}</span>`);
    b.addEventListener('click', () => start(scene));
    pictures.appendChild(b);
  }
  const photo = document.createElement('button');
  photo.className = 'picture';
  photo.innerHTML = '<span class="photo">📷</span>My Photo';
  photo.addEventListener('click', () => $('photo-input').click());
  pictures.appendChild(photo);
}

$('photo-input').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const img = new Image();
  img.onload = () => start(photoScene(img));
  img.src = URL.createObjectURL(file);
});

$('home').addEventListener('click', () => { location.href = '../'; });

// ---------- Puzzle state ----------
let scene, edgesH, edgesV, pieces = [], placedCount = 0, peek = true;
let L = null;        // layout: board position and piece sizes, in CSS pixels
let picture;         // the whole picture drawn at board size
let topZ = 10;

function show(id) {
  for (const s of ['menu', 'play']) $(s).hidden = s !== id;
}

function start(chosen) {
  scene = chosen;
  const { cols, rows } = size;
  // Each inside edge gets a tab pointing one way or the other: +1 means the
  // tab sticks down (horizontal edges) or right (vertical edges).
  const flip = () => (Math.random() < 0.5 ? 1 : -1);
  edgesH = Array.from({ length: rows + 1 }, () => Array.from({ length: cols }, flip));
  edgesV = Array.from({ length: rows }, () => Array.from({ length: cols + 1 }, flip));
  for (const p of pieces) p.el?.remove();
  pieces = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pieces.push({ r, c, placed: false });
  placedCount = 0;
  $('win').hidden = true;
  show('play');
  pickSound();
  requestAnimationFrame(layout);
}

// ---------- Piece shapes ----------
// Follows one side of a piece. t is 0 for a flat edge, +1 for a tab sticking
// out, -1 for a hole. Sides are walked clockwise, so "out" is to the left of
// the direction of travel.
function edge(path, x0, y0, x1, y1, t, S) {
  if (!t) { path.lineTo(x1, y1); return; }
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;   // along the edge
  const nx = uy, ny = -ux;              // outwards
  const mx = x0 + dx / 2, my = y0 + dy / 2;
  const P = (u, v) => [mx + (u * ux + v * t * nx) * S, my + (u * uy + v * t * ny) * S];
  path.lineTo(...P(-0.12, 0));
  path.bezierCurveTo(...P(-0.1, 0.08), ...P(-0.24, 0.27), ...P(0, 0.27));
  path.bezierCurveTo(...P(0.24, 0.27), ...P(0.1, 0.08), ...P(0.12, 0));
  path.lineTo(x1, y1);
}

// The outline of piece p with its cell's top-left corner at (ox, oy).
function piecePath(p, ox, oy) {
  const { cols, rows } = size;
  const { cw, ch, S } = L;
  const top = p.r === 0 ? 0 : -edgesH[p.r][p.c];
  const bottom = p.r === rows - 1 ? 0 : edgesH[p.r + 1][p.c];
  const left = p.c === 0 ? 0 : -edgesV[p.r][p.c];
  const right = p.c === cols - 1 ? 0 : edgesV[p.r][p.c + 1];
  const path = new Path2D();
  path.moveTo(ox, oy);
  edge(path, ox, oy, ox + cw, oy, top, S);
  edge(path, ox + cw, oy, ox + cw, oy + ch, right, S);
  edge(path, ox + cw, oy + ch, ox, oy + ch, bottom, S);
  edge(path, ox, oy + ch, ox, oy, left, S);
  path.closePath();
  return path;
}

// ---------- Layout ----------
// The board sits at the top (or left, when the screen is wide) and loose
// pieces are scattered in the space that's left.
function layout() {
  const W = area.clientWidth, H = area.clientHeight;
  if (!W || !H) return;
  const wide = W > H * 1.15;
  const bw = wide ? Math.min(W * 0.55 - 16, (H - 16) * 4 / 3) : Math.min(W - 16, H * 0.46 * 4 / 3);
  const bh = bw * 3 / 4;
  const bx = wide ? 8 : (W - bw) / 2;
  const by = wide ? (H - bh) / 2 : 8;
  const tray = wide
    ? { x: bx + bw + 14, y: 0, w: W - (bx + bw + 14), h: H }
    : { x: 0, y: by + bh + 14, w: W, h: H - (by + bh + 14) };
  const cw = bw / size.cols, ch = bh / size.rows, S = Math.min(cw, ch);
  const m = Math.ceil(S * 0.3) + 2;   // room around a cell for its tabs
  const dpr = Math.min(devicePixelRatio || 1, 2);
  L = { W, H, bx, by, bw, bh, cw, ch, S, m, dpr, tray };

  picture = document.createElement('canvas');
  picture.width = Math.round(bw * dpr);
  picture.height = Math.round(bh * dpr);
  const pctx = picture.getContext('2d');
  pctx.scale(dpr, dpr);
  scene.draw(pctx, bw, bh);

  drawBoard();
  for (const p of pieces) renderPiece(p);
  scatter(pieces.filter(p => !p.placed));
  for (const p of pieces) if (p.placed) moveTo(p, ...home(p));
  updateCount();
}

function drawBoard() {
  const { bx, by, bw, bh, dpr } = L;
  Object.assign(board.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
  board.width = Math.round(bw * dpr);
  board.height = Math.round(bh * dpr);
  const ctx = board.getContext('2d');
  ctx.scale(dpr, dpr);
  if (peek) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(picture, 0, 0, bw, bh);
    ctx.globalAlpha = 1;
  }
  // faint outlines of every piece so kids can see the shapes to fill
  ctx.strokeStyle = 'rgba(0,60,60,.25)';
  ctx.lineWidth = 1.5;
  for (const p of pieces) ctx.stroke(piecePath(p, p.c * L.cw, p.r * L.ch));
}

function renderPiece(p) {
  const { cw, ch, m, dpr } = L;
  if (!p.el) {
    p.el = document.createElement('canvas');
    p.el.className = 'piece';
    area.appendChild(p.el);
  }
  const w = cw + 2 * m, h = ch + 2 * m;
  p.el.width = Math.round(w * dpr);
  p.el.height = Math.round(h * dpr);
  p.el.style.width = w + 'px';
  p.el.style.height = h + 'px';
  p.el.classList.toggle('placed', p.placed);
  p.el.classList.toggle('loose', !p.placed);
  p.path = piecePath(p, m, m);
  const ctx = p.el.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.save();
  ctx.clip(p.path);
  ctx.drawImage(picture, m - p.c * cw, m - p.r * ch, L.bw, L.bh);
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.stroke(p.path);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.stroke(p.path);
}

// Where a piece's canvas goes when the piece is in its right place.
const home = p => [L.bx + p.c * L.cw - L.m, L.by + p.r * L.ch - L.m];

function moveTo(p, x, y) {
  p.x = x;
  p.y = y;
  p.el.style.left = x + 'px';
  p.el.style.top = y + 'px';
}

// Spread pieces over the tray in a jittered, shuffled grid.
function scatter(loose) {
  const { tray, cw, ch, m, W, H } = L;
  const n = loose.length;
  if (!n) return;
  const cols = Math.max(1, Math.round(Math.sqrt(n * tray.w / tray.h)));
  const rows = Math.ceil(n / cols);
  const spots = [];
  for (let i = 0; i < cols * rows; i++) spots.push(i);
  spots.sort(() => Math.random() - 0.5);
  const sw = tray.w / cols, sh = tray.h / rows;
  loose.forEach((p, i) => {
    const s = spots[i];
    const cx = tray.x + (s % cols + 0.5 + (Math.random() - 0.5) * 0.3) * sw;
    const cy = tray.y + (Math.floor(s / cols) + 0.5 + (Math.random() - 0.5) * 0.3) * sh;
    const x = Math.max(0, Math.min(W - cw - 2 * m, cx - cw / 2 - m));
    const y = Math.max(0, Math.min(H - ch - 2 * m, cy - ch / 2 - m));
    moveTo(p, x, y);
    p.el.style.zIndex = ++topZ;
  });
}

function updateCount() {
  $('count').textContent = `🧩 ${placedCount} / ${pieces.length}`;
}

// ---------- Dragging ----------
// The area handles every touch, and picks the top piece whose actual shape
// is under the finger, so the see-through corners of a piece's canvas don't
// block the pieces underneath.
const hitCtx = document.createElement('canvas').getContext('2d');
let drag = null;

function pieceAt(x, y) {
  const loose = pieces.filter(p => !p.placed).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
  for (const p of loose) {
    const lx = x - p.x, ly = y - p.y;
    if (hitCtx.isPointInPath(p.path, lx, ly)) return p;
  }
  // A near miss still picks up the nearest piece under a small finger.
  for (const p of loose) {
    const lx = x - p.x - L.m, ly = y - p.y - L.m;
    if (lx > -8 && ly > -8 && lx < L.cw + 8 && ly < L.ch + 8) return p;
  }
  return null;
}

function areaPoint(e) {
  const r = area.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

area.addEventListener('pointerdown', e => {
  if (drag) return;
  const [x, y] = areaPoint(e);
  const p = pieceAt(x, y);
  if (!p) return;
  area.setPointerCapture(e.pointerId);
  drag = { p, id: e.pointerId, dx: x - p.x, dy: y - p.y };
  p.el.style.zIndex = ++topZ;
  p.el.classList.add('drag');
  p.el.classList.remove('snap');
  pickSound();
});

area.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = areaPoint(e);
  const { p } = drag;
  const w = L.cw + 2 * L.m, h = L.ch + 2 * L.m;
  // keep at least half the piece on screen
  moveTo(p, Math.max(-w / 2, Math.min(L.W - w / 2, x - drag.dx)), Math.max(-h / 2, Math.min(L.H - h / 2, y - drag.dy)));
});

function drop(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { p } = drag;
  drag = null;
  p.el.classList.remove('drag');
  const [hx, hy] = home(p);
  if (Math.hypot(p.x - hx, p.y - hy) < L.S * 0.38) {
    p.placed = true;
    p.el.classList.add('snap', 'placed');
    p.el.classList.remove('loose');
    p.el.style.zIndex = 1;
    moveTo(p, hx, hy);
    placedCount++;
    updateCount();
    snapSound();
    if (placedCount === pieces.length) setTimeout(win, 350);
  }
}
area.addEventListener('pointerup', drop);
area.addEventListener('pointercancel', drop);

// ---------- Buttons ----------
$('back').addEventListener('click', () => { show('menu'); buildMenu(); });
$('peek').addEventListener('click', () => {
  peek = !peek;
  $('peek').classList.toggle('on', peek);
  drawBoard();
  pickSound();
});
$('again').addEventListener('click', () => start(scene));
$('next').addEventListener('click', () => { $('win').hidden = true; show('menu'); buildMenu(); });

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!$('play').hidden && L && (area.clientWidth !== L.W || area.clientHeight !== L.H)) layout();
  }, 150);
});

// ---------- Well done! ----------
function win() {
  if (SCENES.includes(scene)) {
    done[scene.name] = Math.max(done[scene.name] || 0, size.pieces);
    try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch {}
  }
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
