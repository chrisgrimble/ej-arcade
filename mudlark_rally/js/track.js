'use strict';
// World constants and the procedural course generator.
// Lateral positions are in road half-widths: 0 is the centre, +/-1 the road edges.
const VIEW_W = 640, VIEW_H = 360;
const SEG_LEN = 200, ROAD_W = 1600, CAM_H = 1000;
const CAM_DEPTH = 1 / Math.tan(50 * Math.PI / 180);
const PLAYER_Z = CAM_H * CAM_DEPTH;
const DRAW_DIST = 170, BAND = 3;
const LEG_SEGS = 1400, RUNOUT_SEGS = 520;

const ITEMS = {
  beacon:     { w: 230,  h: 230,  hw: 0.13 },
  boulder:    { w: 520,  h: 400,  hw: 0.16 },
  barrel:     { w: 300,  h: 400,  hw: 0.10 },
  trunk:      { w: 1700, h: 300,  hw: 0.53 },
  puddle:     { w: 900,  h: 110,  hw: 0.27 },
  ramp:       { w: 1150, h: 300,  hw: 0.36 },
  gate:       { w: 1500, h: 950,  hw: 0.40 },
  timegate:   { w: 1500, h: 950,  hw: 0.40 },
  checkpoint: { w: 3900, h: 1250, hw: 0 },
  finish:     { w: 3900, h: 1250, hw: 0 },
  arrowL:     { w: 480,  h: 560,  hw: 0.10, solid: true },
  arrowR:     { w: 480,  h: 560,  hw: 0.10, solid: true },
};

// min: closest a piece of scenery may sit to the road centre.
const SCENERY = {
  mesa:    { w: 2800, h: 2100, min: 2.7, solid: true },
  cactus:  { w: 620,  h: 1100, min: 1.3, solid: true },
  scrub:   { w: 560,  h: 300,  min: 1.15 },
  pine:    { w: 1050, h: 1700, min: 1.5, solid: true },
  crag:    { w: 1500, h: 1200, min: 2.2, solid: true },
  drift:   { w: 800,  h: 260,  min: 1.15 },
  mangrove:{ w: 1500, h: 1500, min: 1.8, solid: true },
  reeds:   { w: 520,  h: 480,  min: 1.15 },
  stilt:   { w: 1300, h: 1250, min: 2.4, solid: true },
  spire:   { w: 760,  h: 1650, min: 1.5, solid: true },
  deadtree:{ w: 950,  h: 1250, min: 1.5, solid: true },
  vent:    { w: 700,  h: 340,  min: 1.15 },
};

const STAGES = [
  {
    name: 'COPPER GULCH', seed: 1871, legs: 4, density: 1, curve: 1, hills: 1, startTime: 38, legTime: 29,
    scenery: ['cactus', 'scrub', 'scrub', 'mesa'], hazards: ['boulder', 'barrel'],
    pal: { sky: ['#3b1f5b', '#c9543f', '#ffc26b'], sun: '#ffe9a8', far: '#8a4258', near: '#a8503f',
      ground: ['#c98a4b', '#bd7f43'], road: ['#e4b777', '#dbab6b'], rut: '#bb8853',
      edge: ['#f4e3c1', '#8a4a2f'], fog: '#f0a868' },
  },
  {
    name: 'FROSTLINE PASS', seed: 2204, legs: 4, density: 1.15, curve: 1.15, hills: 1.3, startTime: 38, legTime: 28.5,
    scenery: ['pine', 'pine', 'drift', 'crag'], hazards: ['boulder', 'barrel'],
    pal: { sky: ['#16345c', '#5f9fcf', '#dff1fa'], sun: '#ffffff', far: '#8fb2cf', near: '#c4d9e8',
      ground: ['#e9f2f8', '#dbe7f1'], road: ['#a4b8c9', '#99adbf'], rut: '#7f95a9',
      edge: ['#ffffff', '#4a6b8a'], fog: '#d7e8f4' },
  },
  {
    name: 'MANGROVE RUN', seed: 3319, legs: 5, density: 1.3, curve: 1.25, hills: 0.8, startTime: 37, legTime: 27.5,
    scenery: ['mangrove', 'reeds', 'reeds', 'stilt'], hazards: ['barrel', 'boulder'],
    pal: { sky: ['#12303a', '#2f7f6f', '#d7e37a'], sun: '#f6f7b0', far: '#2d6a5c', near: '#23573f',
      ground: ['#2f7a3e', '#2a6f38'], road: ['#7b6a45', '#71613f'], rut: '#5a4c30',
      edge: ['#d5c98a', '#1e4d2a'], fog: '#9fc98a' },
  },
  {
    name: 'EMBER FLATS', seed: 4457, legs: 5, density: 1.5, curve: 1.35, hills: 1.5, startTime: 37, legTime: 27,
    scenery: ['spire', 'deadtree', 'vent', 'vent'], hazards: ['boulder', 'boulder', 'barrel'],
    pal: { sky: ['#0a0614', '#3a0f2e', '#b3321f'], sun: '#ff8a3c', far: '#2c0f24', near: '#1c0c18',
      ground: ['#2a1e27', '#231921'], road: ['#544650', '#4b3e47'], rut: '#382e35',
      edge: ['#ff7a1a', '#401018'], fog: '#5a1c20' },
  },
  {
    name: 'BADLANDS', seed: 5501, free: true, startTime: 45,
    scenery: ['mesa', 'cactus', 'scrub', 'deadtree'], hazards: ['boulder', 'boulder', 'barrel'],
    pal: { sky: ['#1d1838', '#7a3f6e', '#f4a27a'], sun: '#ffd7a0', far: '#6b3552', near: '#8c4a45',
      ground: ['#b9774a', '#a96a40'], road: ['#d7a26c', '#cc9862'], rut: '#7f4a2f', scrub: '#6f7a3a',
      edge: ['#e8c9a0', '#5e3326'], fog: '#e59a7a' },
  },
];

// Courses come first in STAGES and are played in order; anything after them is a standalone mode.
const COURSE_COUNT = STAGES.filter(s => !s.free).length;

function mulberry32(a) {
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeOut = (a, b, p) => a + (b - a) * (1 - (1 - p) * (1 - p));
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

function buildTrack(stage) {
  const rnd = mulberry32(stage.seed);
  const range = (a, b) => a + rnd() * (b - a);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const segs = [];
  const lastY = () => segs.length ? segs[segs.length - 1].p2.world.y : 0;

  function addSeg(curve, y) {
    const n = segs.length;
    segs.push({
      index: n, curve, items: [], clip: 0, band: Math.floor(n / BAND) % 2,
      p1: { world: { y: lastY(), z: n * SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} },
    });
  }

  function addSection(enter, hold, leave, curve, rise) {
    const y0 = lastY(), y1 = y0 + rise * SEG_LEN, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total));
    for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(y0, y1, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total));
  }

  const finishSeg = 60 + stage.legs * LEG_SEGS;
  addSection(0, 60, 0, 0, 0);
  const sharpCurves = [];
  while (segs.length < finishSeg) {
    const len = Math.floor(range(50, 120));
    const curve = rnd() < 0.3 ? 0 : (rnd() < 0.5 ? -1 : 1) * range(1.5, 4) * stage.curve;
    // Pull the height back towards zero so hills never drift far from sea level.
    const rise = (rnd() < 0.35 ? 0 : range(-14, 14) * stage.hills) - lastY() / SEG_LEN * 0.25;
    if (Math.abs(curve) > 3) sharpCurves.push({ seg: segs.length, dir: Math.sign(curve) });
    addSection(30, len, 30, curve, rise);
  }
  segs.length = finishSeg;
  addSection(40, RUNOUT_SEGS + DRAW_DIST, 0, 0, 0);

  const place = (i, k, x, lift = 0) => {
    if (segs[i]) segs[i].items.push({ k, x, lift, taken: false, ...ITEMS[k] });
  };

  for (let i = 1; i <= stage.legs; i++) {
    const at = 60 + i * LEG_SEGS;
    place(at, i === stage.legs ? 'finish' : 'checkpoint', 0);
    segs[at][i === stage.legs ? 'finish' : 'checkpoint'] = true;
  }
  segs[20].startLine = true;

  // Pickups and hazards are laid out as short patterns, spaced by stage density.
  const lanes = [-0.66, -0.22, 0.22, 0.66];
  const patterns = {
    weave(s) {
      const c = range(-0.35, 0.35), ph = rnd() * 6;
      for (let i = 0; i < 8; i++) place(s + i * 6, 'beacon', c + Math.sin(ph + i * 0.7) * 0.42);
      return 48;
    },
    line(s) {
      const x = pick(lanes);
      for (let i = 0; i < 6; i++) place(s + i * 5, 'beacon', x);
      return 30;
    },
    gate(s) { place(s, 'gate', range(-0.5, 0.5)); return 12; },
    hazards(s) {
      const free = Math.floor(rnd() * 4);
      const count = stage.density > 1.2 && rnd() < 0.5 ? 3 : 2;
      const taken = lanes.filter((_, i) => i !== free).sort(() => rnd() - 0.5).slice(0, count);
      for (const x of taken) place(s + Math.floor(range(0, 4)), pick(stage.hazards), x);
      place(s, 'beacon', lanes[free]);
      return 16;
    },
    puddles(s) {
      place(s, 'puddle', pick(lanes));
      place(s + 9, 'puddle', pick(lanes));
      return 14;
    },
    // A ramp, a trunk that can only be cleared from it, and a skyward arc of beacons.
    jump(s) {
      const x = range(-0.4, 0.4);
      place(s, 'ramp', x);
      place(s + 18, 'trunk', x);
      for (let i = 1; i <= 5; i++) {
        const u = i / 6;
        place(s + Math.round(u * 40), 'beacon', x, 3000 * u * (1 - u) + 120);
      }
      return 46;
    },
  };
  const weights = ['weave', 'weave', 'line', 'gate', 'gate', 'hazards', 'hazards', 'hazards', 'puddles', 'jump', 'jump'];
  for (let s = 110; s < finishSeg - 70;) {
    if (segs.slice(s, s + 2).some(g => g.checkpoint)) { s += 40; continue; }
    s += patterns[pick(weights)](s) + Math.floor(range(28, 70) / stage.density);
  }

  for (const c of sharpCurves) {
    for (let i = 0; i < 3; i++) place(c.seg + i * 7, c.dir > 0 ? 'arrowR' : 'arrowL', -c.dir * 1.3);
  }

  for (let i = 8; i < segs.length - DRAW_DIST; i += 2 + Math.floor(rnd() * 5)) {
    const k = pick(stage.scenery), spec = SCENERY[k];
    const side = rnd() < 0.5 ? -1 : 1;
    segs[i].items.push({
      k, x: side * (spec.min + rnd() * rnd() * 3), lift: 0, w: spec.w, h: spec.h,
      solid: !!spec.solid, hw: spec.w * 0.3 / ROAD_W, scenery: true,
    });
  }

  return { segs, finishZ: finishSeg * SEG_LEN };
}
