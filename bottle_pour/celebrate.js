// Visual celebrations: sparkles when a bottle is completed, confetti for a win.
// Both are skipped for players who ask their system for reduced motion.

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SPARKLE_COUNT = 12;
const SPARKLE_MS = 700;

// A bounce of the bottle and a ring of sparkles from its neck.
function celebrateBottle(bottleEl, colour) {
  if (reducedMotion()) return;
  bottleEl.classList.remove("pop");
  void bottleEl.offsetWidth; // restart the animation
  bottleEl.classList.add("pop");

  const board = bottleEl.offsetParent;
  const x = bottleEl.offsetLeft + bottleEl.offsetWidth / 2;
  const y = bottleEl.offsetTop;
  for (let n = 0; n < SPARKLE_COUNT; n++) {
    const angle = (n / SPARKLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 36 + Math.random() * 28;
    const sparkle = document.createElement("div");
    sparkle.className = "sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.background = n % 2 ? colour : "#fff6c8";
    sparkle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    board.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), SPARKLE_MS);
  }
}

const CONFETTI_COUNT = 160;
const CONFETTI_MS = 3200;

// Confetti bursts up from the bottom corners and flutters down over the page.
function celebrateWin(colours) {
  if (reducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const scale = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  const pieces = Array.from({ length: CONFETTI_COUNT }, (_, n) => {
    const fromLeft = n % 2 === 0;
    const speed = height * (0.022 + Math.random() * 0.012);
    const angle = (fromLeft ? -1 : -2.1) + (Math.random() - 0.5) * 0.7;  // up and inward
    return {
      x: fromLeft ? 0 : width,
      y: height,
      vx: Math.cos(angle) * speed * 0.6,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
      colour: colours[n % colours.length],
    };
  });

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.min(1, (CONFETTI_MS - elapsed) / 600);  // fade out at the end
    for (const p of pieces) {
      p.vy += 0.25;            // gravity
      p.vx *= 0.99;            // air resistance
      p.vy = Math.min(p.vy, 4); // flutter rather than plummet
      p.x += p.vx + Math.sin(p.spin) * 0.6;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.scale(1, Math.cos(p.spin * 2));  // tumbling
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < CONFETTI_MS) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
