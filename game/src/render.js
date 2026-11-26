// The world on screen: a golden-hour sky, distant ridges, the canyon mesh,
// the river, the rings and the runway, and the Kestrel herself in chase view.
// The camera is a pinhole: every world point is turned into camera space
// (right, up, forward from the heading and pitch), divided by its depth and
// placed on the canvas. The terrain is one grid of quads around the plane,
// painted far-to-near so near ground covers far ground.
import { COURSE, PALETTE } from './config.js';
import { groundHeight, riverX } from './terrain.js';
import { valueNoise } from './random.js';

const FOV = 1.15;
const GRID_STEP = 72;
const GRID_HALF_X = 640;
const GRID_AHEAD = 1560;
const GRID_BEHIND = 170;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Mix two [r, g, b] colours by t (0 = a, 1 = b), returning [r, g, b]. */
function mixRgb(rgbA, rgbB, t) {
  return [
    Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * t),
    Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * t),
    Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * t),
  ];
}

/** A #rrggbb palette colour as [r, g, b]. */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** An [r, g, b] colour as a CSS string. */
function css(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const HORIZON_RGB = hexRgb(PALETTE.skyHorizon);
const SHADOW_RGB = [28, 20, 16];

export function createRenderer(canvas, seed) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /** Camera basis from a position, heading, pitch and the canvas size. */
  function cameraAt(px, py, pz, heading, pitch) {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const fx = Math.sin(heading) * cp;
    const fy = sp;
    const fz = Math.cos(heading) * cp;
    // Right = up x forward, normalised; up = forward x right.
    let rx = fz;
    let rz = -fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    const ux = fy * rz - fz * 0;
    const uy = fz * rx - fx * rz;
    const uz = fx * 0 - fy * rx;
    const focal = (height * 0.5) / Math.tan(FOV / 2);
    return { px, py, pz, fx, fy, fz, rx, rz, ux, uy, uz, focal };
  }

  /** Project a world point to screen space; null when behind the camera. */
  function project(cam, x, y, z) {
    const vx = x - cam.px;
    const vy = y - cam.py;
    const vz = z - cam.pz;
    const cz = vx * cam.fx + vy * cam.fy + vz * cam.fz;
    if (cz < 2) return null;
    const cx = vx * cam.rx + vz * cam.rz;
    const cy = vx * cam.ux + vy * cam.uy + vz * cam.uz;
    return {
      x: width / 2 + (cx / cz) * cam.focal,
      y: height * 0.52 - (cy / cz) * cam.focal,
      depth: cz,
    };
  }

  function drawSky(cam, heading, time) {
    const horizonY = height * 0.52 - Math.sin(Math.asin(clamp(cam.fy, -1, 1))) * cam.focal;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.42, PALETTE.skyMid);
    gradient.addColorStop(0.55, PALETTE.skyHorizon);
    gradient.addColorStop(1, '#5d4a52');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // The sun hangs low in the west; its screen place follows the heading.
    const sunAz = 4.35;
    const relAz = wrapAngle(sunAz - heading);
    if (Math.abs(relAz) < 1.25) {
      const sx = width / 2 + Math.tan(relAz) * cam.focal;
      const sy = horizonY - Math.tan(0.21) * cam.focal;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
      glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 207, 125, 0.55)');
      glow.addColorStop(1, 'rgba(255, 207, 125, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 140, sy - 140, 280, 280);
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sx, sy, 17, 0, Math.PI * 2);
      ctx.fill();
    }

    // Slow clouds, placed by azimuth so they stay put as the heading turns.
    ctx.fillStyle = 'rgba(255, 244, 224, 0.55)';
    for (let i = 0; i < 7; i += 1) {
      const az = i * 0.9 + 0.35 + time * 0.002;
      const rel = wrapAngle(az - heading);
      if (Math.abs(rel) > 1.2) continue;
      const cx = width / 2 + Math.tan(rel) * cam.focal;
      const cy = horizonY - (95 + (i % 3) * 60) - Math.sin(time * 0.05 + i) * 4;
      const w = 62 + (i % 3) * 34;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w, 8 + (i % 2) * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + w * 0.4, cy + 5, w * 0.55, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Two far ridge silhouettes, drawn from noise over absolute azimuth.
    drawRidge(cam, heading, horizonY, 62, PALETTE.ridgeFar, 0.9);
    drawRidge(cam, heading, horizonY, 95, PALETTE.ridgeNear, 2.3);
  }

  function drawRidge(cam, heading, horizonY, amplitude, colour, seedOffset) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let sx = 0; sx <= width; sx += 16) {
      const relAz = Math.atan2(sx - width / 2, cam.focal);
      const az = heading + relAz;
      const n = valueNoise(az * 5.5, seedOffset, seed, 1);
      const y = horizonY - (amplitude + n * amplitude * 1.5) * (cam.focal / 700);
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  function terrainColour(h, slope, depth) {
    let base;
    if (h < 1.5) base = PALETTE.waterDeep;
    else if (h < 10) base = PALETTE.sand;
    else if (h < 55) base = PALETTE.scrub;
    else if (h < 150) base = PALETTE.rockMid;
    else if (h < 240) base = PALETTE.rockHigh;
    else base = '#8d8578';
    // Steep faces go darker, flat ground stays bright.
    const shade = clamp(1 - slope * 0.9, 0.55, 1);
    const shaded = mixRgb(hexRgb(base), SHADOW_RGB, 1 - shade);
    // Distance haze toward the horizon colour.
    const fog = clamp((depth - 480) / 1150, 0, 0.72);
    return css(mixRgb(shaded, HORIZON_RGB, fog));
  }

  function drawTerrain(cam, plane) {
    const cols = Math.floor((GRID_HALF_X * 2) / GRID_STEP) + 1;
    const rows = Math.floor((GRID_AHEAD + GRID_BEHIND) / GRID_STEP) + 1;
    const x0 = plane.x - GRID_HALF_X;
    const z0 = plane.z - GRID_BEHIND;
    // Heights first, so each quad can shade from its own slope.
    const heights = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        heights[r * cols + c] = groundHeight(x0 + c * GRID_STEP, z0 + r * GRID_STEP, seed);
      }
    }
    const quads = [];
    for (let r = 0; r < rows - 1; r += 1) {
      for (let c = 0; c < cols - 1; c += 1) {
        const xA = x0 + c * GRID_STEP;
        const zA = z0 + r * GRID_STEP;
        const h00 = heights[r * cols + c];
        const h10 = heights[r * cols + c + 1];
        const h01 = heights[(r + 1) * cols + c];
        const h11 = heights[(r + 1) * cols + c + 1];
        const p00 = project(cam, xA, h00, zA);
        const p10 = project(cam, xA + GRID_STEP, h10, zA);
        const p01 = project(cam, xA, h01, zA + GRID_STEP);
        const p11 = project(cam, xA + GRID_STEP, h11, zA + GRID_STEP);
        if (!p00 || !p10 || !p01 || !p11) continue;
        // A vertex almost at the camera blows its quad across the screen:
        // drop quads that close instead of painting the smear.
        const minDepth = Math.min(p00.depth, p10.depth, p01.depth, p11.depth);
        if (minDepth < 6) continue;
        const depth = (p00.depth + p10.depth + p01.depth + p11.depth) / 4;
        const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
        const meanH = (h00 + h10 + h01 + h11) / 4;
        quads.push({ p00, p10, p11, p01, depth, colour: terrainColour(meanH, slope / GRID_STEP, depth) });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    for (const q of quads) {
      ctx.fillStyle = q.colour;
      ctx.beginPath();
      ctx.moveTo(q.p00.x, q.p00.y);
      ctx.lineTo(q.p10.x, q.p10.y);
      ctx.lineTo(q.p11.x, q.p11.y);
      ctx.lineTo(q.p01.x, q.p01.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRing(cam, ring, index, isNext, time) {
    const centre = project(cam, ring.x, ring.y, ring.z);
    if (!centre || centre.depth > 1500) return;
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const p = project(cam, ring.x + Math.cos(a) * ring.radius, ring.y + Math.sin(a) * ring.radius, ring.z);
      if (!p) return;
      pts.push(p);
    }
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + ring.z);
    const colour = ring.passed ? PALETTE.ringPassed : PALETTE.ring;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.35 * pulse;
    ctx.lineWidth = 9;
    strokePoints(pts);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    strokePoints(pts);
    // Only the next ring carries its number, so the labels never pile up
    // when two rings line up behind each other.
    if (isNext && !ring.passed && centre.depth < 900
      && centre.x > 60 && centre.x < width - 60 && centre.y > 80 && centre.y < height - 100) {
      ctx.fillStyle = '#fff8e6';
      ctx.font = `700 ${Math.max(13, Math.round(900 / centre.depth) + 11)}px ${'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${index + 1}`, centre.x, centre.y - 14);
    }
  }

  function strokePoints(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  function drawRunway(cam, runway, time) {
    const hw = COURSE.runwayHalfWidth;
    // The strip is straight along z, so the part behind the camera can be
    // cut off at the camera's own depth instead of dropping the whole strip
    // whenever its near end falls behind the lens (as it does on landing).
    const zNear = Math.max(runway.z0, cam.pz + 8);
    if (zNear >= runway.z1) return;
    const a = project(cam, runway.x - hw, runway.y, zNear);
    const b = project(cam, runway.x + hw, runway.y, zNear);
    const c = project(cam, runway.x + hw, runway.y, runway.z1);
    const d = project(cam, runway.x - hw, runway.y, runway.z1);
    if (!a || !b || !c || !d) return;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and threshold bars.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let z = runway.z0 + 40; z < runway.z1 - 20; z += 90) {
      const p1 = project(cam, runway.x - 1.2, runway.y + 0.2, z);
      const p2 = project(cam, runway.x + 1.2, runway.y + 0.2, z);
      const p3 = project(cam, runway.x + 1.2, runway.y + 0.2, z + 42);
      const p4 = project(cam, runway.x - 1.2, runway.y + 0.2, z + 42);
      if (!p1 || !p2 || !p3 || !p4) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold bars at both ends.
    for (const z of [runway.z0 + 8, runway.z1 - 14]) {
      const p1 = project(cam, runway.x - hw + 2, runway.y + 0.2, z);
      const p2 = project(cam, runway.x + hw - 2, runway.y + 0.2, z);
      const p3 = project(cam, runway.x + hw - 2, runway.y + 0.2, z + 6);
      const p4 = project(cam, runway.x - hw + 2, runway.y + 0.2, z + 6);
      if (!p1 || !p2 || !p3 || !p4) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
    }
    // Windsock beside the threshold, waving; hangars wait past the strip.
    drawWindsock(cam, runway.x + 42, runway.y, runway.z0 + 90, time);
    drawHangar(cam, runway.x - 78, runway.y, runway.z0 + 320);
    drawHangar(cam, runway.x - 78, runway.y, runway.z0 + 420);
  }

  function drawWindsock(cam, x, y, z, time) {
    const base = project(cam, x, y, z);
    const top = project(cam, x, y + 11, z);
    if (!base || !top) return;
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    const wave = Math.sin(time * 2.2) * 0.25;
    const tip = project(cam, x + 9 + wave * 4, y + 10.5, z + 2);
    if (!tip) return;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(tip.x, tip.y - 2);
    ctx.lineTo(tip.x, tip.y + 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawHangar(cam, x, y, z) {
    const hw = 16;
    const depth = 22;
    const hh = 11;
    const a = project(cam, x - hw, y, z);
    const b = project(cam, x + hw, y, z);
    const c = project(cam, x + hw, y + hh, z);
    const d = project(cam, x - hw, y + hh, z);
    const e = project(cam, x + hw, y, z + depth);
    const f = project(cam, x + hw, y + hh, z + depth);
    if (!a || !b || !c || !d || !e || !f) return;
    ctx.fillStyle = '#7d8894';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5d6873';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(f.x, f.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a34a3a';
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(f.x, f.y);
    ctx.closePath();
    ctx.fill();
  }

  /** The Kestrel from behind and above, banking with the roll. */
  function drawPlane(time, roll) {
    const cx = width / 2;
    const cy = height * 0.6;
    const s = Math.min(width, height) / 720;
    ctx.save();
    ctx.translate(cx, cy + Math.sin(time * 2) * 2 * s);
    ctx.rotate(roll); // The plane banks with its roll; the world rolls less.
    ctx.scale(s, s);
    // Wings: long, cream, crimson tips.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-105, 6);
    ctx.lineTo(105, 6);
    ctx.lineTo(88, 26);
    ctx.lineTo(-88, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeRed;
    ctx.fillRect(-105, 6, 22, 20);
    ctx.fillRect(83, 6, 22, 20);
    // Tailplane and fin.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-42, 62);
    ctx.lineTo(42, 62);
    ctx.lineTo(30, 76);
    ctx.lineTo(-30, 76);
    ctx.closePath();
    ctx.fill();
    // Fuselage: crimson above, cream belly, tapering to the nose.
    ctx.fillStyle = PALETTE.planeRed;
    ctx.beginPath();
    ctx.moveTo(-13, -78);
    ctx.quadraticCurveTo(0, -88, 13, -78);
    ctx.lineTo(17, 40);
    ctx.quadraticCurveTo(16, 66, 0, 70);
    ctx.quadraticCurveTo(-16, 66, -17, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-13, 10);
    ctx.lineTo(13, 10);
    ctx.lineTo(16, 52);
    ctx.quadraticCurveTo(0, 62, -16, 52);
    ctx.closePath();
    ctx.fill();
    // Canopy glass.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -38, 10, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-3, -46, 3, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Spinning prop disc at the nose.
    ctx.fillStyle = 'rgba(220, 230, 240, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -82, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.arc(0, -82, 4, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red left, green right, white tail blinking.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-104, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34e07a';
    ctx.beginPath();
    ctx.arc(104, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(time * 1.6) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 70, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The next-ring pointer: a chevron at the screen edge when the ring is off-frame. */
  function drawNextRingPointer(cam, state) {
    const ring = state.rings[state.nextRing];
    if (!ring) return;
    const p = project(cam, ring.x, ring.y, ring.z);
    if (p && p.x > 70 && p.x < width - 70 && p.y > 90 && p.y < height - 120) return;
    const plane = state.plane;
    const dx = ring.x - plane.x;
    const dy = ring.y - plane.y;
    const dz = ring.z - plane.z;
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
    let cx;
    let cy;
    if (p) {
      cx = clamp(p.x, 70, width - 70);
      cy = clamp(p.y, 90, height - 120);
    } else {
      // Behind the camera: place the chevron by bearing, not by a guess.
      const bearing = wrapAngle(Math.atan2(dx, dz) - plane.heading);
      cx = width / 2 + Math.sin(bearing) * (width / 2 - 80);
      cy = bearing > 0 ? 120 : height - 140;
      cx = clamp(cx, 70, width - 70);
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11, 8);
    ctx.lineTo(-11, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${dist}m`, 0, 26);
    ctx.restore();
  }

  return {
    get width() { return width; },
    get height() { return height; },
    cameraAt,
    project,
    drawSky,
    drawTerrain,
    drawRing,
    drawRunway,
    drawPlane,
    drawNextRingPointer,
    /** The horizon line's screen height, for the cockpit panel to sit under. */
    horizonY(cam) {
      return height * 0.52 - Math.sin(Math.asin(clamp(cam.fy, -1, 1))) * cam.focal;
    },
    /** The chase camera: behind and above the plane, looking along its nose. */
    chaseCamera(plane) {
      const back = 26;
      const up = 7.5;
      const cx = plane.x - Math.sin(plane.heading) * back;
      const cz = plane.z - Math.cos(plane.heading) * back;
      const cy = plane.y + up;
      const lookPitch = plane.pitch * 0.35 - 0.1;
      return cameraAt(cx, cy, cz, plane.heading, lookPitch);
    },
    /** The cockpit camera: at the pilot's eyes, looking where the nose points. */
    cockpitCamera(plane) {
      return cameraAt(
        plane.x + Math.sin(plane.heading) * 1.5,
        plane.y + 1.4,
        plane.z + Math.cos(plane.heading) * 1.5,
        plane.heading,
        plane.pitch * 0.85,
      );
    },
    /**
     * The hero camera for a finished run: high behind the plane and looking
     * down the strip, so a landed plane is seen on its runway instead of
     * floating over a void — from 9 metres up, the chase camera looks
     * almost level and the ground fills only a thin band.
     */
    landedCamera(plane) {
      const back = 46;
      const up = 24;
      const cx = plane.x - Math.sin(plane.heading) * back;
      const cz = plane.z - Math.cos(plane.heading) * back;
      const cy = plane.y + up;
      const tx = plane.x + Math.sin(plane.heading) * 70;
      const tz = plane.z + Math.cos(plane.heading) * 70;
      const ty = plane.y - 2;
      const dx = tx - cx;
      const dy = ty - cy;
      const dz = tz - cz;
      const heading = Math.atan2(dx, dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return cameraAt(cx, cy, cz, heading, pitch);
    },
  };
}
