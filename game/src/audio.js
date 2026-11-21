// Synthesised sound, no audio files: footsteps, alert stings, pickups and
// win notes, all made with the Web Audio API. Silent until the first key
// press or click (browsers require a gesture before audio starts).
export function makeAudio() {
  return { ctx: null, muted: false, master: null, lastStep: 0 };
}

function ensureContext(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
  } catch {
    return null;
  }
  return audio.ctx;
}

/** Call from the first key press or click. */
export function unlockAudio(audio) {
  const ctx = ensureContext(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}

function tone(audio, frequency, startAt, duration, type, volume) {
  const ctx = ensureContext(audio);
  if (!ctx || audio.muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

function thud(audio, volume) {
  const ctx = ensureContext(audio);
  if (!ctx || audio.muted) return;
  const length = Math.floor(ctx.sampleRate * 0.07);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start();
}

/** A footstep: soft while walking, louder while running. */
export function playFootstep(audio, running) {
  const now = performance.now();
  if (now - audio.lastStep < (running ? 240 : 380)) return;
  audio.lastStep = now;
  thud(audio, running ? 0.5 : 0.22);
}

/** Two-note alert sting when a guard's suspicion first spikes. */
export function playAlertSting(audio) {
  tone(audio, 660, 0, 0.16, 'square', 0.16);
  tone(audio, 880, 0.14, 0.22, 'square', 0.16);
}

/** Bright chime when an artifact is pocketed. */
export function playPickup(audio) {
  tone(audio, 880, 0, 0.12, 'sine', 0.2);
  tone(audio, 1318, 0.09, 0.2, 'sine', 0.2);
}

/** Short rising arpeggio when a level is cleared. */
export function playWin(audio) {
  [523, 659, 784, 1046].forEach((freq, i) => tone(audio, freq, i * 0.11, 0.25, 'triangle', 0.2));
}

/** Low buzz when the thief is caught. */
export function playCaught(audio) {
  tone(audio, 220, 0, 0.3, 'sawtooth', 0.18);
  tone(audio, 165, 0.22, 0.4, 'sawtooth', 0.18);
}
