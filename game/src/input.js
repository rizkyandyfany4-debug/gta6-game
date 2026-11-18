// VICE HEAT: Neon Bay — keyboard and mouse input.
// One shared object the world reads every tick. Keys are held states;
// `interact` and `punch` are edge-triggered (true for exactly one tick
// after the key goes down). The mouse position is converted to world
// coordinates by main.js, which knows the camera.

export function createInput() {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    fire: false,
    interact: false,
    punch: false,
    enter: false,
    aimX: undefined,
    aimY: undefined,
    mouseDown: false,
  };

  const KEYMAP = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyF: 'fire',
  };

  function onKeyDown(e) {
    const mapped = KEYMAP[e.code];
    if (mapped) {
      input[mapped] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
    if (e.code === 'KeyE' && !e.repeat) input.interact = true;
    if (e.code === 'Space' && !e.repeat) {
      input.punch = true;
      e.preventDefault();
    }
    if (e.code === 'Enter' && !e.repeat) input.enter = true;
  }

  function onKeyUp(e) {
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      input.mouseDown = true;
      input.fire = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) {
      input.mouseDown = false;
      input.fire = false;
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  }

  // Called after each world tick: edge triggers live for one tick only.
  function endTick() {
    input.interact = false;
    input.punch = false;
    input.enter = false;
  }

  return { input, attach, detach, endTick };
}
