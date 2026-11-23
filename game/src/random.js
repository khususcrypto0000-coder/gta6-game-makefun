// Neon Shores — a tiny seeded random number generator.
//
// The whole city, its traffic and its pedestrians come from one seeded
// stream, so a screenshot run with ?seed=1 always builds the same city.
// mulberry32 is small, fast and good enough for a game.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a rng stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick an integer in [min, max] from a rng stream.
export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one element of an array, uniformly.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A stable hash of a string, for seeding a stream from a word.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
