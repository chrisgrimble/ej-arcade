// Sound effects, synthesised with the Web Audio API so there are no sound files.
// Uses readValue / writeValue from progress.js to remember the mute setting.

const MUTED_KEY = "bottlePour_muted";

let audio = null;
let muted = readValue(MUTED_KEY) === "1";

// Browsers only allow audio after the player has interacted with the page,
// so the context is created on the first sound, which always follows a click.
function audioContext() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio = new Ctx();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

// One note with a fast attack and a smooth fade out.
function tone(freq, start, duration, { type = "sine", volume = 0.2, slideTo = null } = {}) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function play(schedule) {
  if (muted) return;
  const ctx = audioContext();
  if (ctx) schedule(ctx.currentTime);
}

const sounds = {
  pickUp: () => play(t => tone(660, t, 0.06, { type: "triangle", volume: 0.08 })),
  putDown: () => play(t => tone(440, t, 0.06, { type: "triangle", volume: 0.06 })),

  invalid: () => play(t => tone(170, t, 0.2, { type: "square", volume: 0.04, slideTo: 110 })),

  // A run of bubbles; they get higher as the target bottle fills, like a real glass.
  // fromFill and toFill are how full the target is (0 to 1) before and after.
  pour: (durationMs, fromFill, toFill) => play(t => {
    const duration = durationMs / 1000;
    for (let at = 0; at < duration; at += 0.04 + Math.random() * 0.05) {
      const fill = fromFill + (toFill - fromFill) * (at / duration);
      const freq = (280 + fill * 520) * (0.85 + Math.random() * 0.3);
      tone(freq, t + at, 0.07, { volume: 0.1, slideTo: freq * 1.8 });
    }
  }),

  // A quick upward flick as a hidden layer turns face up.
  reveal: () => play(t => tone(520, t, 0.12, { type: "triangle", volume: 0.07, slideTo: 1040 })),

  // A low clunk as the lock gives, then a bright ding.
  unlock: () => play(t => {
    tone(220, t, 0.1, { type: "square", volume: 0.05, slideTo: 330 });
    tone(1319, t + 0.1, 0.4, { type: "triangle", volume: 0.09 });
  }),

  hint: () => play(t => {
    tone(880, t, 0.25, { volume: 0.07 });
    tone(1175, t + 0.1, 0.35, { volume: 0.06 });
  }),

  bottleDone: () => play(t => {
    tone(1047, t, 0.5, { volume: 0.1 });
    tone(1319, t + 0.08, 0.6, { volume: 0.08 });
  }),

  win: () => play(t => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone(freq, t + i * 0.12, i === 3 ? 0.9 : 0.3, { type: "triangle", volume: 0.14 }));
  }),
};

function isMuted() {
  return muted;
}

function setMuted(value) {
  muted = value;
  writeValue(MUTED_KEY, value ? "1" : "0");
}
