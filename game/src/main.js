// Neon Shores — the game loop and the screens around it.
//
// Title → play → (busted | wasted | paused) → play, with the story
// saving itself to localStorage as you go. The canvas is sized to the
// window; the camera follows the player and pulls back a little when
// driving fast, so the road ahead stays readable.

import { buildCity } from './world.js';
import { makeRng } from './random.js';
import {
  makePlayer, spawnTraffic, spawnPeds, spawnPickups, updateEntities,
} from './entities.js';
import { makeMissionState, startMission, updateMissions } from './missions.js';
import { render } from './render.js';
import { makeInput } from './input.js';
import { ensureAudio, setSiren, setEngine, startMusic, toggleMute } from './audio.js';
import { readShotParams, stageShot, clampShotCamera } from './shots.js';

const SAVE_KEY = 'neon-shores-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.player.cash),
      missionIndex: state.mission.index,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      best: state.best,
    }));
  } catch (e) {
    // Storage can be off in a sandbox; the game still plays.
  }
}

function makeState(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const state = {
    seed,
    rng,
    city,
    player: makePlayer(city),
    cars: [],
    peds: [],
    pickups: [],
    bullets: [],
    particles: [],
    mission: makeMissionState(),
    events: [],
    toasts: [],
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1 },
    view: { w: window.innerWidth, h: window.innerHeight },
    screen: 'title',
    time: 0,
    saveTimer: 0,
    hasSave: false,
    best: null,
    bustFine: 0,
    shot: null,
  };
  spawnTraffic(state);
  spawnPeds(state);
  spawnPickups(state);
  return state;
}

function applySave(state, save) {
  if (!save) return;
  state.hasSave = true;
  state.best = save.best || null;
  state.savedRun = save;
}

function newRun(state) {
  state.player = makePlayer(state.city);
  state.cars = [];
  state.peds = [];
  state.pickups = [];
  state.bullets = [];
  state.particles = [];
  state.mission = makeMissionState();
  state.events = [];
  state.toasts = [];
  spawnTraffic(state);
  spawnPeds(state);
  spawnPickups(state);
  state.screen = 'play';
  startMission(state);
}

function continueRun(state) {
  const save = state.savedRun;
  newRun(state);
  if (save) {
    state.player.cash = save.cash || 50;
    state.player.x = save.x || state.city.spawn.x;
    state.player.y = save.y || state.city.spawn.y;
    state.mission.index = Math.min(save.missionIndex || 0, 4);
    startMission(state);
  }
}

function enterBusted(state) {
  const p = state.player;
  state.bustFine = Math.round(p.cash * 0.1);
  p.cash -= state.bustFine;
  p.wanted = 0;
  p.bust = 0;
  if (p.inCar) {
    p.inCar.kind = 'parked';
    p.inCar.driver = null;
    p.inCar = null;
  }
  state.screen = 'busted';
  writeSave(state);
}

function enterWasted(state) {
  const p = state.player;
  p.cash = Math.round(p.cash * 0.85);
  p.wanted = 0;
  p.health = 100;
  if (p.inCar) {
    p.inCar.kind = 'parked';
    p.inCar.driver = null;
    p.inCar = null;
  }
  state.screen = 'wasted';
  writeSave(state);
}

function respawn(state) {
  const p = state.player;
  p.x = state.city.places.hospital.x;
  p.y = state.city.places.hospital.y;
  p.health = 100;
  p.bust = 0;
  p.wanted = 0;
  state.screen = 'play';
  state.mission.message = 'You wake up at the hospital. Mama Rosa still expects the job done.';
  state.mission.messageTimer = 4;
}

// Drain one frame of events: arrests, deaths and toast lines.
function drainEvents(state) {
  for (const ev of state.events) {
    if (ev === 'busted') enterBusted(state);
    else if (ev === 'wasted') enterWasted(state);
    else if (ev === 'story-complete') {
      state.best = {
        cash: Math.round(state.player.cash),
        missions: 5,
      };
      writeSave(state);
    } else {
      state.toasts.push({ text: ev, timer: 3 });
    }
  }
  state.events = [];
  for (const toast of state.toasts) toast.timer -= 1 / 60;
  state.toasts = state.toasts.filter((t) => t.timer > 0);
}

function updateCamera(state, dt) {
  const p = state.player;
  const targetZoom = p.inCar ? 0.82 : 1.0;
  state.camera.zoom += (targetZoom - state.camera.zoom) * Math.min(1, dt * 2);
  const tx = p.x;
  const ty = p.y;
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  // Keep the camera inside the world.
  const halfW = state.view.w / 2 / state.camera.zoom;
  const halfH = state.view.h / 2 / state.camera.zoom;
  state.camera.x = Math.max(halfW * 0.4, Math.min(2400 - halfW * 0.4, state.camera.x));
  state.camera.y = Math.max(halfH * 0.4, Math.min(1800 - halfH * 0.4, state.camera.y));
}

function frame(state, ctx, input, dt) {
  state.time += dt;
  const p = state.player;

  if (state.screen === 'play') {
    updateEntities(state, dt, input);
    updateMissions(state, dt);
    drainEvents(state);
    updateCamera(state, dt);
    // Siren while a patrol car is near; engine hum while driving.
    let nearCop = false;
    for (const car of state.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 600) nearCop = true;
    }
    setSiren(nearCop);
    setEngine(p.inCar ? Math.abs(p.inCar.speed) / 430 : 0);
    // Autosave every few seconds.
    state.saveTimer += dt;
    if (state.saveTimer > 5) {
      state.saveTimer = 0;
      writeSave(state);
    }
    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      state.screen = 'paused';
    }
  } else if (state.screen === 'title') {
    if (input.wasPressed('Enter')) {
      ensureAudio();
      startMusic();
      if (state.hasSave) continueRun(state);
      else newRun(state);
    } else if (input.wasPressed('n')) {
      ensureAudio();
      startMusic();
      newRun(state);
    }
  } else if (state.screen === 'busted' || state.screen === 'wasted') {
    if (input.wasPressed('Enter')) respawn(state);
  } else if (state.screen === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
      state.screen = 'play';
    }
  }

  if (input.wasPressed('m')) toggleMute();
  if (input.wasPressed('r') && state.screen === 'play') {
    newRun(state);
  }
  input.endFrame();
  render(ctx, state);
}

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const { shot, seed } = readShotParams();
  const state = makeState(seed);
  const input = makeInput();
  applySave(state, loadSave());

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.view.w = canvas.width;
    state.view.h = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  // A debug handle for playtests: window.__neonShores exposes the live
  // state (player, mission, wanted level) without changing the game.
  window.__neonShores = state;

  // Screenshot mode: stage one frozen scene and paint exactly one frame.
  if (shot) {
    state.shot = shot;
    stageShot(state, shot);
    clampShotCamera(state);
    state.time = 1.2; // fixed light so every shot matches
    render(ctx, state);
    document.title = `Neon Shores — shot ${shot}`;
    return;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(state, ctx, input, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
