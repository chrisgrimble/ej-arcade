// Bottle Pour - a liquid sorting puzzle.
// Rules live in rules.js and the fixed levels in levels.js.

const PALETTE = [
  "#e74c3c", // red
  "#3498db", // blue
  "#2ecc71", // green
  "#f1c40f", // yellow
  "#9b59b6", // purple
  "#e67e22", // orange
  "#5ef1ff", // cyan
  "#ff6fb5", // pink
  "#8d6e63", // brown
  "#bdc3c7", // grey
];

// ---------- game state ----------

let playerName = "";
let progress = { unlocked: 0, stars: [] };   // see progress.js
let levelIndex = 0;
let capacity = 4;
let bottles = [];        // current state: array of arrays of colours, bottom -> top
let specials = [];       // special layer properties, same shape as bottles (see rules.js)
let history = [];        // previous { bottles, specials }, for Undo
let moves = 0;
let selected = null;
let hintsUsed = 0;       // on this attempt; any hint caps the stars at 2
let hint = null;         // [from, to] being suggested, until the next pour
let specialsBefore = null; // specials before the last pour, to animate what it revealed

// ---------- UI ----------

const boardEl = document.getElementById("board");
const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const undoBtn = document.getElementById("undo");
const winEl = document.getElementById("win");
const winText = document.getElementById("win-text");

const nextBtn = document.getElementById("next");
const winStarsEl = document.getElementById("win-stars");
const levelsDialog = document.getElementById("levels-dialog");
const levelGrid = document.getElementById("level-grid");
const playerEl = document.getElementById("player");
const nameDialog = document.getElementById("name-dialog");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");

function currentLevel() {
  return LEVELS[levelIndex];
}

function startLevel() {
  capacity = currentLevel().capacity;
  resetToStart();
}

function resetToStart() {
  bottles = levelColours(currentLevel());
  specials = levelSpecials(currentLevel());
  specialsBefore = null;
  history = [];
  moves = 0;
  hintsUsed = 0;
  hint = null;
  showMessage("");
  document.querySelectorAll(".confetti").forEach(c => c.remove());
  selected = null;
  winEl.hidden = true;
  render();
}

function render() {
  levelEl.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
  movesEl.textContent = moves;
  undoBtn.disabled = history.length === 0;

  boardEl.innerHTML = "";
  bottles.forEach((bottle, i) => {
    const el = document.createElement("div");
    el.className = "bottle" + (selected === i ? " selected" : "") +
      (isComplete(bottle) ? " complete" : "") +
      (hint && hint[0] === i ? " hint-from" : "") +
      (hint && hint[1] === i ? " hint-to" : "");
    // Height scales with capacity, plus a little headroom for the neck.
    el.style.height = `calc(var(--layer-h) * ${capacity} + 16px)`;
    bottle.forEach((colour, depth) => {
      const layer = document.createElement("div");
      layer.className = "layer";
      if (specials[i][depth]?.hidden) {
        layer.classList.add("face-down");
        layer.textContent = "?";
      } else {
        layer.style.background = PALETTE[colour % PALETTE.length];
        if (specialsBefore?.[i]?.[depth]?.hidden) layer.classList.add("revealed");
      }
      el.appendChild(layer);
    });
    const hiddenHere = specials[i].filter(s => s.hidden).length;
    if (hiddenHere) {
      el.setAttribute("aria-label", `${hiddenHere} hidden layer${hiddenHere === 1 ? "" : "s"}`);
    }
    el.addEventListener("click", () => onBottleClick(i));
    boardEl.appendChild(el);
  });
}

function shake(index) {
  const el = boardEl.children[index];
  el.classList.remove("shake");
  void el.offsetWidth; // restart the animation
  el.classList.add("shake");
}

function onBottleClick(i) {
  if (animating) return;
  if (selected === null) {
    if (bottles[i].length === 0) {
      sounds.invalid();
      shake(i);
      return;
    }
    sounds.pickUp();
    selected = i;
    render();
    return;
  }

  if (selected === i) {
    sounds.putDown();
    selected = null;
    render();
    return;
  }

  const from = selected;
  selected = null;
  if (!canPour(bottles, from, i, capacity)) {
    sounds.invalid();
    render();
    shake(i);
    return;
  }

  animating = true;
  animatePour(from, i).then(() => {
    animating = false;
    history.push({ bottles: cloneState(bottles), specials: cloneSpecials(specials) });
    const amount = pour(bottles, from, i, capacity);
    pourSpecials(specials, from, i, amount);
    moves++;
    hint = null;
    showMessage("");
    specialsBefore = specials;
    specials = settleSpecials(bottles, specials, capacity);
    const revealed = specials.some((b, bi) => b.some((s, d) => !s.hidden && specialsBefore[bi][d]?.hidden));
    if (revealed) sounds.reveal();
    render();
    specialsBefore = null;

    if (isComplete(bottles[i])) {
      celebrateBottle(boardEl.children[i], PALETTE[bottles[i][0] % PALETTE.length]);
    }
    if (isWon(bottles, capacity)) {
      sounds.win();
      celebrateWin(PALETTE);
      showWin();
    } else if (isComplete(bottles[i])) {
      sounds.bottleDone();
    }
  });
}

// Full of a single colour.
function isComplete(bottle) {
  return bottle.length === capacity && isWon([bottle], capacity);
}

// ---------- stars ----------

const MAX_STARS = 3;

function starText(count) {
  return "★".repeat(count) + "☆".repeat(MAX_STARS - count);
}

function showWin() {
  const par = currentLevel().par;
  const earned = Math.min(starsFor(moves, par), hintsUsed ? HINT_STAR_CAP : MAX_STARS);
  const lastLevel = levelIndex === LEVELS.length - 1;
  const best = progress.stars[levelIndex] || 0;

  progress.stars[levelIndex] = Math.max(best, earned);
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
  saveProgress(playerName, progress);

  winStarsEl.innerHTML = "";
  for (let s = 0; s < MAX_STARS; s++) {
    const star = document.createElement("span");
    star.className = "star" + (s < earned ? " earned" : "");
    star.textContent = s < earned ? "★" : "☆";
    star.style.animationDelay = `${s * 0.15}s`;
    winStarsEl.appendChild(star);
  }
  winStarsEl.setAttribute("aria-label", `${earned} of ${MAX_STARS} stars`);

  let text = `Solved in ${moves} move${moves === 1 ? "" : "s"}. Best possible: ${par}.`;
  if (hintsUsed && earned === HINT_STAR_CAP) {
    text += ` Solve it without a hint in ${par} moves for 3 stars.`;
  } else if (earned < MAX_STARS) {
    text += ` Get it in ${earned === 1 ? Math.ceil(par * 1.5) : par} for ${earned + 1} stars.`;
  }
  if (best > earned) text += ` Your best here is ${best} stars.`;
  if (lastLevel) text += " You've completed every level!";
  winText.textContent = text;
  nextBtn.textContent = lastLevel ? "Play again" : "Next level";
  winEl.hidden = false;
}

// ---------- level select ----------

function openLevels() {
  levelGrid.innerHTML = "";
  LEVELS.forEach((level, i) => {
    const locked = i > progress.unlocked;
    const stars = progress.stars[i] || 0;
    const tile = document.createElement("button");
    tile.className = "level-tile" + (i === levelIndex ? " current" : "");
    tile.disabled = locked;
    tile.setAttribute("aria-label", locked
      ? `Level ${i + 1}, locked`
      : `Level ${i + 1}, ${stars ? `${stars} of ${MAX_STARS} stars` : "not solved yet"}`);
    tile.innerHTML =
      `<span class="tile-number">${i + 1}</span>` +
      `<span class="tile-stars">${locked ? "🔒" : starText(stars)}</span>`;
    tile.addEventListener("click", () => {
      levelsDialog.hidden = true;
      levelIndex = i;
      startLevel();
    });
    levelGrid.appendChild(tile);
  });
  const total = progress.stars.reduce((sum, s) => sum + (s || 0), 0);
  document.getElementById("star-total").textContent = `${total} / ${LEVELS.length * MAX_STARS} stars`;
  winEl.hidden = true;
  levelsDialog.hidden = false;
}

document.getElementById("levels").addEventListener("click", () => {
  if (!animating) openLevels();
});
document.getElementById("win-levels").addEventListener("click", openLevels);
document.getElementById("close-levels").addEventListener("click", () => {
  levelsDialog.hidden = true;
});

// ---------- pour animation ----------

const MOVE_MS = 350;        // bottle travelling to / from the target
const STREAM_MS = 120;      // stream reaching down / pulling away
const LAYER_MS = 220;       // time to pour each layer
const TILT_DEG = 100;
const POUR_GAP = 40;        // how far above the target's mouth the source pours from

let animating = false;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Plays the pour on the current DOM only; the caller updates the state afterwards.
async function animatePour(from, to) {
  const amount = Math.min(topRun(bottles[from]), capacity - bottles[to].length);
  const fromFill = bottles[to].length / capacity;
  const toFill = (bottles[to].length + amount) / capacity;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sounds.pour(300, fromFill, toFill);
    return;
  }

  const srcEl = boardEl.children[from];
  const dstEl = boardEl.children[to];
  const layerH = parseFloat(getComputedStyle(srcEl).getPropertyValue("--layer-h"));
  const colour = PALETTE[topColour(bottles[from]) % PALETTE.length];

  // Tilt around the mouth and park it just above the target's mouth.
  const half = srcEl.offsetWidth / 2;
  const pourX = dstEl.offsetLeft + half;
  const pourY = dstEl.offsetTop - POUR_GAP;
  const dx = pourX - (srcEl.offsetLeft + half);
  const dy = pourY - srcEl.offsetTop;
  // Lay the body back toward where the bottle came from, unless that side
  // has no room on screen (e.g. a narrow phone), then use the other side.
  const bodyLen = srcEl.offsetHeight;
  const screenX = boardEl.getBoundingClientRect().left + pourX;
  let bodyRight = dstEl.offsetLeft < srcEl.offsetLeft;
  if (bodyRight && screenX + bodyLen > window.innerWidth) bodyRight = false;
  else if (!bodyRight && screenX - bodyLen < 0) bodyRight = true;
  const tilt = bodyRight ? -TILT_DEG : TILT_DEG;

  srcEl.classList.remove("selected");
  srcEl.classList.add("pouring");
  srcEl.style.transition = `transform ${MOVE_MS}ms ease-in-out`;
  srcEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`;
  await wait(MOVE_MS);

  // Stream falls from the mouth to the target's liquid surface.
  const surfaceY = dstEl.offsetTop + dstEl.clientHeight - bottles[to].length * layerH;
  const stream = document.createElement("div");
  stream.className = "stream";
  stream.style.background = colour;
  stream.style.left = `${pourX - 5}px`;
  stream.style.top = `${pourY}px`;
  stream.style.height = "0px";
  stream.style.transition = `top ${STREAM_MS}ms linear, height ${STREAM_MS}ms linear`;
  boardEl.appendChild(stream);
  void stream.offsetHeight;
  stream.style.height = `${surfaceY - pourY}px`;
  await wait(STREAM_MS);

  // Drain the source's top layers while new layers rise in the target.
  const fillMs = amount * LAYER_MS;
  sounds.pour(fillMs, fromFill, toFill);
  const srcLayers = Array.from(srcEl.children).slice(-amount);
  const newLayers = [];
  for (let n = 0; n < amount; n++) {
    const layer = document.createElement("div");
    layer.className = "layer";
    layer.style.background = colour;
    layer.style.height = "0px";
    dstEl.appendChild(layer);
    newLayers.push(layer);
  }
  void dstEl.offsetHeight;
  for (const layer of [...srcLayers, ...newLayers]) {
    layer.style.transition = `height ${fillMs}ms linear`;
  }
  srcLayers.forEach(layer => {
    layer.style.height = "0px";
    layer.style.borderTopWidth = "0px";
  });
  newLayers.forEach(layer => { layer.style.height = `${layerH}px`; });
  stream.style.transition = `height ${fillMs}ms linear`;
  stream.style.height = `${surfaceY - amount * layerH - pourY}px`;
  await wait(fillMs);

  // Stream pulls away from the mouth, then the bottle goes home.
  stream.style.transition = `top ${STREAM_MS}ms linear, height ${STREAM_MS}ms linear`;
  stream.style.top = `${surfaceY - amount * layerH}px`;
  stream.style.height = "0px";
  await wait(STREAM_MS);
  stream.remove();

  srcEl.style.transform = "";
  await wait(MOVE_MS);
}

undoBtn.addEventListener("click", () => {
  if (animating || history.length === 0) return;
  // Puts back the special layers as they were too, so uncovered layers hide again.
  ({ bottles, specials } = history.pop());
  moves--;
  selected = null;
  hint = null;
  showMessage("");
  render();
});

document.getElementById("restart").addEventListener("click", () => {
  if (!animating) resetToStart();
});
nextBtn.addEventListener("click", () => {
  levelIndex = (levelIndex + 1) % LEVELS.length;
  startLevel();
});

// ---------- players ----------

const playerListEl = document.getElementById("player-list");
const playerButtonsEl = document.getElementById("player-buttons");
const cancelPlayerBtn = document.getElementById("cancel-player");
let returnToWin = false;  // the player list was opened from the win screen

// Shows everyone who has played on this device, plus a box for a new name.
function askForName({ fromWin = false } = {}) {
  returnToWin = fromWin;
  const players = listPlayers();
  playerButtonsEl.innerHTML = "";
  for (const player of players) {
    const isCurrent = player.name.trim().toLowerCase() === playerName.trim().toLowerCase();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "player-choice" + (isCurrent ? " current" : "");
    if (isCurrent) button.setAttribute("aria-current", "true");
    const level = Math.min(player.unlocked, LEVELS.length - 1) + 1;
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name;  // typed by players, so never inserted as HTML
    const detail = document.createElement("span");
    detail.className = "player-detail";
    detail.innerHTML = `Level ${level} · <span class="star-count">${player.totalStars} ★</span>`;
    button.append(name, detail);
    button.setAttribute("aria-label", `${player.name}, level ${level}, ${player.totalStars} stars`);
    button.addEventListener("click", () => choosePlayer(player.name));
    playerButtonsEl.appendChild(button);
  }
  playerListEl.hidden = players.length === 0;

  // With a list to pick from, leave the box empty; otherwise suggest the last name.
  nameInput.value = players.length ? "" : loadLastPlayer();
  cancelPlayerBtn.hidden = !playerName;
  openSendBtn.hidden = !playerName;
  cancelPlayerBtn.textContent = `Keep playing as ${playerName}`;
  winEl.hidden = true;
  nameDialog.hidden = false;
  // Focus the first name rather than the text box, so phones don't pop up a keyboard.
  (playerButtonsEl.firstElementChild || nameInput).focus();
  if (!players.length) nameInput.select();
}

function choosePlayer(name) {
  playerName = name.trim();
  saveLastPlayer(playerName);
  progress = loadProgress(playerName);
  progress.unlocked = Math.min(progress.unlocked, LEVELS.length - 1);
  saveProgress(playerName, progress);  // records them in the player list
  levelIndex = progress.unlocked;
  playerEl.textContent = playerName;
  nameDialog.hidden = true;
  startLevel();
}

nameForm.addEventListener("submit", event => {
  event.preventDefault();
  if (nameInput.value.trim()) choosePlayer(nameInput.value);
});

cancelPlayerBtn.addEventListener("click", () => {
  nameDialog.hidden = true;
  if (returnToWin) winEl.hidden = false;
});

document.getElementById("change-player").addEventListener("click", () => {
  if (!animating) askForName();
});
document.getElementById("win-change-player").addEventListener("click", () => {
  askForName({ fromWin: true });
});

// ---------- moving progress between devices ----------
// See transfer.js for the code format. The link carries the code after a #,
// which browsers never send to the server.

const openSendBtn = document.getElementById("open-send");
const sendDialog = document.getElementById("send-dialog");
const sendLinkEl = document.getElementById("send-link");
const sendCodeEl = document.getElementById("send-code");
const sendStatusEl = document.getElementById("send-status");
const shareLinkBtn = document.getElementById("share-link");
const receiveDialog = document.getElementById("receive-dialog");
const receiveCodeEl = document.getElementById("receive-code");
const receiveErrorEl = document.getElementById("receive-error");
const receivePreviewEl = document.getElementById("receive-preview");
let incoming = null;  // the decoded transfer waiting to be added

function progressSummary(name, saved) {
  const level = Math.min(saved.unlocked, LEVELS.length - 1) + 1;
  const stars = saved.stars.reduce((sum, s) => sum + s, 0);
  const summary = document.createElement("span");
  summary.textContent = `${name} · Level ${level} · `;
  const starCount = document.createElement("span");
  starCount.className = "star-count";
  starCount.textContent = `${stars} ★`;
  summary.append(starCount);
  return summary;
}

// A link only makes sense on the website itself, not from a file or inside
// the Claude page's frame.
function transferLink(code) {
  if (!location.protocol.startsWith("http") || window.top !== window) return null;
  return `${location.origin}${location.pathname}#transfer=${code}`;
}

function openSend() {
  const code = encodeTransfer(playerName, progress);
  const link = transferLink(code);
  document.getElementById("send-summary").replaceChildren(progressSummary(playerName, progress));
  document.getElementById("send-how").textContent = link
    ? "Open this link on your other device, or type the code there under Change player → Enter a transfer code."
    : "On your other device, go to Change player → Enter a transfer code and type this code.";
  sendLinkEl.hidden = !link;
  sendLinkEl.value = link || "";
  document.getElementById("copy-link").hidden = !link;
  shareLinkBtn.hidden = !(link && navigator.share);
  sendCodeEl.textContent = code;
  sendStatusEl.textContent = "";
  nameDialog.hidden = true;
  sendDialog.hidden = false;
}

async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    sendStatusEl.textContent = `${what} copied.`;
  } catch {
    sendStatusEl.textContent = `Couldn't copy automatically. Press and hold the ${what.toLowerCase()} to copy it.`;
  }
}

function openReceive(code = "") {
  incoming = null;
  receiveCodeEl.value = code;
  receiveErrorEl.textContent = "";
  receivePreviewEl.hidden = true;
  nameDialog.hidden = true;
  winEl.hidden = true;
  receiveDialog.hidden = false;
  if (code) checkCode();
  else receiveCodeEl.focus();
}

function checkCode() {
  incoming = decodeTransfer(receiveCodeEl.value);
  receivePreviewEl.hidden = !incoming;
  if (!incoming) {
    receiveErrorEl.textContent = receiveCodeEl.value.trim()
      ? "That code doesn't work. Check it was copied in full, with no mistakes."
      : "Type or paste a transfer code.";
    return;
  }
  receiveErrorEl.textContent = "";
  document.getElementById("receive-summary").replaceChildren(progressSummary(incoming.name, incoming));
  const existing = listPlayers().find(p => p.name.toLowerCase() === incoming.name.toLowerCase());
  document.getElementById("receive-merge").textContent = existing
    ? `${existing.name} already plays on this device (level ${Math.min(existing.unlocked, LEVELS.length - 1) + 1}, ` +
      `${existing.totalStars} ★). Adding keeps the furthest level and best stars from both.`
    : "This adds them as a player on this device.";
}

function addIncoming() {
  if (!incoming) return;
  const merged = mergeProgress(loadProgress(incoming.name), incoming);
  saveProgress(incoming.name, merged);
  receiveDialog.hidden = true;
  choosePlayer(incoming.name);
}

openSendBtn.addEventListener("click", openSend);
shareLinkBtn.addEventListener("click", () => {
  navigator.share({ title: "Bottle Pour progress", text: `My Bottle Pour progress (${playerName})`, url: sendLinkEl.value })
    .catch(() => {});  // the player closed the share sheet
});
document.getElementById("copy-link").addEventListener("click", () => copyText(sendLinkEl.value, "Link"));
document.getElementById("copy-code").addEventListener("click", () => copyText(sendCodeEl.textContent, "Code"));
document.getElementById("close-send").addEventListener("click", () => {
  sendDialog.hidden = true;
  askForName({ fromWin: returnToWin });
});

document.getElementById("open-receive").addEventListener("click", () => openReceive());
document.getElementById("receive-form").addEventListener("submit", event => {
  event.preventDefault();
  checkCode();
});
document.getElementById("receive-add").addEventListener("click", addIncoming);
document.getElementById("close-receive").addEventListener("click", () => {
  receiveDialog.hidden = true;
  askForName({ fromWin: returnToWin });
});

// Opening a transfer link: offer to add the progress, then tidy the address
// so a reload doesn't offer it again.
function receiveFromLink() {
  const match = location.hash.match(/^#transfer=([\w-]+)$/);
  if (!match) return false;
  // window.history: plain `history` is this game's undo list.
  window.history.replaceState(null, "", location.pathname + location.search);
  openReceive(match[1]);
  return true;
}

window.addEventListener("hashchange", () => {
  if (!animating) receiveFromLink();
});

// ---------- hints ----------

const HINT_STAR_CAP = 2;
const HINT_SEARCH_LIMIT = 200000;  // states; keeps the page responsive
const messageEl = document.getElementById("message");
let messageTimer = null;

function showMessage(text) {
  clearTimeout(messageTimer);
  messageEl.textContent = text;
  if (text) messageTimer = setTimeout(() => { messageEl.textContent = ""; }, 6000);
}

function showHint() {
  if (animating || !winEl.hidden) return;
  selected = null;
  render();

  // The solver sees every colour, so a hint would give hidden layers away.
  if (hasHiddenLayers(specials)) {
    showMessage("Hints switch on once every hidden layer has been uncovered.");
    return;
  }

  const path = solve(bottles, capacity, HINT_SEARCH_LIMIT);
  if (path === null) {
    sounds.invalid();
    showMessage("There's no way to win from here. Undo a few moves or restart.");
    return;
  }
  if (path === undefined) {
    showMessage("Too many possibilities to work out a hint here. Try undoing a few moves.");
    return;
  }
  if (path.length === 0) return;

  hint = path[0];
  hintsUsed++;
  render();
  sounds.hint();
  showMessage(`Pour the gold bottle into the white one. ` +
    `${path.length} move${path.length === 1 ? "" : "s"} to go at best.` +
    (hintsUsed === 1 ? " Hints limit this level to 2 stars." : ""));
}

document.getElementById("hint").addEventListener("click", showHint);

const soundBtn = document.getElementById("sound");

function showSoundSetting() {
  soundBtn.textContent = isMuted() ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!isMuted()));
}

soundBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  showSoundSetting();
  sounds.pickUp();  // a little confirmation when turning sound on
});
showSoundSetting();

// ---------- boot ----------
// When hosted as a Claude page, an update to the page keeps the game in progress.
// Elsewhere window.claude doesn't exist and this just asks for a name.

window.claude?.hot?.snapshot?.(() => ({ playerName, levelIndex, bottles, specials, history, moves, hintsUsed }));

function boot(saved = {}) {
  if (!saved.playerName || !(saved.levelIndex < LEVELS.length)) return askForName();
  ({ playerName, levelIndex } = saved);
  progress = loadProgress(playerName);
  playerEl.textContent = playerName;
  // A game kept from before special layers existed can't be resumed; restart it.
  if (!saved.specials) return startLevel();
  ({ bottles, specials, history, moves } = saved);
  hintsUsed = saved.hintsUsed || 0;
  capacity = currentLevel().capacity;
  render();
}

window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
receiveFromLink();

// ---------- installing as an app ----------
// Only on the website itself: not when opened from disk, and not in the
// single-file bundle (which has no manifest or sw.js alongside it).
const servedSecurely = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
if ("serviceWorker" in navigator && servedSecurely && document.querySelector('link[rel="manifest"]')) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Without it the game still works; it just can't be installed or played offline.
  });
}
