// The glass and the brass: the HUD (altitude, speed, heading, throttle,
// rings, timer), the cockpit panel with its lit instruments, and the title,
// pause, crash and landing screens. Everything here is drawn over the world
// the renderer paints, never rotated with it, so the numbers stay readable.
import { FONT, PALETTE, SCORE } from './config.js';

const KNOTS = 1.94384;
const FEET = 3.28084;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 16, 22, 0.72)';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function dial(ctx, cx, cy, r, label) {
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.font = `700 ${Math.max(9, Math.round(r * 0.22))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 13);
}

function needle(ctx, cx, cy, r, angle, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(angle) * r * 0.82, cy - Math.cos(angle) * r * 0.82);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function createInstruments() {
  /** The HUD: flight data, compass, rings, timer and warnings. */
  function drawHud(ctx, w, h, state, camera, time) {
    const plane = state.plane;
    const altFt = Math.round(plane.y * FEET);
    const spdKt = Math.round(plane.speed * KNOTS);
    const hdg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
    const vsFpm = Math.round(plane.verticalSpeed * FEET * 60);

    // Top-left flight data block.
    panel(ctx, 14, 14, 208, 108);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('ALTITUDE', 28, 36);
    ctx.fillText('AIRSPEED', 28, 66);
    ctx.fillText('HEADING', 28, 96);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${altFt.toLocaleString('en-US')} FT`, 108, 38);
    ctx.fillText(`${spdKt} KT`, 108, 68);
    ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 108, 98);
    ctx.fillStyle = vsFpm >= 0 ? PALETTE.gaugeLit : PALETTE.warnAmber;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`V/S ${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`, 28, 116 - 4 + 4);

    // Top-centre compass strip.
    const stripW = Math.min(420, w * 0.4);
    const cx = w / 2;
    panel(ctx, cx - stripW / 2, 14, stripW, 40);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - stripW / 2, 14, stripW, 40);
    ctx.clip();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    for (let deg = -90; deg <= 90; deg += 15) {
      const a = hdg + deg;
      const norm = ((a % 360) + 360) % 360;
      const x = cx + (deg / 90) * (stripW / 2 - 12);
      const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0');
      ctx.fillStyle = deg === 0 ? PALETTE.gaugeAmber : PALETTE.hudText;
      ctx.fillText(label, x, deg % 45 === 0 ? 34 : 46);
      ctx.fillRect(x - 0.5, 18, 1, deg % 45 === 0 ? 10 : 6);
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.gaugeAmber;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 54);
    ctx.lineTo(cx + 6, 54);
    ctx.lineTo(cx, 62);
    ctx.closePath();
    ctx.fill();

    // Top-right mission block: rings, score, time.
    panel(ctx, w - 222, 14, 208, 108);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('RINGS', w - 208, 36);
    ctx.fillText('SCORE', w - 208, 66);
    ctx.fillText('TIME', w - 208, 96);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${state.ringsPassed} / ${state.rings.length}`, w - 128, 38);
    ctx.fillText(`${state.score}`, w - 128, 68);
    ctx.fillText(formatTime(state.elapsed), w - 128, 98);
    // Ring pips under the mission block.
    for (let i = 0; i < state.rings.length; i += 1) {
      ctx.fillStyle = state.rings[i].passed ? PALETTE.ringPassed : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(w - 208 + i * 24, 136, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom-left throttle lever.
    panel(ctx, 14, h - 118, 46, 104);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(32, h - 104, 8, 76);
    const thrH = 76 * plane.throttle;
    ctx.fillStyle = PALETTE.gaugeLit;
    ctx.fillRect(32, h - 28 - thrH, 8, thrH);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THR', 37, h - 122 + 12);
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 37, h - 118 + 100);

    // Centre flight-path marker.
    ctx.strokeStyle = 'rgba(244, 247, 250, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, h * 0.52);
    ctx.lineTo(w / 2 - 9, h * 0.52);
    ctx.moveTo(w / 2 + 9, h * 0.52);
    ctx.lineTo(w / 2 + 16, h * 0.52);
    ctx.moveTo(w / 2, h * 0.52 - 16);
    ctx.lineTo(w / 2, h * 0.52 - 9);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gaugeLit;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Warnings, centre-top, flashing.
    const ground = state.groundNow ?? 0;
    const clearance = plane.y - ground;
    let warning = '';
    if (state.stalled) warning = 'STALL — NOSE DOWN, ADD POWER';
    else if (clearance < 30 && plane.verticalSpeed < -3) warning = 'PULL UP — TERRAIN';
    else if (plane.speed > 96) warning = 'OVERSPEED';
    if (warning && Math.floor(time * 2.4) % 2 === 0) {
      ctx.fillStyle = PALETTE.warnRed;
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(warning, w / 2, 92);
    }
    if (camera === 'cockpit') return;
  }

  /** The cockpit panel: nose, prop arc and lit instruments across the bottom. */
  function drawCockpit(ctx, w, h, state, time) {
    const plane = state.plane;
    const panelTop = h * 0.74;
    // Nose cowling and the prop arc above the panel.
    ctx.fillStyle = PALETTE.planeRed;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 90, panelTop + 6);
    ctx.quadraticCurveTo(w / 2, panelTop - 46, w / 2 + 90, panelTop + 6);
    ctx.lineTo(w / 2 + 70, panelTop + 26);
    ctx.lineTo(w / 2 - 70, panelTop + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 230, 240, 0.22)';
    ctx.beginPath();
    ctx.ellipse(w / 2, panelTop - 40, 120, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.arc(w / 2, panelTop - 40, 7, 0, Math.PI * 2);
    ctx.fill();

    // The panel itself.
    const gradient = ctx.createLinearGradient(0, panelTop, 0, h);
    gradient.addColorStop(0, '#2b313a');
    gradient.addColorStop(1, '#171b21');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, panelTop, w, h - panelTop);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, panelTop, w, 2);

    const cy = panelTop + (h - panelTop) / 2 + 6;
    const r = Math.min(52, (h - panelTop) / 2 - 16);

    // Artificial horizon: sky and ground halves turning with the bank.
    const ahX = w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ahX, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(ahX, cy);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * r * 1.4);
    ctx.fillStyle = '#5d9bd4';
    ctx.fillRect(-r, -r, r * 2, r);
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(-r, 0, r * 2, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    for (const off of [-0.5, -0.25, 0.25, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, off * r);
      ctx.lineTo(r * 0.4, off * r);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ahX, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed aircraft symbol over the horizon.
    ctx.strokeStyle = PALETTE.gaugeAmber;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ahX - 18, cy);
    ctx.lineTo(ahX - 5, cy);
    ctx.moveTo(ahX + 5, cy);
    ctx.lineTo(ahX + 18, cy);
    ctx.moveTo(ahX, cy - 4);
    ctx.lineTo(ahX, cy + 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gaugeLit;
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', ahX, cy + r + 13);

    // Altimeter (left) and airspeed (right), needles glowing.
    const altX = w / 2 - r * 3.1;
    const spdX = w / 2 + r * 3.1;
    dial(ctx, altX, cy, r, 'ALTITUDE');
    const altAngle = ((plane.y % 1000) / 1000) * Math.PI * 2;
    needle(ctx, altX, cy, r, altAngle, PALETTE.gaugeLit, 2);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.round(plane.y * FEET)}`, altX, cy + 5);
    dial(ctx, spdX, cy, r, 'AIRSPEED');
    const spdAngle = clamp(plane.speed / 110, 0, 1) * Math.PI * 1.5 - Math.PI * 0.75;
    needle(ctx, spdX, cy, r, spdAngle, PALETTE.gaugeLit, 2);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.round(plane.speed * KNOTS)}`, spdX, cy + 5);

    // Heading tape across the top of the panel.
    const hdg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, w / 2, panelTop + 22);

    // Warning lamps, lit when they mean something.
    const lamp = (x, label, on, colour) => {
      ctx.fillStyle = on && Math.floor(time * 2.4) % 2 === 0 ? colour : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(x, panelTop + 24, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = `600 9px ${FONT}`;
      ctx.fillText(label, x, panelTop + 42);
    };
    lamp(w - 120, 'STALL', state.stalled, PALETTE.warnAmber);
    lamp(w - 80, 'GEAR', state.ringsPassed >= state.rings.length, PALETTE.gaugeLit);
    lamp(w - 40, 'TERRAIN', (state.groundNow ?? 9999) - plane.y > -30 && plane.verticalSpeed < -3, PALETTE.warnRed);
  }

  /** A centred title card used by the title, pause, crash and landing screens. */
  function card(ctx, w, h, title, lines, accent, dy = 0) {
    const cw = Math.min(560, w - 48);
    const ch = 150 + lines.length * 30;
    const x = (w - cw) / 2;
    const y = (h - ch) / 2 + dy;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.88)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `800 ${Math.min(40, cw / 13)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, y + 56);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `400 16px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, y + 96 + i * 30));
  }

  function drawTitle(ctx, w, h, best) {
    // The card sits high so the aircraft shows below it on the cover shot.
    card(ctx, w, h, 'CRIMSON CANYON', [
      'RING RUN — fly all 8 rings, then land on the valley runway.',
      'W/S throttle · Arrows pitch & bank · A/D rudder · C camera · M sound',
      'Mouse steers too. Press SPACE or click to fly.',
      best ? `Best landing: ${formatTime(best)}` : 'No landing yet — the canyon is waiting.',
    ], PALETTE.ring, -80);
  }

  function drawPaused(ctx, w, h) {
    card(ctx, w, h, 'PAUSED', ['Press P or SPACE to keep flying.', 'C switches camera · M toggles sound'], PALETTE.hudDim);
  }

  function drawCrashed(ctx, w, h, state) {
    card(ctx, w, h, 'CRASHED', [
      state.crashReason || 'The canyon wins this time.',
      `Rings ${state.ringsPassed} / ${state.rings.length} · Score ${state.score} · ${formatTime(state.elapsed)}`,
      'Press R or SPACE to fly again.',
    ], PALETTE.warnRed);
  }

  function drawLanded(ctx, w, h, state, best) {
    const timeBonus = Math.max(0, Math.round(SCORE.timeBonusStart - state.elapsed * SCORE.timeBonusPerSecond));
    card(ctx, w, h, 'LANDED — RUN COMPLETE', [
      `Rings ${state.ringsPassed} × ${SCORE.ring}  +  landing ${SCORE.landing}  +  time bonus ${timeBonus}`,
      `Total score ${state.score} · Time ${formatTime(state.elapsed)}`,
      best ? `Best landing: ${formatTime(best)}` : 'First landing on this browser — nice flying.',
      'Press R or SPACE to fly the canyon again.',
    ], PALETTE.gaugeLit);
  }

  /** The controls hint, drawn where it never covers the instruments. */
  function drawHint(ctx, w, h, camera) {
    ctx.fillStyle = 'rgba(244, 247, 250, 0.9)';
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'center';
    // In the cockpit the panel fills the bottom of the screen, so the hint
    // sits just above it; in chase view it sits at the very bottom.
    const y = camera === 'cockpit' ? h * 0.74 - 12 : h - 18;
    ctx.fillText('W/S throttle · Arrow keys fly · C camera · P pause', w / 2, y);
  }

  return { drawHud, drawCockpit, drawTitle, drawPaused, drawCrashed, drawLanded, drawHint };
}
