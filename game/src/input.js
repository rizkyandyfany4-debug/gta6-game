// Keyboard + mouse input. Tracks held keys and edge-triggered presses so the game
// can tell "just pressed E" from "holding E". Also exposes the pointer position
// (used for aiming on foot) in canvas coordinates.
export const ACTION = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  RUN: 'run',
  ENTER: 'enter',
  ATTACK: 'attack',
  SHOOT: 'shoot',
  PAUSE: 'pause',
  CONFIRM: 'confirm',
  MUTE: 'mute',
  HORN: 'horn',
};

const KEYMAP = {
  KeyW: ACTION.UP, ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN, ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT, ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT, ArrowRight: ACTION.RIGHT,
  ShiftLeft: ACTION.RUN, ShiftRight: ACTION.RUN,
  KeyE: ACTION.ENTER,
  Space: ACTION.ATTACK,
  KeyF: ACTION.SHOOT,
  KeyP: ACTION.PAUSE, Escape: ACTION.PAUSE,
  Enter: ACTION.CONFIRM,
  KeyM: ACTION.MUTE,
  KeyH: ACTION.HORN,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false };

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }
  function onMouseDown(event) {
    onMouseMove(event);
    if (!mouse.down) mouse.pressed = true;
    mouse.down = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    isDown(action) {
      return held.has(action);
    },
    wasPressed(action) {
      return pressed.has(action);
    },
    mousePressed() {
      return mouse.pressed;
    },
    /** Movement vector from the held keys, normalised. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has(ACTION.LEFT)) x -= 1;
      if (held.has(ACTION.RIGHT)) x += 1;
      if (held.has(ACTION.UP)) y -= 1;
      if (held.has(ACTION.DOWN)) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Call at the end of every frame: edges live for exactly one step. */
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
