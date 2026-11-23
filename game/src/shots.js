// Neon Shores — deterministic screenshot scenes.
//
// The game reads ?shot=<name>&seed=<n> from its URL. When a shot is
// named, the world is built from that seed, a staged scene is placed
// (title, driving with heat, a police chase, a mission in progress) and
// the loop renders exactly one frozen frame. The same URL always paints
// the same pixels, so the screenshots in screenshots/ are reproducible.
//
// Shot list (also the order they are filed under screenshots/):
//   1-start.jpg  — the title screen over the city at golden hour
//   2-drive.jpg  — driving the red sports car, 2 stars, mission on the HUD
//   3-chase.jpg  — on foot at the marina, 4 stars, patrol cars closing in
//   4-mission.jpg — delivering the package at the motel, cash on the ground

import { makeRng } from './random.js';

// Read the shot name and seed out of the page URL, if any.
export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '1', 10) || 1,
  };
}

// Stage one of the four scenes into a fresh state. Called once, before
// the first frame, only when ?shot= is present.
export function stageShot(state, name) {
  const city = state.city;
  const p = state.player;
  const rng = makeRng(state.seed + 7);

  if (name === 'start') {
    state.screen = 'title';
    state.camera.x = city.spawn.x;
    state.camera.y = city.spawn.y;
    return;
  }

  state.screen = 'play';
  if (name === 'drive') {
    // Behind the wheel of the red sports car on the main avenue, two
    // stars on the HUD, a patrol car in the mirror, mission live.
    const car = state.cars.find((c) => c.kind === 'parked') || state.cars[0];
    car.kind = 'player';
    car.color = '#e74c3c';
    car.x = city.roadsV[3];
    car.y = city.roadsH[2] + 200;
    car.angle = Math.PI / 2;
    car.speed = 260;
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.wanted = 2;
    p.cash = 1240;
    p.ammo = 48;
    state.mission.target = { x: city.places.marina.x, y: city.places.marina.y, label: 'Deliver to the Marina' };
    state.mission.message = 'Mama Rosa: Package secured. Now get it to the Marina.';
    state.mission.messageTimer = 99;
    const cop = state.cars.find((c) => c.kind === 'police') || null;
    if (cop) {
      cop.x = car.x - 30;
      cop.y = car.y - 260;
      cop.angle = Math.PI / 2;
    } else {
      state.cars.push({
        x: car.x - 30, y: car.y - 260, angle: Math.PI / 2, speed: 300,
        color: '#2d3436', kind: 'police', parked: false, driver: null,
        vertical: true, dir: 1, targetSpeed: 300, w: 36, h: 19, hp: 100,
      });
    }
    state.camera.x = car.x;
    state.camera.y = car.y - 40;
    return;
  }

  if (name === 'chase') {
    // On foot at the marina with four stars: three patrol cars converge
    // while pedestrians flee across the sand.
    p.x = city.places.marina.x;
    p.y = city.places.marina.y - 140;
    p.wanted = 4;
    p.health = 62;
    p.cash = 860;
    p.ammo = 12;
    state.mission.target = { x: city.places.boat.x, y: city.places.boat.y, label: 'Reach the boat!' };
    state.mission.message = 'Mama Rosa: All three bags. Now get to the boat and disappear.';
    state.mission.messageTimer = 99;
    const spots = [
      { x: p.x - 220, y: p.y - 160, a: Math.PI * 0.75 },
      { x: p.x + 240, y: p.y - 120, a: Math.PI * 1.25 },
      { x: p.x + 60, y: p.y - 300, a: Math.PI / 2 },
    ];
    for (const s of spots) {
      state.cars.push({
        x: s.x, y: s.y, angle: s.a, speed: 320,
        color: '#2d3436', kind: 'police', parked: false, driver: null,
        vertical: false, dir: 1, targetSpeed: 320, w: 36, h: 19, hp: 100,
      });
    }
    for (const ped of state.peds.slice(0, 5)) {
      ped.x = p.x + (rng() - 0.5) * 300;
      ped.y = p.y + (rng() - 0.5) * 200;
      ped.fleeing = true;
      ped.fleeX = p.x;
      ped.fleeY = p.y;
    }
    state.camera.x = p.x;
    state.camera.y = p.y;
    return;
  }

  if (name === 'mission') {
    // The errand's delivery: on foot at the Motel Palma, package in
    // hand, cash glittering on the pavement, first job on the HUD.
    p.x = city.places.motel.x;
    p.y = city.places.motel.y + 30;
    p.wanted = 0;
    p.cash = 210;
    state.mission.target = { x: city.places.marina.x, y: city.places.marina.y, label: 'Deliver to the Marina' };
    state.mission.message = 'Mama Rosa: Pick up the package at the Motel Palma, then deliver it to the Marina.';
    state.mission.messageTimer = 99;
    state.pickups.push(
      { x: p.x - 60, y: p.y + 40, kind: 'cash', amount: 40, bob: 0 },
      { x: p.x + 70, y: p.y + 60, kind: 'cash', amount: 25, bob: 2 },
      { x: p.x + 30, y: p.y - 50, kind: 'health', amount: 0, bob: 4 },
    );
    state.camera.x = p.x;
    state.camera.y = p.y;
    return;
  }

  // Unknown shot name: just play from the spawn.
  state.screen = 'play';
  state.camera.x = p.x;
  state.camera.y = p.y;
}

// Keep the shot camera inside the world so no void shows at the edges.
export function clampShotCamera(state) {
  const cam = state.camera;
  cam.x = Math.max(640, Math.min(2400 - 640, cam.x));
  cam.y = Math.max(360, Math.min(1800 - 360, cam.y));
}
