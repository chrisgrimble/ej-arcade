// Transfer codes: a player's progress packed into a short code, so they can
// carry it to another device. There's no server; the code holds everything.
//
// Layout before encoding: [version] [unlocked level] [number of star entries]
// [star ratings, 2 bits each] [name as UTF-8] [checksum]. It's written in
// Crockford base32, which has no I, L, O or U, so it's easy to read out and type.

const TRANSFER_VERSION = 1;
const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// CRC-8: catches typos, including two characters swapped.
function crc8(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

function toBase32(bytes) {
  let out = "", buffer = 0, bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

function fromBase32(text) {
  const bytes = [];
  let buffer = 0, bits = 0;
  for (const char of text) {
    const value = BASE32.indexOf(char);
    if (value < 0) return null;
    buffer = ((buffer << 5) | value) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes;
}

// Returns the code in groups of four, e.g. "0G1M-2K8Q-...".
function encodeTransfer(name, progress) {
  const stars = progress.stars.slice(0, 255).map(s => Math.max(0, Math.min(3, s || 0)));
  while (stars.length && !stars[stars.length - 1]) stars.pop();  // trailing zeros add nothing
  const packed = [];
  stars.forEach((s, i) => { packed[i >> 2] = (packed[i >> 2] || 0) | (s << ((i & 3) * 2)); });
  const bytes = [
    TRANSFER_VERSION,
    Math.max(0, Math.min(255, progress.unlocked)),
    stars.length,
    ...packed,
    ...new TextEncoder().encode(name.trim()),
  ];
  bytes.push(crc8(bytes));
  return toBase32(bytes).match(/.{1,4}/g).join("-");
}

// Reads a code back into { name, unlocked, stars }, or returns null if it
// isn't a valid code. Forgiving about case, spaces, dashes and look-alikes.
function decodeTransfer(code) {
  const clean = String(code).toUpperCase().replace(/[\s-]/g, "")
    .replace(/O/g, "0").replace(/[IL]/g, "1");
  if (clean.length < 8) return null;
  const bytes = fromBase32(clean);
  if (!bytes || bytes.length < 5) return null;
  const checksum = bytes.pop();
  if (crc8(bytes) !== checksum || bytes[0] !== TRANSFER_VERSION) return null;

  const [, unlocked, count] = bytes;
  const packedLength = Math.ceil(count / 4);
  if (bytes.length < 3 + packedLength + 1) return null;  // must leave room for a name
  const stars = Array.from({ length: count }, (_, i) => (bytes[3 + (i >> 2)] >> ((i & 3) * 2)) & 3);
  let name;
  try {
    name = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes.slice(3 + packedLength))).trim();
  } catch {
    return null;
  }
  return name ? { name, unlocked, stars } : null;
}

// Combines two saves for the same player, keeping the best of each.
function mergeProgress(a, b) {
  const length = Math.max(a.stars.length, b.stars.length);
  return {
    unlocked: Math.max(a.unlocked, b.unlocked),
    stars: Array.from({ length }, (_, i) => Math.max(a.stars[i] || 0, b.stars[i] || 0)),
  };
}
