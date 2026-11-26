// All sound is synthesised with WebAudio — an engine hum, wind, a chime for
// each ring, a thud for a crash and a little fanfare for a landing. No audio
// file is loaded, so the game never touches the network. Everything is
// guarded: a browser without audio simply flies silent.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 31;
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.4;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(osc2Gain);
      osc2Gain.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Wind is looped filtered noise from a generated buffer.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
      started = true;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** Call from a user gesture: browsers only allow audio after one. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** Continuous engine + wind, following throttle and speed. */
  function update(throttle, speed, running) {
    if (!ctx || !started || muted) return;
    const t = ctx.currentTime;
    const target = running ? 0.05 + throttle * 0.075 : 0;
    engineGain.gain.setTargetAtTime(target, t, 0.12);
    engineOsc.frequency.setTargetAtTime(52 + throttle * 62 + speed * 0.35, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(26 + throttle * 31 + speed * 0.18, t, 0.1);
    windGain.gain.setTargetAtTime(running ? Math.min(0.12, speed * 0.0011) : 0, t, 0.2);
    windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.2);
  }

  function tone(frequency, startAt, duration, type, volume) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration + 0.05);
    } catch { /* silent */ }
  }

  function ring() {
    tone(880, 0, 0.35, 'sine', 0.22);
    tone(1318.5, 0.09, 0.5, 'sine', 0.18);
  }

  function crash() {
    if (!ctx || muted) return;
    try {
      const length = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      tone(70, 0, 0.5, 'sine', 0.4);
    } catch { /* silent */ }
  }

  function fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((note, index) => tone(note, index * 0.13, 0.55, 'triangle', 0.2));
  }

  function setMuted(value) {
    muted = value;
    if (ctx && engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    if (ctx && windGain) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  return { unlock, update, ring, crash, fanfare, setMuted, isMuted: () => muted };
}
