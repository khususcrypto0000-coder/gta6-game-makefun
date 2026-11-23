// Neon Shores — missions and side jobs.
//
// Five story jobs from Mama Rosa, the fixer who runs Neon Shores from
// the back of the Motel Palma, plus endless taxi fares for free-roam
// cash. A mission is a small state machine: a target, a timer, a
// payout, and a line of dialogue when it starts and ends.

import { sfx } from './audio.js';
import { dist, dropCash } from './entities.js';

export const MISSIONS = [
  {
    id: 'errand',
    title: 'First Errand',
    giver: 'Mama Rosa',
    brief: 'Pick up the package at the Motel Palma, then deliver it to the Marina. No questions.',
    reward: 150,
  },
  {
    id: 'wheelman',
    title: 'Wheelman',
    giver: 'Mama Rosa',
    brief: 'A singer waits at Klub Neon. Pick her up and get her to the Marina in 90 seconds.',
    reward: 250,
    timeLimit: 90,
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Mama Rosa',
    brief: 'A red sports car is parked by the park. Steal it and bring it to Bengkel Jo.',
    reward: 400,
  },
  {
    id: 'heatwave',
    title: 'Heat Wave',
    giver: 'Mama Rosa',
    brief: 'The cops are coming for you either way. Survive 60 seconds at 3 stars.',
    reward: 500,
    timeLimit: 60,
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    giver: 'Mama Rosa',
    brief: 'Three bags of cash are stashed around the city. Grab them all, then reach the boat.',
    reward: 1000,
  },
];

export function makeMissionState() {
  return {
    index: 0, // which story mission is active; MISSIONS.length means done
    stage: 'pickup', // 'pickup' | 'deliver' | 'survive' | 'collect'
    target: null, // {x, y, label}
    timer: 0,
    collected: 0,
    needed: 0,
    fare: null, // active taxi fare, or null
    fareTimer: 0,
    done: false,
    message: '',
    messageTimer: 0,
  };
}

function setTarget(state, x, y, label) {
  state.mission.target = { x, y, label };
}

function say(state, text, seconds) {
  state.mission.message = text;
  state.mission.messageTimer = seconds || 4;
}

// Start (or restart) the current story mission.
export function startMission(state) {
  const m = state.mission;
  const mission = MISSIONS[m.index];
  if (!mission) {
    m.done = true;
    return;
  }
  const city = state.city;
  m.stage = 'pickup';
  m.timer = mission.timeLimit || 0;
  m.collected = 0;
  m.needed = 0;
  if (mission.id === 'errand') {
    setTarget(state, city.places.motel.x, city.places.motel.y, 'Pick up the package');
  } else if (mission.id === 'wheelman') {
    setTarget(state, city.places.club.x, city.places.club.y, 'Pick up the singer');
  } else if (mission.id === 'hotwheels') {
    setTarget(state, city.parkSpots[0].x, city.parkSpots[0].y, 'Steal the red sports car');
    spawnHotCar(state);
  } else if (mission.id === 'heatwave') {
    state.player.wanted = Math.max(state.player.wanted, 3);
    setTarget(state, state.player.x, state.player.y, 'Survive the heat!');
    m.stage = 'survive';
  } else if (mission.id === 'bigscore') {
    m.needed = 3;
    m.stage = 'collect';
    const spots = city.parkSpots.slice(0, 3);
    for (const spot of spots) {
      dropCash(state, spot.x, spot.y, 100);
      // Tag the bag so collecting it counts toward the score.
      state.pickups[state.pickups.length - 1].bag = true;
    }
    setTarget(state, spots[0].x, spots[0].y, 'Grab the cash bags (0/3)');
  }
  say(state, `${mission.giver}: ${mission.brief}`, 6);
  sfx.mission();
}

// The red sports car for Hot Wheels: parked by the park, worth stealing.
function spawnHotCar(state) {
  const spot = state.city.parkSpots[0];
  state.cars.push({
    x: spot.x + 30, y: spot.y, angle: 0, speed: 0,
    color: '#e74c3c', kind: 'parked', parked: true, driver: null,
    vertical: false, dir: 1, targetSpeed: 0, w: 36, h: 19, hp: 100,
    hot: true,
  });
}

function completeMission(state) {
  const m = state.mission;
  const mission = MISSIONS[m.index];
  state.player.cash += mission.reward;
  say(state, `Job done! ${mission.title} paid $${mission.reward}.`, 5);
  sfx.mission();
  m.index += 1;
  m.target = null;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    say(state, 'King of Neon Shores! You finished every job Mama Rosa had.', 8);
    state.events.push('story-complete');
  } else {
    startMission(state);
  }
}

function failMission(state, reason) {
  say(state, `${reason} Job failed — Mama Rosa is giving you another shot.`, 5);
  sfx.fail();
  startMission(state);
}

export function updateMissions(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (m.messageTimer > 0) m.messageTimer -= dt;
  if (m.done) {
    updateFare(state, dt);
    return;
  }
  const mission = MISSIONS[m.index];
  if (!mission) return;

  if (m.timer > 0) {
    m.timer -= dt;
    // Heat Wave is the exception: its timer running out means survival,
    // so the survive branch below completes it instead of failing.
    if (m.timer <= 0 && m.stage !== 'survive') {
      failMission(state, 'Too slow.');
      return;
    }
  }

  const t = m.target;
  if (m.stage === 'survive') {
    // Heat Wave: the timer is the mission; keep the heat on.
    p.wanted = Math.max(p.wanted, 3);
    if (m.timer <= 0) completeMission(state);
    return;
  }

  if (!t) return;
  const near = dist(p.x, p.y, t.x, t.y) < 55;

  if (mission.id === 'errand') {
    if (m.stage === 'pickup' && near) {
      m.stage = 'deliver';
      setTarget(state, state.city.places.marina.x, state.city.places.marina.y, 'Deliver to the Marina');
      say(state, 'Package secured. Now get it to the Marina.', 4);
      sfx.pickup();
    } else if (m.stage === 'deliver' && near) {
      completeMission(state);
    }
  } else if (mission.id === 'wheelman') {
    if (m.stage === 'pickup' && near) {
      m.stage = 'deliver';
      setTarget(state, state.city.places.marina.x, state.city.places.marina.y, 'Drop the singer at the Marina');
      say(state, 'She is in the car. Drive — and do not be late.', 4);
      sfx.pickup();
    } else if (m.stage === 'deliver' && near) {
      completeMission(state);
    }
  } else if (mission.id === 'hotwheels') {
    const hot = state.cars.find((c) => c.hot);
    if (m.stage === 'pickup') {
      if (p.inCar && p.inCar.hot) {
        m.stage = 'deliver';
        setTarget(state, state.city.places.garage.x, state.city.places.garage.y, 'Deliver the car to Bengkel Jo');
        say(state, 'Nice ride. Now lose the heat and bring it to Jo.', 4);
        sfx.pickup();
      } else if (!hot && !p.inCar) {
        // The car was destroyed: give Mama Rosa's wrath a pass and retry.
        failMission(state, 'The car is scrap.');
      }
    } else if (m.stage === 'deliver' && near && p.inCar && p.inCar.hot) {
      p.inCar.hot = false;
      completeMission(state);
    }
  } else if (mission.id === 'bigscore') {
    // Bags are cash pickups tagged bag: true; collecting one advances us.
    const bags = state.pickups.filter((pk) => pk.bag);
    m.collected = m.needed - bags.length;
    if (m.target) {
      m.target.label = `Grab the cash bags (${m.collected}/${m.needed})`;
    }
    if (bags.length === 0) {
      m.stage = 'deliver';
      setTarget(state, state.city.places.boat.x, state.city.places.boat.y, 'Reach the boat!');
      say(state, 'All three bags. Now get to the boat and disappear.', 4);
      sfx.pickup();
    }
    if (m.stage === 'deliver' && near) completeMission(state);
  }

  updateFare(state, dt);
}

// Taxi fares: a pedestrian flags you down; drop them off for cash.
export function updateFare(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (!m.fare) {
    // A fare appears every so often while free-roaming.
    if (Math.random() < dt * 0.02 && state.peds.length > 0) {
      const ped = state.peds[Math.floor(Math.random() * state.peds.length)];
      if (dist(p.x, p.y, ped.x, ped.y) < 500) {
        const dest = state.city.parkSpots[Math.floor(Math.random() * state.city.parkSpots.length)];
        m.fare = { ped, dest, pay: 50 + Math.floor(Math.random() * 80) };
        m.fareTimer = 75;
        say(state, `Fare! Pick up the passenger and drop them at the park ($${m.fare.pay}).`, 4);
      }
    }
    return;
  }
  m.fareTimer -= dt;
  if (m.fareTimer <= 0) {
    say(state, 'The fare got tired of waiting and walked off.', 3);
    m.fare = null;
    return;
  }
  const fare = m.fare;
  if (!fare.pickedUp && dist(p.x, p.y, fare.ped.x, fare.ped.y) < 40) {
    fare.pickedUp = true;
    say(state, `Passenger aboard. Drop them at the park ($${fare.pay}).`, 4);
    sfx.pickup();
  } else if (fare.pickedUp && dist(p.x, p.y, fare.dest.x, fare.dest.y) < 60) {
    p.cash += fare.pay;
    say(state, `Fare complete! +$${fare.pay}.`, 4);
    sfx.cash();
    m.fare = null;
  }
}
