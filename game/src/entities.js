// Neon Shores — everything that moves in the city.
//
// The player (on foot or behind the wheel), traffic, parked cars, police
// patrols, pedestrians, bullets, pickups and particles. Each update step
// takes the shared state, a time step, the input and the city, and moves
// the world one frame forward. No drawing happens here; render.js reads
// the same state and paints it.

import { WORLD, PLAYER, CAR, TRAFFIC, PEDS, POLICE, WANTED } from './config.js';
import { isOnRoad, hitsBuilding, randomRoadPoint } from './world.js';
import { range, rangeInt, pick } from './random.js';
import { sfx } from './audio.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];
const PED_COLORS = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe', '#fd79a8', '#00cec9', '#ffeaa7'];
const POLICE_COLOR = '#2d3436';

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Circle vs axis-aligned rect overlap, for feet and fists vs buildings.
function circleHitsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return dist(x, y, cx, cy) < r;
}

// --- The player -------------------------------------------------------

export function makePlayer(city) {
  return {
    x: city.spawn.x,
    y: city.spawn.y,
    angle: 0,
    health: PLAYER.health,
    cash: 50,
    ammo: 24,
    inCar: null,
    speed: 0,
    punchCd: 0,
    shootCd: 0,
    bust: 0,
    wanted: 0,
    wantedTimer: 0,
    unseenTimer: 0,
  };
}

function moveWithWalls(city, e, nx, ny, r) {
  // Slide along walls: try x then y separately so corners don't stick.
  if (!hitsBuilding(city, nx, e.y, r)) e.x = nx;
  if (!hitsBuilding(city, e.x, ny, r)) e.y = ny;
  e.x = clamp(e.x, 20, WORLD.width - 20);
  e.y = clamp(e.y, 20, WORLD.height - 20);
}

export function updatePlayer(state, dt, input) {
  const p = state.player;
  const city = state.city;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);

  if (p.inCar) {
    updateDrivenCar(state, dt, input);
    return;
  }

  const mv = input.moveVector();
  const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const nx = p.x + mv.x * speed * dt;
  const ny = p.y + mv.y * speed * dt;
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(mv.y, mv.x);
    moveWithWalls(city, p, nx, ny, PLAYER.radius);
  }
  p.speed = (mv.x !== 0 || mv.y !== 0) ? speed : 0;

  // Step into a car with E; punch with F; shoot toward the mouse with click.
  if (input.wasPressed('e')) tryEnterCar(state);
  if (input.wasPressed('f')) punch(state);
  if (input.mouse.clicked && p.ammo > 0) shoot(state, input);

  // Slowly recover health when the heat is off.
  if (p.wanted === 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function tryEnterCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, 46);
  if (!car) return;
  p.inCar = car;
  car.kind = 'player';
  car.driver = p;
  car.speed = 0;
  if (car.parked) {
    car.parked = false;
    addWanted(state, WANTED.stealCar);
    sfx.steal();
  }
}

function punch(state) {
  const p = state.player;
  if (p.punchCd > 0) return;
  p.punchCd = PLAYER.punchCooldown;
  sfx.punch();
  const px = p.x + Math.cos(p.angle) * (PLAYER.radius + 14);
  const py = p.y + Math.sin(p.angle) * (PLAYER.radius + 14);
  for (const ped of state.peds) {
    if (dist(px, py, ped.x, ped.y) < PLAYER.punchRange) {
      ped.health -= PLAYER.punchDamage;
      ped.fleeing = true;
      ped.fleeX = p.x;
      ped.fleeY = p.y;
      addWanted(state, WANTED.hitPed);
      spawnParticles(state, ped.x, ped.y, '#ffeaa7', 6);
      if (ped.health <= 0) {
        ped.dead = true;
        addWanted(state, WANTED.killPed - WANTED.hitPed);
        dropCash(state, ped.x, ped.y, rangeInt(state.rng, 10, 40));
      }
    }
  }
  for (const car of state.cars) {
    if (car.kind === 'police' && dist(px, py, car.x, car.y) < 40) {
      addWanted(state, WANTED.hitPed);
    }
  }
}

function shoot(state, input) {
  const p = state.player;
  if (p.shootCd > 0) return;
  p.shootCd = 0.22;
  p.ammo -= 1;
  sfx.shoot();
  const cam = state.camera;
  const wx = cam.x + (input.mouse.x - state.view.w / 2) / cam.zoom;
  const wy = cam.y + (input.mouse.y - state.view.h / 2) / cam.zoom;
  const a = Math.atan2(wy - p.y, wx - p.x);
  state.bullets.push({
    x: p.x + Math.cos(a) * 18,
    y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 720,
    vy: Math.sin(a) * 720,
    life: 0.6,
    from: 'player',
    damage: 34,
  });
  p.angle = a;
  addWanted(state, 0); // firing alone draws eyes; the hit adds the star
  spawnParticles(state, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#fdcb6e', 3);
}

// --- Cars ---------------------------------------------------------------

export function makeCar(x, y, angle, kind, color) {
  return {
    x, y, angle,
    speed: 0,
    color: color || pick(Math.random, CAR_COLORS),
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    parked: kind === 'parked',
    driver: null,
    vertical: false,
    dir: 1,
    targetSpeed: 0,
    w: 36,
    h: 19,
    hp: 100,
  };
}

export function spawnTraffic(state) {
  const { city, rng } = state;
  for (let i = 0; i < TRAFFIC.count; i++) {
    const spot = randomRoadPoint(city, rng);
    const car = makeCar(spot.x, spot.y, spot.vertical ? Math.PI / 2 : 0, 'traffic');
    car.vertical = spot.vertical;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.targetSpeed = range(rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
  for (const spot of city.parkedSpots) {
    const car = makeCar(spot.x, spot.y, spot.angle, 'parked');
    state.cars.push(car);
  }
}

function updateDrivenCar(state, dt, input) {
  const p = state.player;
  const car = p.inCar;
  const dv = input.driveVector();
  // Forward is the car's nose; reversing flips the steering sense.
  const forward = dv.throttle >= 0 ? 1 : -1;
  if (dv.throttle !== 0) {
    const accel = dv.throttle > 0 ? CAR.accel : CAR.reverseAccel;
    car.speed += accel * dv.throttle * dt;
  } else if (dv.brake) {
    car.speed -= Math.sign(car.speed) * CAR.brake * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const speedRatio = Math.abs(car.speed) / CAR.maxSpeed;
  car.angle += dv.steer * forward * CAR.steer * speedRatio * dt * 1.6;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsBuilding(state.city, nx, ny, 16)) {
    car.x = nx;
    car.y = ny;
  } else {
    if (Math.abs(car.speed) > 120) {
      sfx.crash();
      spawnParticles(state, car.x, car.y, '#dfe6e9', 8);
      car.hp -= 12;
    }
    car.speed *= -0.25;
  }
  car.x = clamp(car.x, 24, WORLD.width - 24);
  car.y = clamp(car.y, 24, WORLD.height - 24);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);

  if (input.wasPressed('e')) {
    p.inCar = null;
    car.kind = 'parked';
    car.driver = null;
    car.speed = 0;
    // Step out beside the car so the player never stands inside it.
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  }
  if (input.mouse.clicked && p.ammo > 0) {
    // Drive-by: shoot from the window toward the mouse.
    p.shootCd = Math.max(0, p.shootCd - dt);
    if (p.shootCd <= 0) {
      p.shootCd = 0.25;
      p.ammo -= 1;
      sfx.shoot();
      const cam = state.camera;
      const wx = cam.x + (input.mouse.x - state.view.w / 2) / cam.zoom;
      const wy = cam.y + (input.mouse.y - state.view.h / 2) / cam.zoom;
      const a = Math.atan2(wy - p.y, wx - p.x);
      state.bullets.push({
        x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 720, vy: Math.sin(a) * 720,
        life: 0.6, from: 'player', damage: 34,
      });
    }
  }
  if (car.hp <= 0) {
    explodeCar(state, car);
    p.inCar = null;
    p.x = car.x + 40;
    p.y = car.y + 40;
  }
}

function explodeCar(state, car) {
  spawnParticles(state, car.x, car.y, '#ff7675', 26);
  spawnParticles(state, car.x, car.y, '#2d3436', 18);
  sfx.crash();
  state.cars.splice(state.cars.indexOf(car), 1);
  addWanted(state, 1);
}

export function updateTraffic(state, dt) {
  const { city, cars, rng } = state;
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    // Ease toward cruising speed; brake for the car ahead.
    let ahead = null;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = car.vertical ? dy * car.dir : dx * car.dir;
      const across = car.vertical ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < 70 && across < 26) ahead = other;
    }
    const want = ahead ? Math.min(car.targetSpeed, 40) : car.targetSpeed;
    car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the city edge so traffic never runs out.
    if (car.x < -60) car.x = WORLD.width + 50;
    if (car.x > WORLD.width + 60) car.x = -50;
    if (car.y < -60) car.y = WORLD.beachY + 50;
    if (car.y > WORLD.beachY + 60) car.y = -50;
    // A traffic car that clipped a building is pushed back onto its road.
    if (hitsBuilding(city, car.x, car.y, 14)) {
      const road = city.roadsV[Math.floor(rng() * city.roadsV.length)];
      car.x = road;
      car.y = range(rng, 100, WORLD.beachY - 100);
    }
  }
}

// --- Pedestrians ----------------------------------------------------------

export function spawnPeds(state) {
  const { city, rng } = state;
  for (let i = 0; i < PEDS.count; i++) {
    const spot = randomRoadPoint(city, rng);
    state.peds.push({
      x: spot.x + range(rng, -30, 30),
      y: spot.y + range(rng, -30, 30),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, PEDS.speedMin, PEDS.speedMax),
      color: pick(rng, PED_COLORS),
      health: 100,
      fleeing: false,
      fleeX: 0,
      fleeY: 0,
      tx: spot.x,
      ty: spot.y,
      dead: false,
    });
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    // Flee from gunfire, a speeding car, or a swinging fist.
    let threat = null;
    if (ped.fleeing) {
      threat = { x: ped.fleeX, y: ped.fleeY };
    } else if (p.inCar && Math.abs(p.speed) > 200 && dist(p.x, p.y, ped.x, ped.y) < 110) {
      threat = { x: p.x, y: p.y };
    } else if (!p.inCar && dist(p.x, p.y, ped.x, ped.y) < 60 && p.punchCd > 0.15) {
      threat = { x: p.x, y: p.y };
    }
    if (threat) {
      const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * PEDS.fleeSpeed * dt;
      const ny = ped.y + Math.sin(a) * PEDS.fleeSpeed * dt;
      moveWithWalls(state.city, ped, nx, ny, 10);
      if (dist(ped.x, ped.y, threat.x, threat.y) > 260) ped.fleeing = false;
      continue;
    }
    // Wander: pick a new kerb-side target when the old one is reached.
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 14) {
      const spot = randomRoadPoint(state.city, state.rng);
      ped.tx = spot.x;
      ped.ty = spot.y;
    }
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt;
    const ny = ped.y + Math.sin(a) * ped.speed * dt;
    moveWithWalls(state.city, ped, nx, ny, 10);
  }
  state.peds = state.peds.filter((ped) => !ped.dead);
}

// --- Police -----------------------------------------------------------------

function policeCountFor(wanted) {
  return Math.min(POLICE.maxCars, wanted);
}

export function updatePolice(state, dt) {
  const p = state.player;
  const wantedCars = state.cars.filter((c) => c.kind === 'police');
  const want = policeCountFor(p.wanted);
  // Spawn patrol cars at the city edge when the heat rises.
  if (wantedCars.length < want) {
    const edge = pick(state.rng, [
      { x: 60, y: p.y },
      { x: WORLD.width - 60, y: p.y },
      { x: p.x, y: 60 },
      { x: p.x, y: WORLD.beachY - 60 },
    ]);
    const car = makeCar(edge.x, edge.y, 0, 'police', POLICE_COLOR);
    car.speed = POLICE.chaseSpeed * 0.7;
    state.cars.push(car);
    sfx.horn();
  }
  // Stand down when the heat is gone.
  if (p.wanted === 0) {
    for (const car of wantedCars) {
      car.kind = 'traffic';
      car.targetSpeed = range(state.rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
    }
  }

  // The arrest meter fills once per frame, not once per patrol car:
  // otherwise the far-away cars' decay would cancel the near car's
  // arrest and a bust could never land.
  let nearOnFoot = false;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = dist(car.x, car.y, p.x, p.y);
    const a = Math.atan2(p.y - car.y, p.x - car.x);
    // Steer toward the player, ramming on contact. When the player is
    // on foot and a patrol car reaches them, it stops to make the
    // arrest instead of driving past, so the bust can actually land.
    let da = a - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += clamp(da, -2.4 * dt, 2.4 * dt);
    car.speed = POLICE.chaseSpeed * (0.75 + p.wanted * 0.05);
    if (!p.inCar && d < 50) car.speed = 0;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(state.city, nx, ny, 16)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.angle += Math.PI / 2;
    }
    if (d < 46) {
      if (p.inCar) {
        p.inCar.hp -= POLICE.ramDamage * dt * 3;
        car.speed *= 0.6;
        if (Math.abs(car.speed) > 60) sfx.crash();
      } else {
        nearOnFoot = true;
      }
    }
    // At three stars and up, patrol cars open fire.
    if (p.wanted >= POLICE.shootAtStars && d < 420 && Math.random() < dt * 1.4) {
      const spread = (Math.random() - 0.5) * 0.35;
      const ba = a + spread;
      state.bullets.push({
        x: car.x + Math.cos(ba) * 22, y: car.y + Math.sin(ba) * 22,
        vx: Math.cos(ba) * 620, vy: Math.sin(ba) * 620,
        life: 0.7, from: 'police', damage: 7,
      });
      sfx.shoot();
    }
  }
  // Arrest meter, once per frame: a patrol car holding the player on
  // foot fills it; it drains when no car is close.
  if (!p.inCar) {
    if (nearOnFoot) {
      p.bust += dt / POLICE.bustTime;
      if (p.bust >= 1) {
        state.events.push('busted');
        p.bust = 0;
      }
    } else if (p.bust > 0) {
      p.bust = Math.max(0, p.bust - dt * 0.5);
    }
  }
}

// --- Wanted level -------------------------------------------------------------

export function addWanted(state, stars) {
  const p = state.player;
  p.wanted = Math.min(WANTED.max, p.wanted + stars);
  p.unseenTimer = 0;
}

export function updateWanted(state, dt) {
  const p = state.player;
  if (p.wanted === 0) return;
  // Is any patrol car close enough to keep eyes on the player?
  let seen = false;
  for (const car of state.cars) {
    if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 520) seen = true;
  }
  if (seen) {
    p.unseenTimer = 0;
  } else {
    p.unseenTimer += dt;
    if (p.unseenTimer >= WANTED.decaySeconds) {
      p.wanted -= 1;
      p.unseenTimer = 0;
    }
  }
}

// --- Bullets, pickups, particles --------------------------------------------

export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.from === 'player') {
      for (const ped of state.peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.health -= b.damage;
          ped.fleeing = true;
          ped.fleeX = p.x;
          ped.fleeY = p.y;
          b.life = 0;
          addWanted(state, 1);
          spawnParticles(state, ped.x, ped.y, '#ff7675', 5);
          if (ped.health <= 0) {
            ped.dead = true;
            dropCash(state, ped.x, ped.y, rangeInt(state.rng, 10, 40));
          }
        }
      }
      for (const car of state.cars) {
        if (car.kind === 'police' && dist(b.x, b.y, car.x, car.y) < 22) {
          car.hp -= b.damage;
          b.life = 0;
          addWanted(state, 1);
          spawnParticles(state, b.x, b.y, '#fdcb6e', 4);
          if (car.hp <= 0) explodeCar(state, car);
        }
      }
    } else if (b.from === 'police') {
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 14) {
        p.health -= b.damage;
        b.life = 0;
        spawnParticles(state, p.x, p.y, '#ff7675', 4);
      } else if (p.inCar && dist(b.x, b.y, p.inCar.x, p.inCar.y) < 22) {
        p.inCar.hp -= b.damage;
        b.life = 0;
      }
    }
    if (hitsBuilding(state.city, b.x, b.y, 2)) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  if (p.health <= 0) {
    state.events.push('wasted');
    p.health = PLAYER.health;
  }
}

export function dropCash(state, x, y, amount) {
  state.pickups.push({ x, y, kind: 'cash', amount, bob: Math.random() * 6 });
}

export function spawnPickups(state) {
  const { city, rng } = state;
  for (let i = 0; i < 8; i++) {
    const spot = randomRoadPoint(city, rng);
    state.pickups.push({
      x: spot.x + range(rng, -40, 40),
      y: spot.y + range(rng, -40, 40),
      kind: i % 4 === 0 ? 'health' : i % 4 === 1 ? 'ammo' : 'cash',
      amount: i % 4 === 2 ? rangeInt(rng, 20, 80) : 0,
      bob: rng() * 6,
    });
  }
}

export function updatePickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.bob += dt * 3;
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        sfx.cash();
        state.events.push(`+$${pk.amount}`);
      } else if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
        sfx.pickup();
        state.events.push('+40 HP');
      } else if (pk.kind === 'ammo') {
        p.ammo += 24;
        sfx.pickup();
        state.events.push('+24 ammo');
      }
      spawnParticles(state, pk.x, pk.y, '#55efc4', 8);
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
}

export function spawnParticles(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

// One call moves the whole living city one frame.
export function updateEntities(state, dt, input) {
  updatePlayer(state, dt, input);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
}
