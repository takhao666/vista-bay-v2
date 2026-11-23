// Vista Bay — all sound is synthesized with WebAudio: engine hum, gunshots,
// sirens, pickups, UI clicks and a light mission-music loop. No audio files.
export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, musicTimer: null, musicOn: false,
    started: false,
  };
  return A;
}

export function initAudio(A) {
  if (A.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.35;
    A.master.connect(A.ctx.destination);
    // engine: two detuned saw oscillators through a lowpass
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    const engineOsc2 = A.ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    A.engineOsc.connect(filt); engineOsc2.connect(filt);
    filt.connect(A.engineGain); A.engineGain.connect(A.master);
    A.engineOsc.start(); engineOsc2.start();
    A.engineOsc2 = engineOsc2;
    // siren: triangle that sweeps between two tones
    A.sirenOsc = A.ctx.createOscillator();
    A.sirenOsc.type = 'triangle';
    A.sirenOsc.frequency.value = 700;
    A.sirenGain = A.ctx.createGain();
    A.sirenGain.gain.value = 0;
    A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
    A.sirenOsc.start();
    A.started = true;
  } catch { /* audio unavailable: the game stays silent */ }
}

function noiseBurst(A, duration, freq, gainVal) {
  if (!A.ctx) return;
  const len = Math.floor(A.ctx.sampleRate * duration);
  const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  const filt = A.ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = freq;
  const g = A.ctx.createGain(); g.gain.value = gainVal;
  src.connect(filt); filt.connect(g); g.connect(A.master);
  src.start();
}

function tone(A, freq, duration, type = 'sine', gainVal = 0.25, when = 0) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime + when;
  const o = A.ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(gainVal, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  o.connect(g); g.connect(A.master);
  o.start(t); o.stop(t + duration);
}

export function playGunshot(A) { noiseBurst(A, 0.14, 1800, 0.6); tone(A, 90, 0.1, 'square', 0.3); }
export function playPickup(A) { tone(A, 880, 0.12, 'sine', 0.3); tone(A, 1320, 0.18, 'sine', 0.3, 0.09); }
export function playClick(A) { tone(A, 600, 0.06, 'square', 0.15); }
export function playCrash(A) { noiseBurst(A, 0.3, 500, 0.5); }
export function playMissionComplete(A) {
  [523, 659, 784, 1047].forEach((f, i) => tone(A, f, 0.22, 'triangle', 0.3, i * 0.13));
}
export function playBusted(A) { [392, 330, 262].forEach((f, i) => tone(A, f, 0.3, 'sawtooth', 0.2, i * 0.2)); }

// Called every frame: engine pitch follows speed, siren wails with wanted level.
export function updateAudio(A, G) {
  if (!A.ctx) return;
  const p = G.player;
  const speed = p.inCar && p.car ? Math.abs(p.car.speed) : 0;
  const target = p.inCar ? 0.05 + Math.min(0.16, speed / 38 * 0.16) : 0;
  A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
  if (A.engineOsc) {
    A.engineOsc.frequency.setTargetAtTime(55 + speed * 4, A.ctx.currentTime, 0.1);
    A.engineOsc2.frequency.setTargetAtTime(28 + speed * 2, A.ctx.currentTime, 0.1);
  }
  if (G.wanted > 0) {
    A.sirenGain.gain.setTargetAtTime(0.05 + G.wanted * 0.008, A.ctx.currentTime, 0.2);
    A.sirenOsc.frequency.setTargetAtTime(650 + Math.sin(G.time * 5) * 220, A.ctx.currentTime, 0.05);
  } else {
    A.sirenGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3);
  }
}

// Simple mission-music loop: a sunny bass + pluck pattern while a mission runs.
const MUSIC_NOTES = [262, 330, 392, 523, 392, 330];
export function startMusic(A) {
  if (!A.ctx || A.musicOn) return;
  A.musicOn = true;
  let step = 0;
  A.musicTimer = setInterval(() => {
    if (!A.musicOn || !A.ctx) return;
    const f = MUSIC_NOTES[step % MUSIC_NOTES.length];
    tone(A, f, 0.25, 'triangle', 0.08);
    if (step % 2 === 0) tone(A, f / 2, 0.3, 'sine', 0.1);
    step += 1;
  }, 260);
}
export function stopMusic(A) {
  A.musicOn = false;
  if (A.musicTimer) { clearInterval(A.musicTimer); A.musicTimer = null; }
}
