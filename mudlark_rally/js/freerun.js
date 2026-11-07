'use strict';
// Free Run: an open plain with no road. The ground is drawn row by row as a flat
// perspective floor, and everything standing on it is a sprite that faces the camera.
// The world wraps at its edges, so the rover can drive in any direction forever.
const WORLD_SIZE = 131072;
const TEX_SIZE = 512, TEX_UNIT = 32;
const FREE_HORIZON = 132, FREE_CAM_H = 680, FREE_CAM_BACK = 839;
const FREE_FOCAL = VIEW_W / 2 * CAM_DEPTH;
const FREE_FAR = 26000, SPRITE_FAR = 46000;
const FREE_TURN = 1.9, PLAYER_R = 160, ACTIVE_GATES = 3;
const SKY_PER_RADIAN = 1024 / Math.PI;

const wrapPos = v => ((v % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
const wrapDelta = d => d - WORLD_SIZE * Math.round(d / WORLD_SIZE);

function rgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (255 << 24 | (n & 255) << 16 | (n >> 8 & 255) << 8 | n >> 16) >>> 0;
}

// Tiling value noise: the lattice wraps every `cells` cells so the texture repeats seamlessly.
function tileNoise(rnd, cells) {
  const grid = Array.from({ length: cells * cells }, rnd);
  const at = (x, y) => grid[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  const smooth = t => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(x - ix), fy = smooth(y - iy);
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

function makeGroundTexture(stage) {
  const pal = stage.pal, rnd = mulberry32(stage.seed + 7);
  const broad = tileNoise(rnd, 8), fine = tileNoise(rnd, 64), cracks = tileNoise(rnd, 24), brush = tileNoise(rnd, 16);
  const tones = [pal.ground[1], pal.ground[0], pal.road[1]].map(rgba);
  const rut = rgba(pal.rut), pebble = rgba(pal.edge[1]), scrub = rgba(pal.scrub);
  const tex = new Uint32Array(TEX_SIZE * TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const u = x / TEX_SIZE, v = y / TEX_SIZE;
      const n = broad(u, v) * 0.7 + fine(u, v) * 0.3;
      let c = tones[n < 0.42 ? 0 : n < 0.62 ? 1 : 2];
      if (Math.abs(cracks(u, v) - 0.5) < 0.012) c = rut;
      else if (brush(u, v) > 0.74 && fine(u * 3 % 1, v * 3 % 1) > 0.5) c = scrub;
      else if (rnd() < 0.004) c = pebble;
      tex[y * TEX_SIZE + x] = c;
    }
  }
  return tex;
}

function buildWorld(stage) {
  const rnd = mulberry32(stage.seed);
  const objects = [], groups = [];
  const clearOfStart = (x, y) => Math.hypot(wrapDelta(x), wrapDelta(y)) > 7000;
  const spot = () => {
    for (;;) {
      const x = rnd() * WORLD_SIZE, y = rnd() * WORLD_SIZE;
      if (clearOfStart(x, y)) return [x, y];
    }
  };
  const item = (k, x, y, extra = {}) => {
    const spec = ITEMS[k];
    const o = { k, x: wrapPos(x), y: wrapPos(y), lift: 0, w: spec.w, h: spec.h, r: spec.hw * ROAD_W, solid: !!spec.solid, taken: false, cool: 0, ...extra };
    objects.push(o);
    return o;
  };
  const scenery = (k, x, y) => {
    const spec = SCENERY[k];
    objects.push({ k, x: wrapPos(x), y: wrapPos(y), lift: 0, w: spec.w, h: spec.h, r: spec.w * 0.3, solid: !!spec.solid, scenery: true, cool: 0 });
  };

  for (let i = 0; i < 150; i++) {
    const [x, y] = spot();
    const k = stage.scenery[Math.floor(rnd() * stage.scenery.length)];
    for (let j = 0; j < 4; j++) scenery(k, x + (rnd() - 0.5) * 6000, y + (rnd() - 0.5) * 6000);
  }
  for (let i = 0; i < 90; i++) {
    const [x, y] = spot();
    for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) {
      item(stage.hazards[Math.floor(rnd() * stage.hazards.length)], x + (rnd() - 0.5) * 2400, y + (rnd() - 0.5) * 2400);
    }
  }
  for (let i = 0; i < 45; i++) item('ramp', ...spot());
  for (let i = 0; i < 40; i++) item('puddle', ...spot());
  for (let i = 0; i < 70; i++) {
    const group = { members: [] };
    for (let j = 0; j < 6; j++) group.members.push(item('beacon', 0, 0, { group }));
    lineUp(group, ...spot(), rnd() * Math.PI * 2);
    groups.push(group);
  }

  const gates = [];
  for (let i = 0; i < ACTIVE_GATES; i++) {
    const a = i === 0 ? 0 : rnd() * Math.PI * 2, d = i === 0 ? 12000 : 18000 + rnd() * 16000;
    gates.push(item('timegate', Math.sin(a) * d, Math.cos(a) * d));
  }
  return { objects, gates };
}

function lineUp(group, x, y, angle) {
  group.members.forEach((b, i) => {
    b.x = wrapPos(x + Math.sin(angle) * i * 900);
    b.y = wrapPos(y + Math.cos(angle) * i * 900);
    b.taken = false;
  });
}

// Somewhere new, a fair drive from the rover in a random direction.
function spotAway(minDist, maxDist) {
  const a = Math.random() * Math.PI * 2, d = minDist + Math.random() * (maxDist - minDist);
  return [wrapPos(player.px + Math.sin(a) * d), wrapPos(player.py + Math.cos(a) * d)];
}

function passGate(gate) {
  const bonus = Math.max(2.5, 8 - game.gates * 0.35);
  game.gates++;
  game.time += bonus;
  player.boost = Math.min(1, player.boost + BOOST_GATE);
  addScore(400 + 100 * game.gates, 'GATE', '#5ff0d8');
  sound.checkpoint();
  showBanner('TIME GATE', `+${bonus.toFixed(1)} SECONDS`);
  [gate.x, gate.y] = spotAway(22000, 40000);
}

function freeCollide() {
  const p = player;
  for (const o of game.world.objects) {
    if (o.taken || game.clock < o.cool || (o.scenery && !o.solid)) continue;
    const dx = wrapDelta(o.x - p.px), dy = wrapDelta(o.y - p.py);
    const reach = o.r + PLAYER_R;
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const dist = Math.hypot(dx, dy);
    if (dist > reach) continue;

    if (o.k === 'beacon') {
      if (Math.abs(p.wy - o.lift) < 420) {
        collect(o);
        if (o.group.members.every(b => b.taken)) lineUp(o.group, ...spotAway(15000, 45000), Math.random() * Math.PI * 2);
      }
      continue;
    }
    if (o.k === 'timegate') { passGate(o); continue; }
    if (p.wy > AIR_CLEARANCE) continue;
    o.cool = game.clock + 0.8;
    if (o.k === 'ramp') launch();
    else if (o.k === 'puddle') splash();
    else {
      // How far the obstacle sits to the side of the rover's line of travel decides glance or crash.
      const side = dx * Math.cos(p.heading) - dy * Math.sin(p.heading);
      if (!o.solid && Math.abs(side) > reach * GLANCE_RATIO) glance(Math.sign(side) || 1);
      else {
        crash();
        if (p.crash > 0) {
          const ux = dist ? dx / dist : Math.sin(p.heading), uy = dist ? dy / dist : Math.cos(p.heading);
          p.px = wrapPos(o.x - ux * (reach + 20));
          p.py = wrapPos(o.y - uy * (reach + 20));
        }
      }
    }
  }
}

function stepFree(dt, controls) {
  const p = player;
  const pct = p.speed / MAX_SPEED;
  if (driveTick(dt, controls, false)) {
    p.heading += p.steer * FREE_TURN * Math.min(1, 0.3 + pct * 1.4) * steerGrip() * dt;
  }
  p.px = wrapPos(p.px + Math.sin(p.heading) * p.speed * dt);
  p.py = wrapPos(p.py + Math.cos(p.heading) * p.speed * dt);
  p.tread = (p.tread + p.speed * dt * 0.012) % 360;

  if (p.air) {
    p.airTime += dt;
    p.vy -= GRAVITY * dt;
    p.wy += p.vy * dt;
    if (p.wy <= 0) land(0);
  }
  if (game.state === 'play') freeCollide();
  updateRoll(dt);
  game.skyX = p.heading * SKY_PER_RADIAN;
}

// The title screen just cruises in a slow circle.
function freeAttract(dt) {
  const p = player;
  p.heading += dt * 0.12;
  p.px = wrapPos(p.px + Math.sin(p.heading) * p.speed * dt);
  p.py = wrapPos(p.py + Math.cos(p.heading) * p.speed * dt);
  game.skyX = p.heading * SKY_PER_RADIAN;
}

function nearestGate() {
  let best = null, bestD = Infinity;
  for (const g of game.world.gates) {
    const d = Math.hypot(wrapDelta(g.x - player.px), wrapDelta(g.y - player.py));
    if (d < bestD) { bestD = d; best = g; }
  }
  return { gate: best, dist: bestD };
}

const groundView = { canvas: null, ctx: null, image: null, pixels: null };

function drawGround(camX, camY, camH, fx, fy) {
  const rows = VIEW_H - FREE_HORIZON;
  if (!groundView.canvas) {
    groundView.canvas = document.createElement('canvas');
    groundView.canvas.width = VIEW_W;
    groundView.canvas.height = rows;
    groundView.ctx = groundView.canvas.getContext('2d');
    groundView.image = groundView.ctx.createImageData(VIEW_W, rows);
    groundView.pixels = new Uint32Array(groundView.image.data.buffer);
  }
  const tex = game.art.ground, out = groundView.pixels, fog = rgba(game.stage.pal.fog);
  const mask = TEX_SIZE - 1, rx = fy, ry = -fx;
  let o = 0;
  for (let r = 0; r < rows; r++) {
    const z = camH * FREE_FOCAL / (r + 0.5);
    if (z > FREE_FAR) {
      out.fill(fog, o, o + VIEW_W);
      o += VIEW_W;
      continue;
    }
    const step = z / FREE_FOCAL / TEX_UNIT;
    let u = (camX + fx * z) / TEX_UNIT - rx * step * VIEW_W / 2;
    let v = (camY + fy * z) / TEX_UNIT - ry * step * VIEW_W / 2;
    const du = rx * step, dv = ry * step;
    for (let x = 0; x < VIEW_W; x++) {
      out[o++] = tex[(Math.floor(v) & mask) * TEX_SIZE + (Math.floor(u) & mask)];
      u += du;
      v += dv;
    }
  }
  groundView.ctx.putImageData(groundView.image, 0, 0);
  ctx.drawImage(groundView.canvas, 0, FREE_HORIZON);

  const haze = ctx.createLinearGradient(0, FREE_HORIZON, 0, FREE_HORIZON + 26);
  haze.addColorStop(0, game.stage.pal.fog);
  haze.addColorStop(1, game.stage.pal.fog + '00');
  ctx.fillStyle = haze;
  ctx.fillRect(0, FREE_HORIZON, VIEW_W, 26);
}

function drawFreeWorld() {
  const p = player;
  const fx = Math.sin(p.heading), fy = Math.cos(p.heading), rx = fy, ry = -fx;
  const camX = p.px - fx * FREE_CAM_BACK, camY = p.py - fy * FREE_CAM_BACK;
  const camH = FREE_CAM_H + p.wy * 0.55;

  drawBackdrop(game.stage.pal);
  drawGround(camX, camY, camH, fx, fy);

  const visible = [];
  for (const o of game.world.objects) {
    if (o.taken) continue;
    const dx = wrapDelta(o.x - camX), dy = wrapDelta(o.y - camY);
    const z = dx * fx + dy * fy;
    if (z < 60 || z > SPRITE_FAR) continue;
    visible.push({ o, z, side: dx * rx + dy * ry });
  }
  if (game.state !== 'title') visible.push({ player: true, z: FREE_CAM_BACK });
  visible.sort((a, b) => b.z - a.z);

  for (const v of visible) {
    if (v.player) { drawPlayer(p.wy); continue; }
    const { o, z } = v;
    const scale = FREE_FOCAL / z;
    const w = o.w * scale, h = o.h * scale;
    const sx = VIEW_W / 2 + v.side * scale - w / 2;
    const bob = o.k === 'beacon' ? Math.sin(game.clock * 4 + o.x) * 36 + 150 : 0;
    const y = FREE_HORIZON + camH * scale - h - (o.lift + bob) * scale;
    if (sx > VIEW_W || sx + w < 0) continue;
    ctx.globalAlpha = Math.min(1, (SPRITE_FAR - z) / 8000);
    if (o.k === 'timegate') {
      ctx.fillStyle = 'rgba(95,240,216,.35)';
      const beam = Math.max(3, w * 0.12);
      ctx.fillRect(sx + w / 2 - beam / 2, 0, beam, y + h * 0.2);
    }
    ctx.drawImage(game.art[o.k], sx, y, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawCompass() {
  const { gate, dist } = nearestGate();
  if (!gate) return;
  const p = player;
  const dx = wrapDelta(gate.x - p.px), dy = wrapDelta(gate.y - p.py);
  const angle = Math.atan2(dx * Math.cos(p.heading) - dy * Math.sin(p.heading), dx * Math.sin(p.heading) + dy * Math.cos(p.heading));
  const cx = VIEW_W / 2, cy = 72;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.beginPath();
  ctx.moveTo(1, -13); ctx.lineTo(11, 11); ctx.lineTo(1, 5); ctx.lineTo(-9, 11);
  ctx.fill();
  ctx.fillStyle = '#5ff0d8';
  ctx.beginPath();
  ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 4); ctx.lineTo(-10, 10);
  ctx.fill();
  ctx.restore();
  text(`${Math.round(dist * 0.0037)}M`, cx + 18, 77, 11, '#5ff0d8');
}
