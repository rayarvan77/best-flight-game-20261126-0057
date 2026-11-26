// Keyboard and mouse input. Held keys give the stick (pitch, roll, throttle,
// rudder); one-shot presses (start, pause, camera, mute, restart) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse is a second stick: where the
// pointer sits relative to the centre of the screen banks and pitches the
// plane, and it fades out a second after the pointer stops moving.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const PITCH_KEYS = { ArrowUp: -1, ArrowDown: 1, KeyW: 0, KeyS: 0 };
const THROTTLE_KEYS = { KeyW: 1, KeyS: -1 };

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActiveUntil = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
      return;
    }
    if (event.code === 'KeyC') {
      if (!event.repeat) actions |= ACTION_CAMERA;
      return;
    }
    if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
      return;
    }
    if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RESTART;
      return;
    }
    if (event.code in PITCH_KEYS || event.code in THROTTLE_KEYS
      || event.code === 'ArrowLeft' || event.code === 'ArrowRight'
      || event.code === 'KeyA' || event.code === 'KeyD') {
      held.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
    mouseActiveUntil = performance.now() + 1000;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
    mouseActiveUntil = performance.now() + 1000;
  });

  function axis(negative, positive) {
    return (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
  }

  return {
    /** Pitch, roll, throttle and yaw for this frame, each in -1..1. */
    stick() {
      let pitch = axis('ArrowDown', 'ArrowUp');
      let roll = axis('ArrowLeft', 'ArrowRight');
      const now = performance.now();
      if (now < mouseActiveUntil && !held.size) {
        // Mouse steers only when no key is held, so the two never fight.
        roll = Math.max(-1, Math.min(1, mouseX * 2.4));
        pitch = Math.max(-1, Math.min(1, mouseY * 2.4));
      }
      return {
        pitch,
        roll,
        throttle: axis('KeyS', 'KeyW'),
        yaw: axis('KeyA', 'KeyD'),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
