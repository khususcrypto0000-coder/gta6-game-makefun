// Neon Shores — all sound is synthesized, nothing is downloaded.
//
// WebAudio oscillators and filtered noise make the engine hum, the police
// siren, pickup blips, gunshots and a tiny bass-line loop. Audio starts
// only after the player's first key press or click, as browsers require.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let musicTimer = null;

// Create the audio graph on first user gesture. Safe to call often.
export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol || 0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
}

export const sfx = {
  pickup() { blip(660, 0.12, 'sine', 0.2, 990); },
  cash() { blip(880, 0.1, 'sine', 0.18, 1320); setTimeout(() => blip(1174, 0.14, 'sine', 0.15), 70); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 90)); },
  fail() { blip(220, 0.4, 'sawtooth', 0.18, 110); },
  shoot() { noiseBurst(0.09, 0.3, 2400); },
  punch() { noiseBurst(0.08, 0.2, 900); },
  crash() { noiseBurst(0.25, 0.35, 500); },
  steal() { blip(330, 0.1, 'square', 0.12, 220); },
  busted() { blip(440, 0.3, 'sawtooth', 0.2, 220); blip(440, 0.3, 'sawtooth', 0.2, 220); },
  horn() { blip(370, 0.18, 'square', 0.1, 370); },
};

// A two-tone police siren that wails while any patrol car is close.
let sirenOsc = null;
let sirenLfo = null;
export function setSiren(on) {
  if (!ctx) return;
  if (on && !sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenLfo = ctx.createOscillator();
    sirenLfo.frequency.value = 0.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    sirenOsc.connect(gain);
    gain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  } else if (!on && sirenOsc) {
    try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) {}
    sirenOsc = null;
    sirenLfo = null;
  }
}

// The engine hum follows the driven car's speed; call every frame.
export function setEngine(speedRatio) {
  if (!ctx) return;
  if (speedRatio <= 0.02) {
    if (engineOsc) {
      try { engineOsc.stop(); } catch (e) {}
      engineOsc = null;
      engineGain = null;
    }
    return;
  }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.03;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.value = 55 + speedRatio * 140;
  engineGain.gain.value = 0.02 + speedRatio * 0.05;
}

// A tiny bass-line loop for the city at night. Starts after the first
// interaction and keeps a steady groove under the action.
const BASSLINE = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4];
let musicStep = 0;
export function startMusic() {
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(() => {
    if (muted) return;
    const f = BASSLINE[musicStep % BASSLINE.length];
    musicStep++;
    if (f) blip(f, 0.22, 'triangle', 0.12);
    if (musicStep % 4 === 2) noiseBurst(0.03, 0.05, 6000);
  }, 240);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
