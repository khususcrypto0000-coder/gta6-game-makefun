// Neon Shores — keyboard and mouse state.
//
// One object owns every key the game reads, plus the mouse position in
// screen space and a queue of keys pressed this frame (so a single tap
// of E or Enter is never missed between frames).

export function makeInput() {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    // Keep the page from scrolling on game keys.
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
  }

  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onMouseDown(e) {
    mouse.down = true;
    mouse.clicked = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    pressed,
    mouse,
    // Movement vector from WASD or arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys['a'] || keys['ArrowLeft']) x -= 1;
      if (keys['d'] || keys['ArrowRight']) x += 1;
      if (keys['w'] || keys['ArrowUp']) y -= 1;
      if (keys['s'] || keys['ArrowDown']) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sprint() {
      return !!(keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']);
    },
    // Was this key tapped since the last frame? Cleared by endFrame().
    wasPressed(key) {
      return !!pressed[key];
    },
    // Driving controls: throttle forward/back and steering left/right,
    // as -1..1 values the car physics reads directly.
    driveVector() {
      let throttle = 0;
      let steer = 0;
      if (keys['w'] || keys['ArrowUp']) throttle += 1;
      if (keys['s'] || keys['ArrowDown']) throttle -= 1;
      if (keys['a'] || keys['ArrowLeft']) steer -= 1;
      if (keys['d'] || keys['ArrowRight']) steer += 1;
      return {
        throttle,
        steer,
        brake: !!(keys[' '] || keys['Spacebar']),
      };
    },
    // True when any game key is held, for waking the title screen.
    anyKey() {
      return Object.values(keys).some(Boolean);
    },
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
      mouse.clicked = false;
    },
  };
}
