'use strict';
// The puzzle pictures, drawn from shapes and emoji so they look sharp at any
// size. Each scene draws into a W x H box (always 4:3).

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

// A seeded random so a scene's stars and bubbles land in the same places every time.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sky(ctx, W, H, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Place an emoji with its centre at (x, y), sized as a fraction of the height.
function emoji(ctx, W, H, char, x, y, size, flip = false) {
  ctx.save();
  ctx.translate(x * W, y * H);
  if (flip) ctx.scale(-1, 1);
  ctx.font = `${size * H}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 0);
  ctx.restore();
}

function hill(ctx, W, H, colour, y, bump) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, y * H);
  ctx.bezierCurveTo(W * 0.3, (y - bump) * H, W * 0.6, (y + bump) * H, W, (y - bump / 2) * H);
  ctx.lineTo(W, H);
  ctx.fill();
}

function cloud(ctx, W, H, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, -0.35, 1.2], [1.9, 0, 0.95], [0.9, 0.25, 1]]) {
    ctx.beginPath();
    ctx.arc((x + dx * s) * W, (y + dy * s) * H, r * s * H, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sun(ctx, W, H, x, y, r) {
  ctx.save();
  ctx.translate(x * W, y * H);
  ctx.fillStyle = '#ffd21f';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillRect(-r * H * 0.12, -r * H * 1.55, r * H * 0.24, r * H * 0.45);
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * H, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe23d';
  ctx.fill();
  ctx.restore();
}

const SCENES = [
  {
    name: 'Farm',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#6cc7ff', '#d4f1ff');
      sun(ctx, W, H, 0.85, 0.17, 0.08);
      cloud(ctx, W, H, 0.12, 0.14, 0.05);
      cloud(ctx, W, H, 0.48, 0.1, 0.04);
      hill(ctx, W, H, '#7fd35a', 0.5, 0.08);
      hill(ctx, W, H, '#52b83a', 0.66, 0.06);
      // fence
      ctx.fillStyle = '#b07a45';
      for (let x = 0.02; x < 1; x += 0.07) ctx.fillRect(x * W, 0.6 * H, 0.018 * W, 0.12 * H);
      ctx.fillRect(0, 0.63 * H, W, 0.02 * H);
      ctx.fillRect(0, 0.68 * H, W, 0.02 * H);
      emoji(ctx, W, H, '🏡', 0.2, 0.45, 0.24);
      emoji(ctx, W, H, '🐄', 0.62, 0.8, 0.2, true);
      emoji(ctx, W, H, '🐖', 0.3, 0.86, 0.15);
      emoji(ctx, W, H, '🐑', 0.86, 0.85, 0.15, true);
      emoji(ctx, W, H, '🐔', 0.08, 0.88, 0.12);
      emoji(ctx, W, H, '🚜', 0.72, 0.48, 0.15);
      emoji(ctx, W, H, '🌻', 0.45, 0.62, 0.1);
      emoji(ctx, W, H, '🌻', 0.52, 0.66, 0.08);
    },
  },
  {
    name: 'Under the Sea',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#38c8f0', '#0b4f9c');
      const rnd = seeded(7);
      // light rays
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      for (const x of [0.15, 0.4, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x * W, 0);
        ctx.lineTo((x + 0.08) * W, 0);
        ctx.lineTo((x + 0.2) * W, H);
        ctx.lineTo((x + 0.05) * W, H);
        ctx.fill();
      }
      // sand
      ctx.fillStyle = '#f3d48b';
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, 0.84 * H);
      ctx.quadraticCurveTo(W * 0.5, 0.76 * H, W, 0.86 * H);
      ctx.lineTo(W, H);
      ctx.fill();
      // seaweed
      ctx.lineCap = 'round';
      for (const [x, h, c] of [[0.06, 0.4, '#2fb35a'], [0.1, 0.3, '#46d16f'], [0.92, 0.45, '#2fb35a'], [0.88, 0.3, '#46d16f']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.025 * H;
        ctx.beginPath();
        ctx.moveTo(x * W, 0.9 * H);
        for (let i = 1; i <= 6; i++) ctx.lineTo((x + (i % 2 ? 0.02 : -0.02)) * W, (0.9 - (h * i) / 6) * H);
        ctx.stroke();
      }
      // bubbles
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 0.006 * H;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * 0.75 * H, (0.008 + rnd() * 0.02) * H, 0, Math.PI * 2);
        ctx.stroke();
      }
      emoji(ctx, W, H, '🐳', 0.7, 0.22, 0.26);
      emoji(ctx, W, H, '🐠', 0.25, 0.3, 0.16);
      emoji(ctx, W, H, '🐟', 0.45, 0.5, 0.13, true);
      emoji(ctx, W, H, '🐢', 0.68, 0.58, 0.18, true);
      emoji(ctx, W, H, '🐙', 0.24, 0.72, 0.2);
      emoji(ctx, W, H, '🦀', 0.55, 0.88, 0.12);
      emoji(ctx, W, H, '🐚', 0.8, 0.9, 0.09);
      emoji(ctx, W, H, '🐡', 0.9, 0.45, 0.11, true);
    },
  },
  {
    name: 'Space',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#0b0630', '#2a1660');
      const rnd = seeded(42);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = ['#fff', '#ffe98a', '#a8e8ff'][i % 3];
        const s = (0.004 + rnd() * 0.008) * H;
        ctx.fillRect(rnd() * W, rnd() * H, s, s);
      }
      emoji(ctx, W, H, '🪐', 0.78, 0.25, 0.26);
      emoji(ctx, W, H, '🌍', 0.2, 0.78, 0.3);
      emoji(ctx, W, H, '🌙', 0.12, 0.17, 0.16);
      emoji(ctx, W, H, '🚀', 0.5, 0.45, 0.24);
      emoji(ctx, W, H, '👽', 0.78, 0.75, 0.15);
      emoji(ctx, W, H, '🛸', 0.6, 0.86, 0.13);
      emoji(ctx, W, H, '☄️', 0.38, 0.14, 0.12);
      emoji(ctx, W, H, '⭐', 0.92, 0.55, 0.08);
    },
  },
  {
    name: 'Dino Land',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#ff9a4d', '#ffe1a3');
      // volcano
      ctx.fillStyle = '#7a4b33';
      ctx.beginPath();
      ctx.moveTo(0.45 * W, 0.7 * H);
      ctx.lineTo(0.66 * W, 0.2 * H);
      ctx.lineTo(0.76 * W, 0.2 * H);
      ctx.lineTo(0.98 * W, 0.7 * H);
      ctx.fill();
      ctx.fillStyle = '#ff4b1f';
      ctx.beginPath();
      ctx.moveTo(0.66 * W, 0.2 * H);
      ctx.lineTo(0.76 * W, 0.2 * H);
      ctx.lineTo(0.74 * W, 0.34 * H);
      ctx.lineTo(0.71 * W, 0.27 * H);
      ctx.lineTo(0.68 * W, 0.36 * H);
      ctx.fill();
      ctx.fillStyle = 'rgba(90,70,70,.5)';
      for (const [x, y, r] of [[0.71, 0.13, 0.05], [0.66, 0.07, 0.04], [0.76, 0.06, 0.035]]) {
        ctx.beginPath(); ctx.arc(x * W, y * H, r * H, 0, Math.PI * 2); ctx.fill();
      }
      hill(ctx, W, H, '#8bd14a', 0.66, 0.05);
      emoji(ctx, W, H, '🌴', 0.1, 0.5, 0.32);
      emoji(ctx, W, H, '🌴', 0.32, 0.56, 0.22);
      emoji(ctx, W, H, '🦕', 0.62, 0.72, 0.3, true);
      emoji(ctx, W, H, '🦖', 0.24, 0.8, 0.26);
      emoji(ctx, W, H, '🥚', 0.88, 0.88, 0.1);
      emoji(ctx, W, H, '🥚', 0.94, 0.9, 0.08);
      emoji(ctx, W, H, '🦋', 0.42, 0.28, 0.08);
    },
  },
  {
    name: 'Rainbow Castle',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#b8a8ff', '#ffd6f0');
      const colours = ['#ff4d4d', '#ffa64d', '#ffe14d', '#5be36b', '#4dc3ff', '#9b6bff'];
      ctx.lineWidth = 0.05 * H;
      colours.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(0.5 * W, 0.95 * H, (0.7 - i * 0.05) * H, Math.PI, 0);
        ctx.stroke();
      });
      cloud(ctx, W, H, 0.05, 0.88, 0.07);
      cloud(ctx, W, H, 0.78, 0.88, 0.07);
      hill(ctx, W, H, '#9ee6a0', 0.82, 0.03);
      emoji(ctx, W, H, '🏰', 0.5, 0.62, 0.36);
      emoji(ctx, W, H, '🦄', 0.18, 0.66, 0.22);
      emoji(ctx, W, H, '🎈', 0.86, 0.22, 0.14);
      emoji(ctx, W, H, '🎈', 0.92, 0.3, 0.1);
      emoji(ctx, W, H, '✨', 0.12, 0.15, 0.1);
      emoji(ctx, W, H, '✨', 0.62, 0.12, 0.08);
      emoji(ctx, W, H, '🧚', 0.8, 0.6, 0.15, true);
    },
  },
  {
    name: 'Safari',
    draw(ctx, W, H) {
      sky(ctx, W, H, '#ffb347', '#fff1b8');
      ctx.beginPath();
      ctx.arc(0.5 * W, 0.55 * H, 0.22 * H, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd55';
      ctx.fill();
      hill(ctx, W, H, '#e8c25a', 0.6, 0.04);
      hill(ctx, W, H, '#d4a63c', 0.78, 0.03);
      emoji(ctx, W, H, '🌳', 0.12, 0.45, 0.32);
      emoji(ctx, W, H, '🦒', 0.82, 0.45, 0.34, true);
      emoji(ctx, W, H, '🐘', 0.55, 0.7, 0.26);
      emoji(ctx, W, H, '🦁', 0.2, 0.82, 0.22);
      emoji(ctx, W, H, '🦓', 0.82, 0.86, 0.17, true);
      emoji(ctx, W, H, '🐒', 0.15, 0.3, 0.1);
      emoji(ctx, W, H, '🦜', 0.4, 0.18, 0.1);
    },
  },
];

// A picture the player chose from their own photos: crop it to fill 4:3.
function photoScene(img) {
  return {
    name: 'My Photo',
    draw(ctx, W, H) {
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    },
  };
}
