// Neon Shores — tuning and world constants.
//
// One file, one job: every number the rest of the game reads. Nothing
// here touches the canvas, the audio or the network; change a value here
// and the whole game retunes.

export const WORLD = {
  width: 2400,
  height: 1800,
  // Avenues run every 300 px; roads are 64 px wide with a 10 px sidewalk.
  roadEvery: 300,
  roadWidth: 64,
  sidewalk: 10,
  // South edge is the beach: sand, then open water.
  beachY: 1620,
  waterY: 1710,
};

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 235,
  radius: 13,
  health: 100,
  punchDamage: 34,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  accel: 340,
  reverseAccel: 220,
  maxSpeed: 430,
  maxReverse: 130,
  brake: 520,
  grip: 2.6,
  // How sharply a car turns, scaled by speed so slow turns feel tight
  // and fast turns feel loose.
  steer: 2.35,
  drag: 0.55,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 95,
  speedMax: 165,
};

export const PEDS = {
  count: 26,
  speedMin: 34,
  speedMax: 62,
  fleeSpeed: 130,
};

export const POLICE = {
  // One patrol car per wanted star, up to this cap.
  maxCars: 5,
  chaseSpeed: 395,
  ramDamage: 9,
  // Seconds a busted arrest takes once a patrol car pins the player.
  bustTime: 1.6,
  shootAtStars: 3,
};

export const WANTED = {
  max: 5,
  // Seconds out of every patrol car's sight before a star fades.
  decaySeconds: 22,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killPed: 2,
};

export const MONEY = {
  start: 50,
  bustLoss: 0.1,
  wastedLoss: 0.15,
};

export const SHOTS = {
  width: 1280,
  height: 720,
};
