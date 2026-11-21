// Keyboard and mouse input: WASD/arrows to move, Shift to run, C to crouch,
// Enter/Space to confirm, R to restart a level, M to mute. Mouse click also
// confirms on menus. One job: turn raw events into a plain keys object.
export function makeKeys() {
  return {
    up: false, down: false, left: false, right: false,
    run: false, crouch: false, confirm: false, restart: false, mute: false,
  };
}

/** Attach listeners; returns a function that detaches them. */
export function attachInput(keys, onConfirm, onAnyKey) {
  const down = (event) => {
    if (onAnyKey) onAnyKey();
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': keys.up = true; event.preventDefault(); break;
      case 'ArrowDown': case 'KeyS': keys.down = true; event.preventDefault(); break;
      case 'ArrowLeft': case 'KeyA': keys.left = true; event.preventDefault(); break;
      case 'ArrowRight': case 'KeyD': keys.right = true; event.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': keys.run = true; break;
      case 'KeyC': case 'ControlLeft': keys.crouch = true; break;
      case 'Enter': case 'Space':
        keys.confirm = true;
        if (onConfirm) onConfirm();
        event.preventDefault();
        break;
      case 'KeyR': keys.restart = true; break;
      case 'KeyM': keys.mute = true; break;
      default: break;
    }
  };
  const up = (event) => {
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': keys.up = false; break;
      case 'ArrowDown': case 'KeyS': keys.down = false; break;
      case 'ArrowLeft': case 'KeyA': keys.left = false; break;
      case 'ArrowRight': case 'KeyD': keys.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': keys.run = false; break;
      case 'KeyC': case 'ControlLeft': keys.crouch = false; break;
      case 'Enter': case 'Space': keys.confirm = false; break;
      case 'KeyR': keys.restart = false; break;
      case 'KeyM': keys.mute = false; break;
      default: break;
    }
  };
  const click = () => {
    if (onAnyKey) onAnyKey();
    if (onConfirm) onConfirm();
  };
  const blur = () => {
    keys.up = keys.down = keys.left = keys.right = false;
    keys.run = keys.crouch = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousedown', click);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('mousedown', click);
    window.removeEventListener('blur', blur);
  };
}
