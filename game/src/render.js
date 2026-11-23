// Neon Shores — everything the player sees.
//
// One canvas, painted in layers: ground and roads, then buildings and
// trees, then pickups, people and cars, then particles, then the HUD
// and minimap on top. The palette is sun-soaked: warm sand, teal water,
// pastel blocks, dark asphalt — a coastal city at golden hour.

import { WORLD } from './config.js';

const ROAD_COLOR = '#3a3a48';
const ROAD_EDGE = '#2c2c38';
const SIDEWALK_COLOR = '#c9c9d4';
const GRASS_COLOR = '#79c25f';
const PARK_COLOR = '#8fd07a';
const SAND_COLOR = '#f2d38b';
const WATER_COLOR = '#2fa8c9';
const WATER_DEEP = '#1d7fa8';

// Draw the ground: grass, then the beach and the sea along the south.
function drawGround(ctx, state, cam) {
  const { width, height, beachY, waterY } = WORLD;
  // The visible rectangle in world coordinates.
  const vw = state.view.w / cam.zoom;
  const vh = state.view.h / cam.zoom;
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);
  // Sand strip.
  ctx.fillStyle = SAND_COLOR;
  ctx.fillRect(0, beachY, width, waterY - beachY);
  // Water with a couple of drifting wave lines.
  ctx.fillStyle = WATER_COLOR;
  ctx.fillRect(0, waterY, width, height - waterY);
  ctx.strokeStyle = WATER_DEEP;
  ctx.lineWidth = 3;
  const t = state.time * 0.6;
  for (let i = 0; i < 5; i++) {
    const y = waterY + 18 + i * 16;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 60) {
      const yy = y + Math.sin(x * 0.01 + t + i) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // A wooden pier jutting into the water at the marina.
  const marina = state.city.places.marina;
  ctx.fillStyle = '#8a6d4b';
  ctx.fillRect(marina.x - 8, WORLD.beachY - 20, 16, 120);
  ctx.fillStyle = '#a67c52';
  ctx.fillRect(marina.x - 30, WORLD.beachY + 70, 60, 10);
}

// Roads: asphalt bands with pale kerbs and dashed centre lines.
function drawRoads(ctx, state) {
  const city = state.city;
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = SIDEWALK_COLOR;
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - half - WORLD.sidewalk, 0, WORLD.roadWidth + WORLD.sidewalk * 2, WORLD.beachY);
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(0, ry - half - WORLD.sidewalk, WORLD.width, WORLD.roadWidth + WORLD.sidewalk * 2);
  }
  ctx.fillStyle = ROAD_COLOR;
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - half, 0, WORLD.roadWidth, WORLD.beachY);
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(0, ry - half, WORLD.width, WORLD.roadWidth);
  }
  // Centre dashes.
  ctx.fillStyle = '#f5d76e';
  for (const rx of city.roadsV) {
    for (let y = 20; y < WORLD.beachY; y += 44) {
      ctx.fillRect(rx - 2, y, 4, 22);
    }
  }
  for (const ry of city.roadsH) {
    for (let x = 20; x < WORLD.width; x += 44) {
      ctx.fillRect(x, ry - 2, 22, 4);
    }
  }
  // Crosswalks at every junction.
  ctx.fillStyle = '#e8e8f0';
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 9 - 3, ry - half - 4, 6, 8);
      }
    }
  }
}

function drawParks(ctx, state) {
  const city = state.city;
  ctx.fillStyle = PARK_COLOR;
  for (const spot of city.parkSpots) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const tree of city.trees) {
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3cb371';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, state) {
  for (const b of state.city.buildings) {
    // Soft shadow, offset south-east as if the sun sits north-west.
    ctx.fillStyle = '#00000026';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillRect(b.x, b.y, 5, b.h);
    for (const w of b.windows) {
      ctx.fillStyle = w.lit ? '#ffe66d' : '#2c3e50';
      ctx.fillRect(w.x, w.y, 12, 16);
    }
  }
  // Named places get a small sign.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const place of Object.values(state.city.places)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(place.x - 44, place.y - 26, 88, 18);
    ctx.fillStyle = '#2d3436';
    ctx.fillText(place.label, place.x, place.y - 13);
  }
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    const bob = Math.sin(pk.bob) * 3;
    const y = pk.y + bob;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(pk.x - 10, y - 6, 20, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, y + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 10, y - 10, 20, 20);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(pk.x - 3, y - 8, 6, 16);
      ctx.fillRect(pk.x - 8, y - 3, 16, 6);
    } else {
      ctx.fillStyle = '#fdcb6e';
      ctx.fillRect(pk.x - 9, y - 7, 18, 14);
      ctx.fillStyle = '#2d3436';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', pk.x, y + 4);
    }
  }
}

function drawPerson(ctx, x, y, angle, color, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#00000030';
  ctx.beginPath();
  ctx.ellipse(0, 3, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#00000030';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  // Rounded body.
  ctx.beginPath();
  ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-4, -car.h / 2 + 3, 12, car.h - 6);
  ctx.fillStyle = '#dfe6e9';
  ctx.fillRect(car.w / 2 - 7, -car.h / 2 + 3, 4, car.h - 6);
  // Headlights.
  ctx.fillStyle = '#ffe66d';
  ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 2, 2, 4);
  ctx.fillRect(car.w / 2 - 2, car.h / 2 - 6, 2, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 2, 8, car.h - 4);
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(-2, -car.h / 2 + 1, 5, 5);
    ctx.fillStyle = '#d63031';
    ctx.fillRect(-2, car.h / 2 - 6, 5, 5);
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (car.hot) {
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOT', 0, -car.h / 2 - 6);
  }
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#fdcb6e';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Mission target: a pulsing beacon and a guide arrow at the screen edge.
function drawTarget(ctx, state, cam) {
  const t = state.mission.target;
  if (!t || state.screen !== 'play') return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe66d';
  ctx.beginPath();
  ctx.moveTo(t.x, t.y - 34);
  ctx.lineTo(t.x - 8, t.y - 20);
  ctx.lineTo(t.x + 8, t.y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Off-screen arrow pointing at the target.
  const viewW = state.view.w;
  const viewH = state.view.h;
  const sx = (t.x - cam.x) * cam.zoom + viewW / 2;
  const sy = (t.y - cam.y) * cam.zoom + viewH / 2;
  if (sx < 40 || sx > viewW - 40 || sy < 40 || sy > viewH - 40) {
    const cx = Math.max(50, Math.min(viewW - 50, sx));
    const cy = Math.max(50, Math.min(viewH - 50, sy));
    const a = Math.atan2(sy - viewH / 2, sx - viewW / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// The main frame: world in camera space, then screen-space HUD.
export function render(ctx, state) {
  const cam = state.camera;
  const view = state.view;
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  // Only paint what the camera can see; the world is big.
  drawGround(ctx, state, cam);
  drawRoads(ctx, state);
  drawParks(ctx, state);
  drawBuildings(ctx, state);
  drawPickups(ctx, state);
  for (const ped of state.peds) {
    if (!ped.dead) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 10);
  }
  for (const car of state.cars) drawCar(ctx, car);
  const p = state.player;
  if (!p.inCar) drawPerson(ctx, p.x, p.y, p.angle, '#e17055', 13);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  drawTarget(ctx, state, cam);
  ctx.restore();

  if (state.screen === 'play') {
    drawHUD(ctx, state);
    drawMinimap(ctx, state);
  } else if (state.screen === 'title') {
    drawTitle(ctx, state);
  } else if (state.screen === 'busted') {
    drawOverlay(ctx, state, 'BUSTED', 'The cops got you. -$' + Math.round(state.bustFine || 0), '#0984e3');
  } else if (state.screen === 'wasted') {
    drawOverlay(ctx, state, 'WASTED', 'You went down. The city keeps moving.', '#d63031');
  } else if (state.screen === 'paused') {
    drawOverlay(ctx, state, 'PAUSED', 'P resume · M mute · R restart', '#2d3436');
  }
  if (state.mission.done && state.screen === 'play') {
    drawStoryBanner(ctx, state);
  }
}

function drawHUD(ctx, state) {
  const p = state.player;
  const m = state.mission;
  ctx.textAlign = 'left';
  // Cash and health, top left.
  ctx.fillStyle = '#00000055';
  ctx.fillRect(12, 12, 210, 64);
  ctx.fillStyle = '#55efc4';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + Math.round(p.cash), 22, 38);
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(22, 48, 150, 10);
  ctx.fillStyle = p.health > 30 ? '#00b894' : '#d63031';
  ctx.fillRect(22, 48, 150 * (p.health / 100), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.round(p.health), 178, 57);
  // Wanted stars, top right.
  ctx.textAlign = 'right';
  ctx.font = '26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = p.wanted > 0 ? '#ffe66d' : '#ffffff88';
  ctx.fillText(stars, state.view.w - 16, 40);
  // Mission objective, top centre.
  ctx.textAlign = 'center';
  if (m.target && !m.done) {
    ctx.fillStyle = '#00000066';
    const label = m.target.label + (m.timer > 0 ? `  (${Math.ceil(m.timer)}s)` : '');
    ctx.fillRect(state.view.w / 2 - 190, 12, 380, 30);
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(label, state.view.w / 2, 32);
  }
  // Mama Rosa's message line.
  if (m.messageTimer > 0 && m.message) {
    ctx.fillStyle = '#00000088';
    ctx.fillRect(state.view.w / 2 - 260, state.view.h - 86, 520, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText(m.message, state.view.w / 2, state.view.h - 66);
  }
  // Toasts from recent events (pickups, fares).
  ctx.textAlign = 'left';
  let ty = state.view.h - 130;
  for (const toast of state.toasts) {
    ctx.globalAlpha = Math.min(1, toast.timer);
    ctx.fillStyle = '#55efc4';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(toast.text, 16, ty);
    ty -= 22;
  }
  ctx.globalAlpha = 1;
  // Speed and ammo, bottom right above the minimap.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  if (p.inCar) {
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', state.view.w - 16, state.view.h - 170);
  }
  ctx.fillText('Ammo ' + p.ammo, state.view.w - 16, state.view.h - 148);
  // Controls hint, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffffaa';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E enter car · F punch · Click shoot · Shift sprint · P pause · M mute', 16, state.view.h - 12);
}

function drawMinimap(ctx, state) {
  const w = 200;
  const h = 150;
  const x0 = state.view.w - w - 14;
  const y0 = state.view.h - h - 14;
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  ctx.fillStyle = '#00000088';
  ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
  ctx.fillStyle = '#1e272e';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#636e72';
  for (const rx of state.city.roadsV) ctx.fillRect(x0 + rx * sx - 1, y0, 2, h);
  for (const ry of state.city.roadsH) ctx.fillRect(x0, y0 + ry * sy, w, 2);
  ctx.fillStyle = '#2fa8c9';
  ctx.fillRect(x0, y0 + WORLD.waterY * sy, w, h - WORLD.waterY * sy);
  const p = state.player;
  if (state.mission.target) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(x0 + state.mission.target.x * sx, y0 + state.mission.target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of state.cars) {
    if (car.kind === 'police') {
      ctx.fillStyle = '#0984e3';
      ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
  }
  ctx.fillStyle = '#55efc4';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 5.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTitle(ctx, state) {
  const { w, h } = state.view;
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('NEON SHORES', w / 2, h / 2 - 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in the spirit of GTA 6', w / 2, h / 2 - 52);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#55efc4';
  ctx.fillText('Steal cars. Outrun the police. Finish Mama Rosa\'s five jobs.', w / 2, h / 2 - 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(state.hasSave ? 'ENTER — Continue  ·  N — New game' : 'ENTER — Start the story', w / 2, h / 2 + 30);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffffffaa';
  ctx.fillText('WASD move / drive · E enter or steal a car · F punch · Click to shoot · Shift sprint', w / 2, h / 2 + 62);
  ctx.fillText('P pause · M mute · R restart · Your progress saves automatically', w / 2, h / 2 + 84);
  if (state.best) {
    ctx.fillStyle = '#ffe66d';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Best so far: $${Math.round(state.best.cash)} · ${state.best.missions} jobs done`, w / 2, h / 2 + 116);
  }
}

function drawOverlay(ctx, state, big, small, color) {
  const { w, h } = state.view;
  ctx.fillStyle = '#00000099';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(big, w / 2, h / 2 - 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(small, w / 2, h / 2 + 30);
  ctx.fillStyle = '#ffffffaa';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER to keep playing', w / 2, h / 2 + 62);
}

function drawStoryBanner(ctx, state) {
  const { w } = state.view;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe66d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('★ KING OF NEON SHORES ★ — every job done. Free-roam and chase fares!', w / 2, 58);
}
