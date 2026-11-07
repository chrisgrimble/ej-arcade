'use strict';
// Doodle Den: a drawing pad for kids with pencils, a rubber and stamps.

const COLOURS = [
  '#222222', '#8a5a2b', '#ff3b3b', '#ff8a1f', '#ffd21f', '#7ed321',
  '#1fa83a', '#3ad6e8', '#2f6bff', '#8e44ff', '#ff5fa2',
];
const STAMPS = ['⭐', '❤️', '🌈', '🌸', '☀️', '🦄', '🐱', '🐶', '🦕', '🚀', '🐠', '🦋', '🍦', '🚗', '👑', '😀'];
const SIZES = [   // [pencil width, stamp size] in screen pixels
  [4, 36],
  [10, 60],
  [22, 96],
];
const SAVE_KEY = 'doodle-den-picture';
const MAX_UNDO = 30;

const paper = document.getElementById('paper');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let tool = 'pencil';    // 'pencil' | 'rubber' | 'stamp'
let colour = COLOURS[2];
let rainbow = false;
let stamp = STAMPS[0];
let sizeIndex = 1;

// ---------- Paper ----------
// The canvas is a square as big as the screen's longest side, so turning the
// phone round never cuts off part of the picture; the paper shows the part
// that fits.
const side = Math.max(screen.width, screen.height, innerWidth, innerHeight);
const dpr = Math.min(devicePixelRatio || 1, 2, 2400 / side);
canvas.width = Math.round(side * dpr);
canvas.height = Math.round(side * dpr);
canvas.style.width = canvas.style.height = side + 'px';
ctx.scale(dpr, dpr);
ctx.lineCap = ctx.lineJoin = 'round';

function blank() {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, side, side);
  ctx.restore();
}

// ---------- Undo history ----------
// Each entry is a promise of a PNG of the whole picture after a change. PNGs
// of mostly-white paper are small, so plenty of steps fit in memory.
const history = [];
const snapshot = () => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

function remember() {
  const shot = snapshot();
  history.push(shot);
  if (history.length > MAX_UNDO) history.shift();
  autosave(shot);
}

async function drawBlob(blob) {
  const img = await createImageBitmap(blob);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

async function undo() {
  if (history.length < 2) return;
  history.pop();
  const blob = await history[history.length - 1];
  await drawBlob(blob);
  autosave(Promise.resolve(blob));
  pop(300);
}

// ---------- Keep the picture between visits ----------
let saveTimer;
function autosave(shot) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const blob = await shot;
    const reader = new FileReader();
    reader.onload = () => { try { localStorage.setItem(SAVE_KEY, reader.result); } catch { /* full or blocked */ } };
    reader.readAsDataURL(blob);
  }, 400);
}

async function restore() {
  let saved = null;
  try { saved = localStorage.getItem(SAVE_KEY); } catch {}
  blank();
  if (saved) {
    try { await drawBlob(await (await fetch(saved)).blob()); } catch { blank(); }
  }
  history.push(snapshot());
}

// ---------- Sounds ----------
let audio;
function tone(freq, endFreq, dur, type = 'sine', vol = 0.12) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
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
const pop = (base = 500) => tone(base + Math.random() * 200, base * 2.4, 0.12);
const whoosh = () => tone(900, 80, 0.4, 'triangle', 0.15);

// ---------- Drawing ----------
let active = null;   // the one finger (or mouse) currently drawing
let last, lastMid, lastStamp, hue = 0;

function point(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function strokeStyle() {
  if (tool === 'rubber') return '#fff';
  if (rainbow) return `hsl(${hue % 360}, 95%, 55%)`;
  return colour;
}

function lineWidth() {
  const w = SIZES[sizeIndex][0];
  return tool === 'rubber' ? w * 2.5 : w;
}

function dot(p) {
  ctx.fillStyle = strokeStyle();
  ctx.beginPath();
  ctx.arc(p.x, p.y, lineWidth() / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Smooth curves: draw from midpoint to midpoint, bending through each point.
function lineTo(p) {
  const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
  if (rainbow && tool === 'pencil') hue += Math.hypot(p.x - last.x, p.y - last.y) * 0.6;
  ctx.strokeStyle = strokeStyle();
  ctx.lineWidth = lineWidth();
  ctx.beginPath();
  ctx.moveTo(lastMid.x, lastMid.y);
  ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
  ctx.stroke();
  last = p;
  lastMid = mid;
}

function placeStamp(p) {
  const size = SIZES[sizeIndex][1];
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((Math.random() - 0.5) * 0.5);
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp, 0, 0);
  ctx.restore();
  lastStamp = p;
  pop();
}

canvas.addEventListener('pointerdown', e => {
  if (active !== null) return;   // ignore a second finger or a resting palm
  active = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  if (tool === 'stamp') { placeStamp(p); return; }
  last = lastMid = p;
  dot(p);
});

canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== active) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events.length ? events : [e]) {
    const p = point(ev);
    if (tool === 'stamp') {
      // Dragging leaves a trail of stamps, spaced so they don't pile up.
      if (Math.hypot(p.x - lastStamp.x, p.y - lastStamp.y) > SIZES[sizeIndex][1] * 1.1) placeStamp(p);
    } else {
      lineTo(p);
    }
  }
});

function finish(e) {
  if (e.pointerId !== active) return;
  if (tool !== 'stamp') lineTo(point(e));
  active = null;
  remember();
}
canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);

// ---------- Toolbar ----------
const pencilTray = document.getElementById('pencils');
const stampTray = document.getElementById('stamps');
const toolButtons = {
  pencil: document.getElementById('pencil-tool'),
  rubber: document.getElementById('rubber'),
  stamp: document.getElementById('stamp-tool'),
};

function setTool(name) {
  tool = name;
  for (const [n, b] of Object.entries(toolButtons)) b.classList.toggle('on', n === name);
  pencilTray.hidden = name === 'stamp';
  stampTray.hidden = name !== 'stamp';
  // The rubber keeps the pencils showing but none of them picked.
  for (const p of pencilTray.children) p.classList.toggle('on', name === 'pencil' && p.dataset.on === 'yes');
}

function pickPencil(button) {
  for (const p of pencilTray.children) p.dataset.on = p === button ? 'yes' : 'no';
  rainbow = button.classList.contains('rainbow');
  if (!rainbow) colour = button.dataset.colour;
  setTool('pencil');
  tone(700, 900, 0.06, 'square', 0.04);
}

for (const c of ['rainbow', ...COLOURS]) {
  const b = document.createElement('button');
  b.className = 'pencil';
  b.innerHTML = '<span></span>';
  if (c === 'rainbow') {
    b.classList.add('rainbow');
    b.setAttribute('aria-label', 'Rainbow pencil');
  } else {
    b.style.setProperty('--c', c);
    b.dataset.colour = c;
    b.setAttribute('aria-label', 'Pencil ' + c);
  }
  b.addEventListener('click', () => pickPencil(b));
  pencilTray.appendChild(b);
}
pickPencil(pencilTray.children[1 + COLOURS.indexOf(colour)]);

for (const s of STAMPS) {
  const b = document.createElement('button');
  b.className = 'stamp';
  b.textContent = s;
  b.setAttribute('aria-label', 'Stamp ' + s);
  b.addEventListener('click', () => {
    stamp = s;
    for (const o of stampTray.children) o.classList.toggle('on', o === b);
    pop();
  });
  stampTray.appendChild(b);
}
stampTray.children[0].classList.add('on');

toolButtons.pencil.addEventListener('click', () => setTool('pencil'));
toolButtons.rubber.addEventListener('click', () => { setTool('rubber'); tone(400, 300, 0.08); });
toolButtons.stamp.addEventListener('click', () => { setTool('stamp'); pop(); });

const sizeButton = document.getElementById('size');
function showSize() {
  const d = [8, 14, 22][sizeIndex];
  sizeButton.firstElementChild.style.width = sizeButton.firstElementChild.style.height = d + 'px';
}
sizeButton.addEventListener('click', () => {
  sizeIndex = (sizeIndex + 1) % SIZES.length;
  showSize();
  tone(300 + sizeIndex * 200, 400 + sizeIndex * 200, 0.08);
});
showSize();

document.getElementById('undo').addEventListener('click', undo);

// Tapping the bin once asks "Sure?"; tapping again within 3 seconds clears.
const clearButton = document.getElementById('clear');
let clearTimer;
clearButton.addEventListener('click', () => {
  if (!clearButton.classList.contains('confirm')) {
    clearButton.classList.add('confirm');
    clearButton.textContent = 'Sure?';
    clearTimer = setTimeout(resetClear, 3000);
    return;
  }
  resetClear();
  blank();
  remember();
  whoosh();
});
function resetClear() {
  clearTimeout(clearTimer);
  clearButton.classList.remove('confirm');
  clearButton.textContent = '🗑️';
}

// Saves just the part of the paper that's showing.
document.getElementById('save').addEventListener('click', () => {
  const w = paper.clientWidth, h = paper.clientHeight;
  const out = document.createElement('canvas');
  out.width = Math.round(w * dpr);
  out.height = Math.round(h * dpr);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  out.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `doodle-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    tone(523, 1047, 0.25, 'triangle');
  }, 'image/png');
});

document.getElementById('home').addEventListener('click', () => { location.href = '../'; });

restore();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
