// Neon Shores — the city itself.
//
// A fixed grid of avenues with buildings in the blocks between them, a
// park in the middle, and a beach with open water along the south edge.
// Everything is generated from a seeded rng, so the same seed builds the
// same city every time.
//
// Coordinates: x grows east, y grows south. Roads are centred on the
// avenue lines; buildings sit inside the blocks between them.

import { WORLD } from './config.js';
import { makeRng, range, rangeInt, pick } from './random.js';

const PALETTES = [
  ['#f2b8c6', '#f7d08a', '#a8d8c8', '#c3b2e0', '#f6e27a'],
  ['#e8a0a8', '#eec27a', '#9ccbb8', '#b3a2d0', '#e6d26a'],
];

const BUILDING_NAMES = [
  'Hotel', 'Apartemen', 'Kantor', 'Toko', 'Kafe', 'Gudang', 'Studio', 'Mall',
];

// A building is a rect with a pastel face, a darker roof edge and a
// deterministic window grid, so the city reads as a place, not noise.
function makeBuilding(rng, x, y, w, h, palette) {
  const floors = Math.max(1, Math.round(h / 34));
  const windows = [];
  for (let f = 0; f < floors; f++) {
    const perFloor = Math.max(1, Math.floor(w / 26));
    for (let i = 0; i < perFloor; i++) {
      windows.push({
        x: x + 8 + i * 26,
        y: y + 8 + f * 34,
        lit: rng() < 0.35,
      });
    }
  }
  return {
    x, y, w, h,
    color: pick(rng, palette),
    roof: '#00000022',
    windows,
    name: pick(rng, BUILDING_NAMES),
  };
}

// Build the whole city from a seed. Returns roads, buildings, trees,
// parked-car spots, pickup spots and the main spawn points.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const palette = pick(rng, PALETTES);
  const roadsV = [];
  const roadsH = [];
  for (let x = WORLD.roadEvery / 2; x < WORLD.width; x += WORLD.roadEvery) {
    roadsV.push(x);
  }
  for (let y = WORLD.roadEvery / 2; y < WORLD.beachY; y += WORLD.roadEvery) {
    roadsH.push(y);
  }

  const buildings = [];
  const trees = [];
  const parkSpots = [];
  // One block in three is a park instead of buildings, so the city
  // breathes; the centre block is always the big park.
  for (let bi = 0; bi < roadsV.length - 1; bi++) {
    for (let bj = 0; bj < roadsH.length - 1; bj++) {
      const x0 = roadsV[bi] + WORLD.roadWidth / 2 + WORLD.sidewalk + 6;
      const y0 = roadsH[bj] + WORLD.roadWidth / 2 + WORLD.sidewalk + 6;
      const x1 = roadsV[bi + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 6;
      const y1 = roadsH[bj + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 6;
      const isCentre = bi === 3 && bj === 2;
      if (isCentre || rng() < 0.3) {
        const treeCount = isCentre ? 14 : 6;
        for (let t = 0; t < treeCount; t++) {
          trees.push({
            x: range(rng, x0 + 10, x1 - 10),
            y: range(rng, y0 + 10, y1 - 10),
            r: range(rng, 9, 15),
          });
        }
        parkSpots.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
        continue;
      }
      // Split a block into one or two buildings along its long side.
      if (x1 - x0 > y1 - y0) {
        const cut = range(rng, 0.35, 0.65);
        const mid = x0 + (x1 - x0) * cut;
        buildings.push(makeBuilding(rng, x0, y0, mid - x0 - 8, y1 - y0, palette));
        buildings.push(makeBuilding(rng, mid + 8, y0, x1 - mid - 8, y1 - y0, palette));
      } else {
        const cut = range(rng, 0.35, 0.65);
        const mid = y0 + (y1 - y0) * cut;
        buildings.push(makeBuilding(rng, x0, y0, x1 - x0, mid - y0 - 8, palette));
        buildings.push(makeBuilding(rng, x0, mid + 8, x1 - x0, y1 - mid - 8, palette));
      }
    }
  }

  // Parked cars hug the kerb on random avenues.
  const parkedSpots = [];
  for (let i = 0; i < 22; i++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const x = pick(rng, roadsV) + (rng() < 0.5 ? -26 : 26);
      parkedSpots.push({ x, y: range(rng, 100, WORLD.beachY - 100), angle: Math.PI / 2 });
    } else {
      const y = pick(rng, roadsH) + (rng() < 0.5 ? -26 : 26);
      parkedSpots.push({ x: range(rng, 100, WORLD.width - 100), y, angle: 0 });
    }
  }

  // Named places the missions point at.
  const places = {
    motel: { x: roadsV[1], y: roadsH[0] + 90, label: 'Motel Palma' },
    club: { x: roadsV[5], y: roadsH[3] - 90, label: 'Klub Neon' },
    marina: { x: roadsV[6], y: WORLD.beachY - 60, label: 'Marina' },
    garage: { x: roadsV[2], y: roadsH[4] + 90, label: 'Bengkel Jo' },
    hospital: { x: roadsV[0], y: roadsH[1] - 90, label: 'Rumah Sakit' },
    boat: { x: roadsV[6] + 40, y: WORLD.beachY + 40, label: 'Perahu' },
  };

  return {
    seed,
    roadsV,
    roadsH,
    buildings,
    trees,
    parkSpots,
    parkedSpots,
    places,
    spawn: { x: roadsV[3], y: roadsH[2], angle: 0 },
  };
}

// Is a point on a road (within the asphalt, kerb included)?
export function isOnRoad(city, x, y) {
  const half = WORLD.roadWidth / 2 + WORLD.sidewalk;
  if (y > WORLD.beachY) return false;
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// Snap a point to the nearest avenue centre line.
export function nearestRoadPoint(city, x, y) {
  let bestX = city.roadsV[0];
  let bestY = city.roadsH[0];
  for (const rx of city.roadsV) {
    if (Math.abs(rx - x) < Math.abs(bestX - x)) bestX = rx;
  }
  for (const ry of city.roadsH) {
    if (Math.abs(ry - y) < Math.abs(bestY - y)) bestY = ry;
  }
  return { x: bestX, y: bestY };
}

// A random point on a road, for spawning traffic and pedestrians.
export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    return {
      x: pick(rng, city.roadsV) + range(rng, -14, 14),
      y: range(rng, 80, WORLD.beachY - 80),
      vertical: true,
    };
  }
  return {
    x: range(rng, 80, WORLD.width - 80),
    y: pick(rng, city.roadsH) + range(rng, -14, 14),
    vertical: false,
  };
}

// Does a circle overlap any building? Cars and people never walk through walls.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return b;
    }
  }
  return null;
}
