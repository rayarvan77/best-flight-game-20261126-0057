// The screenshot scenes behind ?shot=start|play|cockpit|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by the autopilot, so the frame is what a short flight really looks
// like and the same seed always gives the same frame. The end scene flies
// the whole course and lands; the cockpit scene is the play scene from the
// pilot's seat.
import { STEP } from './config.js';
import { createAutopilot } from './autopilot.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const END_LIMIT_SECONDS = 420;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LANDED = 'landed';

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * camera to use, and the best time to show. Any other name stages the title.
 */
export function stageShot(name, world, seed) {
  const autopilot = createAutopilot(seed);
  world.reset();
  if (name !== 'play' && name !== 'cockpit' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot.steer(world.state));
    }
    return { screen: SCREEN_TITLE, camera: 'chase' };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot.steer(world.state));
      if (world.state.finished || world.state.crashed) break;
    }
    return {
      screen: world.state.finished ? SCREEN_LANDED : SCREEN_OVER,
      camera: 'chase',
    };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    world.step(STEP, autopilot.steer(world.state));
    if (world.state.finished || world.state.crashed) break;
  }
  return { screen: SCREEN_PLAY, camera: name === 'cockpit' ? 'cockpit' : 'chase' };
}
