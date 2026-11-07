'use strict';
// Every sprite is painted onto an offscreen canvas at start-up, so the game ships no image files.
function sprite(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d'), w, h);
  return cv;
}

function poly(c, color, pts) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

function box(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function disc(c, color, x, y, rx, ry = rx) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

const PAINTERS = {
  beacon: (c, w) => {
    const m = w / 2;
    disc(c, 'rgba(255,220,90,.35)', m, m, m);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r1 = i % 2 ? m * .55 : m * .95, a2 = a + Math.PI / 8;
      poly(c, '#ffb52e', [m + Math.cos(a) * r1, m + Math.sin(a) * r1, m + Math.cos(a2) * m * .3, m + Math.sin(a2) * m * .3, m, m]);
      poly(c, '#ffb52e', [m + Math.cos(a) * r1, m + Math.sin(a) * r1, m + Math.cos(a - Math.PI / 8) * m * .3, m + Math.sin(a - Math.PI / 8) * m * .3, m, m]);
    }
    disc(c, '#fff3b8', m, m, m * .36);
    disc(c, '#ffffff', m - 2, m - 2, m * .14);
  },
  boulder: (c, w, h) => {
    poly(c, '#5d5660', [2, h, 6, h * .5, w * .28, h * .1, w * .62, 2, w * .9, h * .3, w - 2, h * .72, w - 3, h]);
    poly(c, '#7f7682', [w * .14, h * .55, w * .3, h * .18, w * .6, h * .1, w * .66, h * .4, w * .4, h * .62]);
    poly(c, '#a097a3', [w * .28, h * .34, w * .36, h * .2, w * .54, h * .17, w * .5, h * .32]);
    poly(c, '#433d47', [w * .55, h, w * .72, h * .55, w * .95, h * .75, w - 3, h]);
  },
  barrel: (c, w, h) => {
    box(c, '#b5301f', 4, 3, w - 8, h - 3);
    box(c, '#e0523a', 8, 3, w * .28, h - 3);
    box(c, '#6e1c13', w - 14, 3, 10, h - 3);
    for (const y of [.14, .5, .84]) box(c, '#2d2730', 2, h * y, w - 4, 5);
    poly(c, '#ffd23c', [w / 2, h * .25, w * .72, h * .44, w * .28, h * .44]);
  },
  trunk: (c, w, h) => {
    box(c, '#5e3a22', 6, h * .2, w - 12, h * .8);
    box(c, '#7c5030', 6, h * .28, w - 12, h * .2);
    for (let x = 16; x < w - 16; x += 26) box(c, '#44291a', x, h * .3 + (x % 3) * 6, 15, 3);
    disc(c, '#c99a63', 8, h * .6, 8, h * .4);
    disc(c, '#8e6238', 8, h * .6, 4, h * .22);
    disc(c, '#c99a63', w - 8, h * .6, 8, h * .4);
    disc(c, '#8e6238', w - 8, h * .6, 4, h * .22);
  },
  puddle: (c, w, h) => {
    disc(c, '#3c2f28', w / 2, h / 2, w / 2, h / 2);
    disc(c, '#6f93a8', w / 2, h / 2, w * .44, h * .38);
    disc(c, '#b7d6e2', w * .38, h * .4, w * .14, h * .1);
  },
  ramp: (c, w, h) => {
    poly(c, '#3b3238', [0, h, w * .1, 0, w * .9, 0, w, h]);
    poly(c, '#f2c230', [w * .06, h, w * .14, h * .12, w * .86, h * .12, w * .94, h]);
    for (let i = 0; i < 5; i++) {
      const x = w * (.2 + i * .15);
      poly(c, '#2c2630', [x - 12, h * .9, x, h * .3, x + 12, h * .9, x, h * .62]);
    }
  },
  gate: (c, w, h) => {
    const post = w * .05;
    box(c, '#2fb7a6', 0, h * .12, post, h * .88);
    box(c, '#2fb7a6', w - post, h * .12, post, h * .88);
    box(c, '#1a7f8c', post * .6, h * .12, post * .4, h * .88);
    box(c, '#1a7f8c', w - post, h * .12, post * .4, h * .88);
    box(c, '#16304a', 0, 0, w, h * .2);
    for (let x = 6; x < w - 8; x += 22) poly(c, '#ffe066', [x, h * .04, x + 12, h * .1, x, h * .16]);
  },
  timegate: (c, w, h) => {
    const post = w * .06;
    for (const x of [0, w - post]) {
      box(c, '#ffd23c', x, h * .12, post, h * .88);
      for (let y = h * .2; y < h; y += h * .16) box(c, '#17151c', x, y, post, h * .06);
    }
    box(c, '#16304a', 0, 0, w, h * .24);
    disc(c, '#fff3b8', w / 2, h * .12, h * .09);
    c.strokeStyle = '#16304a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h * .06);
    c.lineTo(w / 2, h * .12);
    c.lineTo(w / 2 + h * .05, h * .14);
    c.stroke();
    for (const s of [-1, 1]) poly(c, '#5ff0d8', [w / 2 + s * w * .14, h * .05, w / 2 + s * w * .3, h * .12, w / 2 + s * w * .14, h * .19]);
  },
  checkpoint: (c, w, h) => banner(c, w, h, '#1c7ed6', 'CHECKPOINT'),
  finish: (c, w, h) => {
    banner(c, w, h, '#101014', 'FINISH');
    for (let x = 0; x < w; x += 12) for (let y = 0; y < 2; y++) box(c, (x / 12 + y) % 2 ? '#fff' : '#000', x, h * .22 + y * 6, 12, 6);
  },
  arrowL: (c, w, h) => arrow(c, w, h, -1),
  arrowR: (c, w, h) => arrow(c, w, h, 1),

  mesa: (c, w, h) => {
    poly(c, '#9c4c35', [0, h, w * .12, h * .5, w * .2, h * .46, w * .26, h * .1, w * .72, h * .06, w * .8, h * .44, w * .9, h * .52, w, h]);
    poly(c, '#c56b45', [w * .26, h * .1, w * .72, h * .06, w * .7, h * .22, w * .28, h * .24]);
    poly(c, '#7c3a2c', [w * .6, h, w * .68, h * .3, w * .8, h * .44, w * .9, h * .52, w, h]);
    for (let i = 0; i < 4; i++) box(c, '#b85f3f', w * .22, h * (.34 + i * .14), w * .46, 3);
  },
  cactus: (c, w, h) => {
    const m = w / 2, t = w * .17;
    box(c, '#2f7a4b', m - t / 2, h * .08, t, h * .92);
    disc(c, '#2f7a4b', m, h * .08, t / 2);
    box(c, '#2f7a4b', w * .12, h * .46, m - w * .12, t * .8);
    box(c, '#2f7a4b', w * .12, h * .24, t * .8, h * .26);
    box(c, '#2f7a4b', m, h * .36, w * .36, t * .8);
    box(c, '#2f7a4b', w * .76, h * .14, t * .8, h * .26);
    box(c, '#4da267', m - t / 2 + 2, h * .08, 3, h * .92);
  },
  scrub: (c, w, h) => {
    for (const [x, y, r] of [[.25, .7, .22], [.5, .55, .3], [.75, .72, .2]]) disc(c, '#7f8a3e', w * x, h * y, w * r, h * r * 1.2);
    disc(c, '#a0a851', w * .46, h * .46, w * .14, h * .18);
  },
  pine: (c, w, h) => {
    box(c, '#4a3224', w * .44, h * .82, w * .12, h * .18);
    for (let i = 0; i < 4; i++) {
      const y = h * (.02 + i * .2), half = w * (.2 + i * .1);
      poly(c, '#1f5a4a', [w / 2, y, w / 2 + half, y + h * .3, w / 2 - half, y + h * .3]);
      poly(c, '#f4fbff', [w / 2, y, w / 2 + half * .5, y + h * .13, w / 2, y + h * .09, w / 2 - half * .5, y + h * .13]);
    }
  },
  crag: (c, w, h) => {
    poly(c, '#5b7690', [0, h, w * .2, h * .3, w * .42, h * .42, w * .6, h * .02, w * .84, h * .46, w, h]);
    poly(c, '#f4fbff', [w * .6, h * .02, w * .72, h * .24, w * .62, h * .2, w * .54, h * .3, w * .48, h * .24]);
    poly(c, '#40586f', [w * .6, h, w * .68, h * .4, w * .84, h * .46, w, h]);
  },
  drift: (c, w, h) => {
    disc(c, '#ffffff', w * .5, h, w * .5, h * .9);
    disc(c, '#cfe0ee', w * .68, h, w * .24, h * .5);
  },
  mangrove: (c, w, h) => {
    for (const x of [.2, .34, .5, .66, .8]) {
      c.strokeStyle = '#4b3a2a';
      c.lineWidth = w * .035;
      c.beginPath();
      c.moveTo(w * x, h);
      c.quadraticCurveTo(w * x, h * .7, w * .5, h * .5);
      c.stroke();
    }
    for (const [x, y, r] of [[.25, .36, .24], [.5, .24, .3], [.76, .36, .24], [.5, .42, .22]]) disc(c, '#1f6b3f', w * x, h * y, w * r, h * r);
    for (const [x, y, r] of [[.42, .16, .14], [.7, .3, .1], [.2, .3, .09]]) disc(c, '#36935a', w * x, h * y, w * r, h * r);
  },
  reeds: (c, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = w * (.08 + i * .105), top = h * (.1 + (i * 37 % 40) / 100);
      box(c, i % 2 ? '#7fa84d' : '#5f8c3e', x, top, 3, h - top);
      if (i % 3 === 0) box(c, '#6a4427', x - 1, top - 8, 5, 14);
    }
  },
  stilt: (c, w, h) => {
    for (const x of [.14, .4, .62, .84]) box(c, '#4b3a2a', w * x, h * .55, w * .04, h * .45);
    box(c, '#8a6a43', w * .08, h * .34, w * .84, h * .24);
    box(c, '#6a4f31', w * .42, h * .4, w * .16, h * .18);
    box(c, '#ffe28a', w * .18, h * .4, w * .12, h * .08);
    box(c, '#ffe28a', w * .7, h * .4, w * .12, h * .08);
    poly(c, '#b8a155', [0, h * .36, w * .5, h * .02, w, h * .36]);
  },
  spire: (c, w, h) => {
    poly(c, '#2f2230', [w * .1, h, w * .36, h * .3, w * .5, 0, w * .66, h * .34, w * .9, h]);
    poly(c, '#4a3548', [w * .36, h * .3, w * .5, 0, w * .48, h * .6, w * .3, h]);
    poly(c, '#ff6a1a', [w * .6, h, w * .63, h * .6, w * .68, h]);
  },
  deadtree: (c, w, h) => {
    c.strokeStyle = '#181014';
    c.lineCap = 'round';
    const limb = (x, y, a, len, t) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      c.lineWidth = t;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x2, y2);
      c.stroke();
      if (t > 2) {
        limb(x2, y2, a - .55, len * .7, t * .62);
        limb(x2, y2, a + .5, len * .66, t * .62);
      }
    };
    limb(w / 2, h, -Math.PI / 2, h * .34, w * .09);
  },
  vent: (c, w, h) => {
    poly(c, '#2b2028', [0, h, w * .2, h * .3, w * .36, h * .36, w * .64, h * .36, w * .8, h * .3, w, h]);
    disc(c, '#ff9a2e', w / 2, h * .42, w * .17, h * .1);
    disc(c, '#fff0a0', w / 2, h * .42, w * .08, h * .05);
  },
};

function banner(c, w, h, color, text) {
  const post = w * .02;
  box(c, '#d8d8e0', 0, 0, post, h);
  box(c, '#d8d8e0', w - post, 0, post, h);
  box(c, color, 0, 0, w, h * .22);
  c.fillStyle = '#fff';
  c.font = `bold ${Math.floor(h * .15)}px monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, w / 2, h * .11);
}

function arrow(c, w, h, dir) {
  box(c, '#3c3440', w * .44, h * .6, w * .12, h * .4);
  box(c, '#ffd23c', 0, 0, w, h * .64);
  box(c, '#1e1a22', 3, 3, w - 6, h * .64 - 6);
  const m = w / 2, y = h * .32, s = dir * w * .22;
  poly(c, '#ffd23c', [m + s, y, m - s * .4, y - h * .22, m - s * 1.2, y - h * .22, m, y, m - s * 1.2, y + h * .22, m - s * .4, y + h * .22]);
}

const SPRITE_PIXELS = {
  beacon: [48, 48], boulder: [78, 60], barrel: [50, 66], trunk: [240, 44], puddle: [130, 18], ramp: [160, 42],
  gate: [230, 146], timegate: [230, 146], checkpoint: [420, 136], finish: [420, 136], arrowL: [60, 70], arrowR: [60, 70],
  mesa: [220, 165], cactus: [64, 112], scrub: [76, 42], pine: [96, 156], crag: [150, 120], drift: [100, 32],
  mangrove: [140, 140], reeds: [70, 64], stilt: [130, 124], spire: [70, 152], deadtree: [100, 130], vent: [84, 42],
};

// Seamless ridge line: integer sine harmonics repeat exactly across the tile width.
function ridge(w, h, color, seed, rough, jagged) {
  const rnd = mulberry32(seed);
  const waves = [1, 2, 3, 5, 8, 13].map((k, i) => ({ k, a: rough / (i + 1), p: rnd() * 6.28 }));
  return sprite(w, h, c => {
    c.fillStyle = color;
    for (let x = 0; x < w; x++) {
      let y = 0;
      for (const v of waves) {
        const s = Math.sin(v.k * x / w * 6.2832 + v.p);
        y += v.a * (jagged ? Math.abs(s) * 2 - 1 : s);
      }
      const top = Math.floor(h * .55 - y);
      c.fillRect(x, top, 1, h - top);
    }
  });
}

function makeStageArt(stage, index) {
  const pal = stage.pal;
  const art = {};
  for (const [k, [w, h]] of Object.entries(SPRITE_PIXELS)) art[k] = sprite(w, h, PAINTERS[k]);

  art.sky = sprite(VIEW_W, VIEW_H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h * .56);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(.6, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const rnd = mulberry32(stage.seed);
    if (index === 3) for (let i = 0; i < 90; i++) box(c, '#ffd9c0', rnd() * w, rnd() * h * .35, 1, 1);
    disc(c, pal.sun + '44', w * .68, h * .3, 46);
    disc(c, pal.sun, w * .68, h * .3, 30);
  });
  art.far = ridge(1024, 110, pal.far, stage.seed + 1, 15, index !== 2);
  art.near = ridge(1024, 80, pal.near, stage.seed + 2, 9, index === 1);
  return art;
}

// The player's three-wheeled rover, seen from behind. Drawn live so it can lean, spin and animate.
function drawRover(c, x, y, o) {
  c.save();
  c.translate(x, y - 26);
  c.rotate(o.roll);
  if (o.spin) c.scale(Math.cos(o.spin), 1);
  c.scale(1 + o.squash * .1, 1 - o.squash * .14);
  c.translate(0, 26);
  const s = o.steer;

  box(c, '#17151c', -8 + s * 24, -50, 16, 26);

  for (const side of [-1, 1]) {
    const wx = side * 41 + s * -2;
    box(c, '#17151c', wx - 15, -36, 30, 36);
    box(c, '#2e2b36', wx - 15, -36, 8, 36);
    for (let i = 0; i < 4; i++) {
      const ty = -36 + ((i * 9 + o.tread) % 36);
      box(c, '#3f3b48', wx - 15, ty, 30, 3);
    }
    box(c, '#ffcf3f', wx - 5, -21, 10, 8);
  }

  box(c, '#3d3945', -36, -22, 72, 7);
  poly(c, '#0f8f8a', [-30, -12, -34, -32, -18 + s * 5, -52, 18 + s * 5, -52, 34, -32, 30, -12]);
  poly(c, '#18c2b4', [-27, -30, -16 + s * 5, -49, 16 + s * 5, -49, 27, -30]);
  box(c, '#ffcf3f', -30, -19, 60, 5);
  box(c, '#ff5a3c', -28, -14, 11, 6);
  box(c, '#ff5a3c', 17, -14, 11, 6);

  box(c, '#2a2732', -7, -14, 14, 9);
  if (o.boost) {
    const f = 12 + (o.tread % 3) * 7;
    poly(c, '#ffd23c', [-6, -6, 0, f, 6, -6]);
    poly(c, '#ff5a3c', [-3, -6, 0, f * .6, 3, -6]);
  }

  box(c, '#e9e3d6', -13 + s * 8, -62, 26, 16);
  disc(c, '#ff5a3c', s * 11, -70, 12);
  box(c, '#fff', -12 + s * 11, -73, 24, 4);

  box(c, '#d8d8e0', 26, -82, 2, 50);
  poly(c, '#ffcf3f', [28, -82, 42 + Math.sin(o.tread) * 3, -77, 28, -72]);
  c.restore();
}
