/* Mood — pick a mood, an algorithm composes a unique track.
 * Variety is driven by mood + energy + tempo + instrument; the engine is a
 * small generative composer running entirely in the browser (no backend). */

// ── Music theory ───────────────────────────────────────
const NOTE_NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MODES = {
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
};

/* Each mood is a full recipe: musical mode, tempo, register, rhythm, contour,
 * dynamics and a generated track title. */
const MOODS = {
  chill: {
    label: "Chill", emoji: "😌", desc: "Relaxed, Calm", title: "Midnight Whispers",
    key: "C", mode: "dorian", baseTempo: 80, octave: 5, span: 1.6,
    rhythm: "flowing", leap: 0.3, contour: "wander", restChance: 0.14,
    progression: [0, 5, 3, 4], bassMode: "hold",
  },
  melancholic: {
    label: "Melancholic", emoji: "☁️", desc: "Sad, Reflective", title: "Rain on Glass",
    key: "A", mode: "aeolian", baseTempo: 68, octave: 4, span: 1.5,
    rhythm: "languid", leap: 0.2, contour: "fall", restChance: 0.13,
    progression: [0, 5, 2, 6], bassMode: "hold",
  },
  happy: {
    label: "Happy", emoji: "☀️", desc: "Uplifting, Bright", title: "Golden Bloom",
    key: "G", mode: "ionian", baseTempo: 122, octave: 5, span: 1.7,
    rhythm: "bouncy", leap: 0.4, contour: "arch", restChance: 0.06,
    progression: [0, 4, 5, 3], bassMode: "walk",
  },
  focused: {
    label: "Focused", emoji: "⛰️", desc: "Productive, Flow", title: "Deep Signal",
    key: "D", mode: "mixolydian", baseTempo: 104, octave: 5, span: 1.5,
    rhythm: "driving", leap: 0.25, contour: "wander", restChance: 0.05,
    progression: [0, 3, 0, 4], bassMode: "pulse",
  },
  sleepy: {
    label: "Sleepy", emoji: "🌙", desc: "Restful, Peaceful", title: "Moonlit Drift",
    key: "E", mode: "lydian", baseTempo: 60, octave: 5, span: 1.8,
    rhythm: "sparse", leap: 0.2, contour: "rise", restChance: 0.2,
    progression: [0, 1, 3, 4], bassMode: "hold",
  },
};
const MOOD_ORDER = ["chill", "melancholic", "happy", "focused", "sleepy"];

const INSTRUMENTS = {
  Piano:   { synth: "struck", partials: [[1, 1], [2, 0.4], [3, 0.16], [4, 0.07]], tail: 0.6 },
  Guitar:  { synth: "pluck", damp: 2600, fb: 0.963, bright: 0.6 },
  Strings: { synth: "sustain", wave: "sawtooth", cutoff: 2500, detune: 7, voices: [-7, 0, 7], vibrato: 5, vibDepth: 0.006, a: 0.12, d: 0.1, s: 0.85, r: 0.22 },
  Synth:   { synth: "sustain", wave: "sawtooth", cutoff: 2300, detune: 12, q: 6, filterEnv: true, a: 0.008, d: 0.14, s: 0.7, r: 0.14 },
  Flute:   { synth: "flute" },
  "Lo-fi": { synth: "sustain", wave: "triangle", cutoff: 1250, detune: 8, voices: [-8, -3, 6], vibrato: 0.8, vibDepth: 0.004, a: 0.012, d: 0.16, s: 0.8, r: 0.16 },
  Bells:   { synth: "fm", ratio: 3.5, index: 6, decay: 1.9 },
  Marimba: { synth: "struck", partials: [[1, 1], [4, 0.5], [10, 0.1]], decay: 0.42, tail: 0.2 },
  Harp:    { synth: "pluck", damp: 4200, fb: 0.95, bright: 0.85 },
  Pad:     { synth: "sustain", wave: "sawtooth", cutoff: 1900, detune: 11, voices: [-11, -4, 4, 11], a: 0.28, d: 0.2, s: 0.85, r: 0.45 },
};

const RHYTHM_CELLS = {
  bouncy: [
    { w: 3, cell: [0.5, 0.5] }, { w: 3, cell: [0.5, 0.25, 0.25] },
    { w: 2, cell: [0.25, 0.25, 0.5] }, { w: 1, cell: [1] }, { w: 1, cell: [0.75, 0.25] },
  ],
  driving: [
    { w: 4, cell: [0.25, 0.25, 0.25, 0.25] }, { w: 3, cell: [0.5, 0.25, 0.25] }, { w: 1, cell: [0.5, 0.5] },
  ],
  flowing: [
    { w: 3, cell: [1] }, { w: 2, cell: [2] }, { w: 1, cell: [1.5] }, { w: 1, cell: [0.5, 0.5] },
  ],
  languid: [
    { w: 3, cell: [2] }, { w: 2, cell: [1] }, { w: 1, cell: [1, 1] }, { w: 1, cell: [1.5, 0.5] },
  ],
  sparse: [
    { w: 3, cell: [2] }, { w: 2, cell: [1] }, { w: 2, cell: [1.5] }, { w: 1, cell: [0.5, 0.5] },
  ],
};

const DURATION_BARS = { 1: 8, 3: 12, 5: 16, 10: 20, 30: 24 };

// ── RNG ────────────────────────────────────────────────
function createRng(seed) {
  let state = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, n) => Math.floor(rng() * n);
const pick = (rng, arr) => arr[randInt(rng, arr.length)];
function weightedCell(rng, cells) {
  const total = cells.reduce((s, c) => s + c.w, 0);
  let r = rng() * total;
  for (const c of cells) { r -= c.w; if (r <= 0) return c.cell; }
  return cells[cells.length - 1].cell;
}

// ── Pitch helpers ──────────────────────────────────────
const clampMidi = (n) => Math.max(0, Math.min(127, Math.round(n)));
function degreeToMidi(key, baseOctave, modeSteps, degree) {
  const root = NOTE_NAMES[key] ?? 0;
  const oct = Math.floor(degree / 7);
  const step = ((degree % 7) + 7) % 7;
  return 12 * (baseOctave + oct) + root + modeSteps[step];
}
function contourCenter(shape, t, maxDegree) {
  switch (shape) {
    case "rise": return maxDegree * (0.2 + 0.6 * t);
    case "fall": return maxDegree * (0.8 - 0.6 * t);
    case "arch": return maxDegree * (0.25 + 0.55 * Math.sin(Math.PI * t));
    default: return maxDegree * 0.5;
  }
}

// ── Generation ─────────────────────────────────────────
function buildMelody(mood, bars, energy, rng) {
  const totalBeats = bars * 4;
  const cells = RHYTHM_CELLS[mood.rhythm];
  const maxDegree = Math.max(2, Math.round(mood.span * 7 + energy * 3));
  const restChance = Math.max(0, mood.restChance - energy * 0.12);
  const octave = mood.octave + (energy > 0.8 ? 1 : 0);

  const events = [];
  let cursor = 0;
  let degree = Math.round(maxDegree * 0.4);

  while (cursor < totalBeats - 0.01) {
    const cell = weightedCell(rng, cells);
    for (const dur of cell) {
      if (cursor >= totalBeats - 0.01) break;
      const target = contourCenter(mood.contour, cursor / totalBeats, maxDegree);
      if (Math.abs(target - degree) > 2) degree += Math.sign(target - degree);
      if (rng() < mood.leap) degree += pick(rng, [-4, -3, -2, 2, 3, 4]);
      else degree += pick(rng, [-1, 0, 1, 1]);
      degree = Math.max(0, Math.min(maxDegree, degree));

      const rest = rng() < restChance && events.length > 0;
      events.push({
        midi: rest ? null : clampMidi(degreeToMidi(mood.key, octave, MODES[mood.mode], degree)),
        start: cursor, dur, rest,
      });
      cursor += dur;
    }
  }
  // cadence onto the tonic
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (!events[i].rest) {
      events[i].midi = clampMidi(degreeToMidi(mood.key, octave, MODES[mood.mode], 0));
      if (i > 0 && !events[i - 1].rest) events[i - 1].midi = clampMidi(degreeToMidi(mood.key, octave, MODES[mood.mode], 1));
      break;
    }
  }
  return events;
}

function buildBass(mood, bars, rng) {
  const events = [];
  const steps = MODES[mood.mode];
  const bassOctave = mood.octave - 2;
  for (let bar = 0; bar < bars; bar += 1) {
    const root = mood.progression[bar % mood.progression.length];
    const barStart = bar * 4;
    const rootMidi = clampMidi(degreeToMidi(mood.key, bassOctave, steps, root));
    const fifthMidi = clampMidi(degreeToMidi(mood.key, bassOctave, steps, root + 4));
    if (mood.bassMode === "hold") {
      events.push({ midi: rootMidi, start: barStart, dur: 4, rest: false });
    } else if (mood.bassMode === "pulse") {
      for (let b = 0; b < 4; b += 1) events.push({ midi: b % 2 ? fifthMidi : rootMidi, start: barStart + b, dur: 1, rest: false });
    } else {
      const tones = [root, root, root + 4, root + 2];
      for (let b = 0; b < 4; b += 1) events.push({ midi: clampMidi(degreeToMidi(mood.key, bassOctave, steps, tones[b])), start: barStart + b, dur: 1, rest: false });
    }
  }
  return events;
}

function composePiece(opts) {
  const mood = MOODS[opts.moodKey];
  const bars = DURATION_BARS[opts.minutes] ?? 12;
  const rng = createRng(opts.seed);
  return {
    mood, moodKey: opts.moodKey, bpm: opts.bpm, instrument: opts.instrument,
    minutes: opts.minutes, energy: opts.energy, bars, totalBeats: bars * 4,
    melody: buildMelody(mood, bars, opts.energy, rng),
    bass: buildBass(mood, bars, rng),
    seed: opts.seed,
  };
}

// ── Audio engine ───────────────────────────────────────
// Per-instrument synthesis through a shared reverb + compressor bus.
let audioCtx = null;
let master = null;       // volume gain feeding the bus
let reverbBuf = null;
let noiseBuf = null;
let activeVoices = [];    // teardown fns
let endTimer = 0;

const midiToFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

function makeNoise(seconds) {
  const len = Math.floor(seconds * audioCtx.sampleRate);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(seconds, decay) {
  const len = Math.floor(seconds * audioCtx.sampleRate);
  const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

async function ensureAudio() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = volumeInput.value / 100;

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 26; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.25;

    reverbBuf = makeImpulse(2.6, 2.6);
    noiseBuf = makeNoise(2);
    const reverb = audioCtx.createConvolver();
    reverb.buffer = reverbBuf;
    const wet = audioCtx.createGain();
    wet.gain.value = 0.2;

    master.connect(comp);                 // dry
    master.connect(reverb); reverb.connect(wet); wet.connect(comp); // wet
    comp.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") await audioCtx.resume();
}

function stopPlayback() {
  for (const teardown of activeVoices) { try { teardown(); } catch { /* gone */ } }
  activeVoices = [];
  if (endTimer) clearTimeout(endTimer);
  endTimer = 0;
}

// ADSR onto a gain param (exponential, never hits true zero)
function adsr(param, t0, dur, a, d, s, r, peak) {
  const sus = Math.max(0.0001, peak * s);
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
  param.exponentialRampToValueAtTime(sus, t0 + a + d);
  const rel = Math.max(t0 + a + d + 0.01, t0 + dur - r);
  param.setValueAtTime(sus, rel);
  param.exponentialRampToValueAtTime(0.0001, rel + r);
}

const stopOscs = (oscs) => () => { for (const o of oscs) { try { o.stop(); } catch { /* gone */ } } };

// Karplus–Strong plucked string (guitar, harp) — noise burst into a damped feedback delay
function vPluck(freq, t0, dur, vel, cfg) {
  const out = audioCtx.createGain(); out.gain.value = vel * 1.4; out.connect(master);
  const delay = audioCtx.createDelay(0.05); delay.delayTime.value = 1 / freq;
  const damp = audioCtx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = cfg.damp || 3200;
  const fb = audioCtx.createGain(); fb.gain.value = cfg.fb || 0.96;
  delay.connect(damp); damp.connect(fb); fb.connect(delay); delay.connect(out);
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  const burst = audioCtx.createGain();
  burst.gain.setValueAtTime(1, t0);
  burst.gain.setValueAtTime(1, t0 + 0.003 + 0.004 * (cfg.bright || 0.5));
  burst.gain.linearRampToValueAtTime(0, t0 + 0.014);
  src.connect(burst); burst.connect(delay); src.start(t0); src.stop(t0 + 0.05);
  out.gain.setTargetAtTime(0.0001, t0 + Math.max(0.2, dur * 0.7), 0.5);
  activeVoices.push(() => { try { src.stop(); } catch { /* gone */ } fb.gain.value = 0; });
}

// FM bell / music box — modulator with decaying index
function vFm(freq, t0, dur, vel, cfg) {
  const out = audioCtx.createGain(); out.connect(master);
  const car = audioCtx.createOscillator(); car.frequency.value = freq;
  const mod = audioCtx.createOscillator(); mod.frequency.value = freq * (cfg.ratio || 3.5);
  const mg = audioCtx.createGain();
  mod.connect(mg); mg.connect(car.frequency); car.connect(out);
  const decay = Math.min(dur + 0.4, cfg.decay || 1.6);
  mg.gain.setValueAtTime(freq * (cfg.index || 5), t0);
  mg.gain.exponentialRampToValueAtTime(freq * 0.4, t0 + decay);
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(vel, t0 + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  car.start(t0); mod.start(t0);
  const end = t0 + decay + 0.05; car.stop(end); mod.stop(end);
  activeVoices.push(stopOscs([car, mod]));
}

// Additive struck-string — piano / marimba (a few inharmonic partials, percussive decay)
function vStruck(freq, t0, dur, vel, cfg) {
  const out = audioCtx.createGain(); out.connect(master);
  const oscs = [];
  for (const [mult, amp] of cfg.partials) {
    const o = audioCtx.createOscillator(); o.type = "sine";
    o.frequency.value = freq * mult * (1 + 0.0004 * mult * mult);
    const g = audioCtx.createGain(); g.gain.value = amp;
    o.connect(g); g.connect(out); o.start(t0); oscs.push(o);
  }
  const decay = Math.min(dur + (cfg.tail || 0.5), cfg.decay || (0.5 + 220 / freq));
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(vel, t0 + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  const end = t0 + decay + 0.05; for (const o of oscs) o.stop(end);
  activeVoices.push(stopOscs(oscs));
}

// Subtractive sustained voice — strings (bow), synth, pad, lo-fi
function vSustain(freq, t0, dur, vel, cfg) {
  const out = audioCtx.createGain(); out.connect(master);
  const filt = audioCtx.createBiquadFilter(); filt.type = "lowpass";
  filt.frequency.value = cfg.cutoff || 2400; filt.Q.value = cfg.q || 0.7; filt.connect(out);
  if (cfg.filterEnv) {
    filt.frequency.setValueAtTime((cfg.cutoff || 2400) * 2.6, t0);
    filt.frequency.exponentialRampToValueAtTime((cfg.cutoff || 2400) * 0.55, t0 + 0.25);
  }
  const detune = cfg.detune || 8;
  const spread = cfg.voices || [-detune, detune];
  const oscs = [];
  for (const c of spread) {
    const o = audioCtx.createOscillator(); o.type = cfg.wave || "sawtooth";
    o.frequency.value = freq; o.detune.value = c; o.connect(filt); o.start(t0); oscs.push(o);
  }
  let lfo = null;
  if (cfg.vibrato) {
    lfo = audioCtx.createOscillator(); lfo.frequency.value = cfg.vibrato;
    const lg = audioCtx.createGain(); lg.gain.value = freq * (cfg.vibDepth || 0.005);
    lfo.connect(lg); for (const o of oscs) lg.connect(o.frequency); lfo.start(t0);
  }
  const a = cfg.a ?? 0.02, d = cfg.d ?? 0.12, s = cfg.s ?? 0.75, r = cfg.r ?? 0.18;
  adsr(out.gain, t0, dur, a, d, s, r, vel);
  const end = t0 + dur + r + 0.1;
  for (const o of oscs) o.stop(end); if (lfo) lfo.stop(end);
  activeVoices.push(() => { stopOscs(oscs)(); if (lfo) { try { lfo.stop(); } catch { /* gone */ } } });
}

// Flute — sine body + breathy filtered noise + vibrato
function vFlute(freq, t0, dur, vel, cfg) {
  const out = audioCtx.createGain(); out.connect(master);
  const o = audioCtx.createOscillator(); o.type = "sine"; o.frequency.value = freq; o.connect(out);
  const n = audioCtx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const nf = audioCtx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = freq * 2; nf.Q.value = 0.9;
  const ng = audioCtx.createGain(); ng.gain.value = vel * 0.14;
  n.connect(nf); nf.connect(ng); ng.connect(out);
  const lfo = audioCtx.createOscillator(); lfo.frequency.value = 5.5;
  const lg = audioCtx.createGain(); lg.gain.value = freq * 0.005; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0);
  adsr(out.gain, t0, dur, 0.06, 0.1, 0.88, 0.14, vel);
  o.start(t0); n.start(t0);
  const end = t0 + dur + 0.2; o.stop(end); n.stop(end); lfo.stop(end);
  activeVoices.push(() => { for (const x of [o, n, lfo]) { try { x.stop(); } catch { /* gone */ } } });
}

function playNote(inst, freq, t0, dur, vel) {
  const cfg = INSTRUMENTS[inst] || INSTRUMENTS.Piano;
  switch (cfg.synth) {
    case "pluck": return vPluck(freq, t0, dur, vel, cfg);
    case "fm": return vFm(freq, t0, dur, vel, cfg);
    case "struck": return vStruck(freq, t0, dur, vel, cfg);
    case "flute": return vFlute(freq, t0, dur, vel, cfg);
    default: return vSustain(freq, t0, dur, vel, cfg);
  }
}

function vBass(freq, t0, dur, vel) {
  const out = audioCtx.createGain(); out.connect(master);
  const filt = audioCtx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 850; filt.connect(out);
  const o = audioCtx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
  const sub = audioCtx.createOscillator(); sub.type = "sine"; sub.frequency.value = freq / 2;
  o.connect(filt); sub.connect(filt);
  adsr(out.gain, t0, dur, 0.006, 0.1, 0.8, 0.1, vel);
  o.start(t0); sub.start(t0);
  const end = t0 + dur + 0.15; o.stop(end); sub.stop(end);
  activeVoices.push(stopOscs([o, sub]));
}

async function playPiece() {
  if (!piece) generate({ play: false });
  await ensureAudio();
  stopPlayback();
  const bpm = piece.bpm;
  const beat = 60 / bpm;
  const start = audioCtx.currentTime + 0.12;
  const melVol = 0.16 + piece.energy * 0.1;

  // soft harmony pad: sustained diatonic triad per bar, low in the mix
  const padOct = piece.mood.octave - 1;
  for (let bar = 0; bar < piece.bars; bar += 1) {
    const root = piece.mood.progression[bar % piece.mood.progression.length];
    for (const deg of [root, root + 2, root + 4]) {
      const midi = clampMidi(degreeToMidi(piece.mood.key, padOct, MODES[piece.mood.mode], deg));
      playNote("Pad", midiToFreq(midi), start + bar * 4 * beat, 4 * beat, 0.05);
    }
  }

  // melody (chosen instrument) with a light downbeat accent
  for (const e of piece.melody) {
    if (e.rest || e.midi == null) continue;
    const t0 = start + e.start * beat;
    const onBeat = Math.abs(e.start - Math.round(e.start)) < 0.02;
    playNote(piece.instrument, midiToFreq(e.midi), t0, Math.max(0.08, e.dur * beat), melVol * (onBeat ? 1 : 0.85));
  }

  // bass line
  for (const e of piece.bass) {
    if (e.rest || e.midi == null) continue;
    vBass(midiToFreq(e.midi), start + e.start * beat, Math.max(0.12, e.dur * beat), 0.17);
  }

  const lengthSec = (piece.totalBeats * 60) / bpm + 1.6;
  setPlaying(true);
  endTimer = setTimeout(() => setPlaying(false), lengthSec * 1000);
}

// ── MIDI export (self-contained Standard MIDI File) ─────
const MIDI_PPQ = 480;
function encodeVarLen(v) {
  const bytes = [v & 0x7f]; v = Math.floor(v / 128);
  while (v > 0) { bytes.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
  return bytes;
}
function voiceToTrack(events, channel, velocity, tempoMicros) {
  const timed = [];
  for (const e of events) {
    if (e.rest || e.midi == null) continue;
    const s = Math.round(e.start * MIDI_PPQ);
    const en = Math.max(s + 1, Math.round((e.start + e.dur * 0.9) * MIDI_PPQ));
    timed.push({ tick: s, on: 1, note: e.midi });
    timed.push({ tick: en, on: 0, note: e.midi });
  }
  timed.sort((a, b) => a.tick - b.tick || a.on - b.on);
  const bytes = [];
  if (tempoMicros != null) bytes.push(0x00, 0xff, 0x51, 0x03, (tempoMicros >> 16) & 0xff, (tempoMicros >> 8) & 0xff, tempoMicros & 0xff);
  let prev = 0;
  for (const ev of timed) {
    bytes.push(...encodeVarLen(ev.tick - prev)); prev = ev.tick;
    bytes.push((ev.on ? 0x90 : 0x80) | channel, ev.note & 0x7f, ev.on ? velocity : 0);
  }
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return bytes;
}
function midiChunk(id, data) {
  const len = data.length;
  return [id.charCodeAt(0), id.charCodeAt(1), id.charCodeAt(2), id.charCodeAt(3),
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...data];
}
function downloadMidi() {
  const tempoMicros = Math.round(60000000 / piece.bpm);
  const bytes = new Uint8Array([
    ...midiChunk("MThd", [0x00, 0x01, 0x00, 0x02, (MIDI_PPQ >> 8) & 0xff, MIDI_PPQ & 0xff]),
    ...midiChunk("MTrk", voiceToTrack(piece.melody, 0, 100, tempoMicros)),
    ...midiChunk("MTrk", voiceToTrack(piece.bass, 1, 80, null)),
  ]);
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `mood_${piece.moodKey}_${piece.bpm}bpm_${piece.seed}.mid`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── DOM ────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const moodGrid = $("mood-grid");
const energyInput = $("energy");
const tempoInput = $("tempo");
const energyVal = $("energy-val");
const tempoVal = $("tempo-val");
const instChips = $("instruments");
const durChips = $("durations");
const generateBtn = $("generate-btn");
const generateHelp = $("generate-help");
const playBtn = $("play-btn");
const playUse = playBtn.querySelector("use");
const trackTitle = $("track-title");
const trackSub = $("track-sub");
const visualizer = $("visualizer");
const nowLive = $("now-live");
const volumeInput = $("volume");
const toastEl = $("toast-host");

// ── State ──────────────────────────────────────────────
let currentMood = "chill";
let instruments = new Set(["Piano"]);
let minutes = 3;
let piece = null;
let playing = false;
let seedCounter = 1;

// persisted collections + preferences (localStorage, no backend)
const STORE = {
  load(key, fallback) { try { const v = localStorage.getItem("mood." + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  save(key, val) { try { localStorage.setItem("mood." + key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
};
let library = STORE.load("library", []);
let favorites = STORE.load("favorites", []);
let history = STORE.load("history", []);
let settings = STORE.load("settings", { autoplay: true, waveform: true, defaultMood: "chill", defaultDuration: 3 });
let currentView = "home";

const viewHome = $("view-home");
const viewPanel = $("view-panel");
const favBtn = $("fav-btn");
const navItems = [...document.querySelectorAll(".nav__item")];

const energyN = () => energyInput.value / 100;
const primaryInstrument = () => {
  for (const k of Object.keys(INSTRUMENTS)) if (instruments.has(k)) return k;
  return "Piano";
};
const fmtTime = (min) => `${min}:00`;

// ── UI helpers ─────────────────────────────────────────
function paintRange(el) {
  const min = Number(el.min) || 0, max = Number(el.max) || 100;
  const pct = ((el.value - min) / (max - min)) * 100;
  el.style.background = `linear-gradient(90deg, var(--accent), var(--accent-2) ${pct}%, rgba(255,255,255,0.09) ${pct}%)`;
}
function energyWord(v) {
  if (v < 28) return "Low"; if (v < 52) return "Mellow"; if (v < 78) return "Medium"; return "High";
}
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2400);
}

function buildVisualizer() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 40; i += 1) {
    const bar = document.createElement("span");
    bar.style.animationDelay = `${(Math.random() * 1.1).toFixed(2)}s`;
    bar.style.animationDuration = `${(0.8 + Math.random() * 0.8).toFixed(2)}s`;
    frag.appendChild(bar);
  }
  visualizer.appendChild(frag);
}

function setPlaying(on) {
  playing = on;
  playUse.setAttribute("href", on ? "#i-stop" : "#i-play");
  playBtn.setAttribute("aria-label", on ? "Stop" : "Play");
  visualizer.classList.toggle("is-playing", on);
  nowLive.classList.toggle("is-on", on);
  nowLive.textContent = on ? "playing" : "paused";
}

// ── Mood cards ─────────────────────────────────────────
function buildMoodCards() {
  for (const key of MOOD_ORDER) {
    const m = MOODS[key];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mood";
    card.dataset.mood = key;
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", "false");
    card.innerHTML = `<span class="mood__emoji">${m.emoji}</span><span class="mood__name">${m.label}</span><span class="mood__desc">${m.desc}</span>`;
    card.addEventListener("click", () => selectMood(key));
    moodGrid.appendChild(card);
  }
  // "More — Surprise me"
  const more = document.createElement("button");
  more.type = "button";
  more.className = "mood";
  more.dataset.mood = "more";
  more.innerHTML = `<span class="mood__emoji">✨</span><span class="mood__name">More</span><span class="mood__desc">Surprise me</span>`;
  more.addEventListener("click", () => {
    const key = MOOD_ORDER[Math.floor(Math.random() * MOOD_ORDER.length)];
    selectMood(key);
    toast(`Surprise: ${MOODS[key].label}`);
  });
  moodGrid.appendChild(more);

  moodGrid.addEventListener("keydown", (ev) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(ev.key)) return;
    ev.preventDefault();
    const i = MOOD_ORDER.indexOf(currentMood);
    const dir = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : -1;
    const next = (i + dir + MOOD_ORDER.length) % MOOD_ORDER.length;
    selectMood(MOOD_ORDER[next]);
    moodGrid.children[next].focus();
  });
}

function selectMood(key, { setTempo = true } = {}) {
  currentMood = key;
  for (const card of moodGrid.children) {
    const on = card.dataset.mood === key;
    card.setAttribute("aria-checked", on ? "true" : "false");
    card.tabIndex = on ? 0 : -1;
  }
  if (setTempo) {
    tempoInput.value = Math.max(50, Math.min(170, MOODS[key].baseTempo));
    paintRange(tempoInput);
    tempoVal.textContent = `${tempoInput.value} BPM`;
  }
}

// ── Chips ──────────────────────────────────────────────
function setupInstrumentChips() {
  for (const chip of instChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      let name = chip.dataset.inst;
      if (name === "More") {
        const real = Object.keys(INSTRUMENTS);
        name = real[Math.floor(Math.random() * real.length)];
        toast(`Instrument: ${name}`);
      }
      instruments = new Set([name]); // single-select: the chosen timbre is what plays
      syncInstrumentChips();
    });
  }
}
function syncInstrumentChips() {
  for (const chip of instChips.querySelectorAll(".chip")) {
    if (chip.dataset.inst === "More") continue;
    chip.classList.toggle("is-on", instruments.has(chip.dataset.inst));
  }
}
function setupDurationChips() {
  for (const chip of durChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      minutes = Number(chip.dataset.min);
      for (const c of durChips.querySelectorAll(".chip")) c.classList.toggle("is-on", c === chip);
    });
  }
}

// ── Generate ───────────────────────────────────────────
function updateNowPlaying(p) {
  trackTitle.textContent = p.mood.title;
  trackSub.textContent = `${p.mood.label} • ${p.instrument} • ${fmtTime(p.minutes)}`;
  generateHelp.textContent = `Composed a ${p.mood.label.toLowerCase()} ${p.instrument} track — ${p.bars} bars at ${p.bpm} BPM.`;
}

function trackRecord(p) {
  return {
    id: String(p.seed), title: p.mood.title, moodKey: p.moodKey, moodLabel: p.mood.label,
    emoji: p.mood.emoji, instrument: p.instrument, bpm: p.bpm, energy: p.energy,
    minutes: p.minutes, seed: p.seed, ts: Date.now(),
  };
}

function recordTrack(p) {
  const rec = trackRecord(p);
  history = [rec, ...history.filter((t) => t.id !== rec.id)].slice(0, 40);
  STORE.save("history", history);
  if (!library.some((t) => t.id === rec.id)) {
    library = [rec, ...library].slice(0, 60);
    STORE.save("library", library);
  }
  if (currentView === "history" || currentView === "library") renderView(currentView);
}

function generate({ play = true } = {}) {
  seedCounter += 1;
  const seed = seedCounter * 7919 + Number(tempoInput.value);
  piece = composePiece({
    moodKey: currentMood, bpm: Number(tempoInput.value), energy: energyN(),
    instrument: primaryInstrument(), minutes, seed,
  });
  piece.id = String(seed);
  updateNowPlaying(piece);
  recordTrack(piece);
  refreshFavBtn();
  if (play) playPiece();
}

function loadTrack(rec, play = true) {
  selectMood(rec.moodKey, { setTempo: false });
  tempoInput.value = rec.bpm; paintRange(tempoInput); tempoVal.textContent = `${rec.bpm} BPM`;
  energyInput.value = Math.round(rec.energy * 100); paintRange(energyInput); energyVal.textContent = energyWord(Number(energyInput.value));
  instruments = new Set([rec.instrument]); syncInstrumentChips();
  minutes = rec.minutes;
  for (const c of durChips.querySelectorAll(".chip")) c.classList.toggle("is-on", Number(c.dataset.min) === minutes);
  piece = composePiece({ moodKey: rec.moodKey, bpm: rec.bpm, energy: rec.energy, instrument: rec.instrument, minutes: rec.minutes, seed: rec.seed });
  piece.id = String(rec.seed);
  updateNowPlaying(piece);
  refreshFavBtn();
  if (play) playPiece();
}

// ── Favorites ──────────────────────────────────────────
const isFav = (id) => favorites.some((t) => t.id === id);
function refreshFavBtn() {
  favBtn.classList.toggle("is-on", !!(piece && isFav(piece.id)));
}
function toggleFavorite() {
  if (!piece) { toast("Generate a track first"); return; }
  if (isFav(piece.id)) {
    favorites = favorites.filter((t) => t.id !== piece.id);
    toast("Removed from Favorites");
  } else {
    favorites = [trackRecord(piece), ...favorites].slice(0, 60);
    toast("Added to Favorites");
  }
  STORE.save("favorites", favorites);
  refreshFavBtn();
  if (currentView === "favorites") renderView("favorites");
}

// ── Wiring ─────────────────────────────────────────────
energyInput.addEventListener("input", () => { paintRange(energyInput); energyVal.textContent = energyWord(Number(energyInput.value)); });
tempoInput.addEventListener("input", () => { paintRange(tempoInput); tempoVal.textContent = `${tempoInput.value} BPM`; });
volumeInput.addEventListener("input", () => { paintRange(volumeInput); if (master) master.gain.value = volumeInput.value / 100; });

generateBtn.addEventListener("click", () => {
  generateBtn.classList.add("is-busy");
  generateHelp.textContent = "Composing…";
  setTimeout(() => { generate({ play: settings.autoplay }); generateBtn.classList.remove("is-busy"); }, 260);
});

playBtn.addEventListener("click", async () => {
  if (playing) { stopPlayback(); setPlaying(false); return; }
  await playPiece();
});
$("prev-btn").addEventListener("click", () => { generate({ play: true }); toast("New variation"); });
$("next-btn").addEventListener("click", () => { generate({ play: true }); toast("New variation"); });

favBtn.addEventListener("click", toggleFavorite);
$("dl-btn").addEventListener("click", () => {
  if (!piece) generate({ play: false });
  try { downloadMidi(); toast("MIDI downloaded"); }
  catch (err) { toast(`Download failed: ${err.message}`); }
});
$("share-btn").addEventListener("click", async () => {
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
    else toast("Copy the URL to share");
  } catch { toast("Copy the URL to share"); }
});
$("list-btn").addEventListener("click", (e) => { e.currentTarget.classList.toggle("is-on"); toast("Added to playlist"); });

$("reset-btn").addEventListener("click", () => {
  energyInput.value = 55; paintRange(energyInput); energyVal.textContent = energyWord(55);
  instruments = new Set(["Piano"]); syncInstrumentChips();
  minutes = 3;
  for (const c of durChips.querySelectorAll(".chip")) c.classList.toggle("is-on", Number(c.dataset.min) === 3);
  selectMood(currentMood);
  toast("Reset to defaults");
});

// scene presets
for (const scene of document.querySelectorAll(".scene")) {
  scene.addEventListener("click", () => {
    const mood = scene.dataset.mood;
    const inst = scene.dataset.inst;
    selectMood(mood);
    if (INSTRUMENTS[inst]) { instruments = new Set([inst]); syncInstrumentChips(); }
    generate({ play: true });
    toast(`Loaded: ${scene.querySelector("strong").textContent}`);
  });
}
$("more-scenes").addEventListener("click", () => { setView("explore"); toast("Explore all moods"); });
document.querySelector(".btn-premium").addEventListener("click", () => toast("✨ Premium is coming soon"));

// ── Views (in-page routing, no backend) ────────────────
function setView(name) {
  currentView = name;
  for (const a of navItems) a.classList.toggle("is-active", a.dataset.view === name);
  if (name === "home") {
    viewHome.hidden = false;
    viewPanel.hidden = true;
    viewPanel.innerHTML = "";
  } else {
    viewHome.hidden = true;
    viewPanel.hidden = false;
    renderView(name);
  }
}

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const findRec = (id) => library.find((t) => t.id === id) || favorites.find((t) => t.id === id) || history.find((t) => t.id === id);
const emptyHTML = (msg) => `<p class="view-empty">${msg}</p>`;
function trackRowHTML(rec, actions = "") {
  return `<li class="track" data-id="${rec.id}" tabindex="0" role="button">
    <span class="track__emoji">${rec.emoji || "🎵"}</span>
    <span class="track__meta"><strong>${rec.title}</strong><small>${rec.moodLabel} • ${rec.instrument} • ${rec.bpm} BPM • ${rec.minutes}:00</small></span>
    <span class="track__actions">${actions}</span></li>`;
}

function renderView(name) {
  if (name === "explore") renderExplore();
  else if (name === "library") renderList("My Library", library, emptyHTML("No tracks yet — generate one from Home."), { download: true });
  else if (name === "favorites") renderList("Favorites", favorites, emptyHTML("Tap the ♥ on a track to save it here."), { unfav: true });
  else if (name === "history") renderHistory();
  else if (name === "settings") renderSettings();
}

const homeBtn = '<button class="ghost-btn" data-action="go-home" type="button">← Home</button>';

function renderExplore() {
  const tiles = MOOD_ORDER.map((k) => {
    const m = MOODS[k];
    return `<button type="button" class="mood" data-explore-mood="${k}"><span class="mood__emoji">${m.emoji}</span><span class="mood__name">${m.label}</span><span class="mood__desc">${m.desc}</span></button>`;
  }).join("");
  viewPanel.innerHTML = `<div class="panel__head"><h2>Explore moods</h2>${homeBtn}</div>
    <p class="view-sub">Tap a mood to compose and play it instantly.</p>
    <div class="moods moods--explore">${tiles}</div>`;
}

function renderList(title, list, empty, opts = {}) {
  const rows = list.length
    ? `<ul class="track-list">${list.map((r) => {
        let acts = "";
        if (opts.download) acts += `<button class="track__btn" data-act="dl" type="button" aria-label="Download MIDI"><svg class="icon"><use href="#i-download"/></svg></button>`;
        if (opts.unfav) acts += `<button class="track__btn is-fav" data-act="unfav" type="button" aria-label="Remove from favorites"><svg class="icon"><use href="#i-heart"/></svg></button>`;
        return trackRowHTML(r, acts);
      }).join("")}</ul>`
    : empty;
  viewPanel.innerHTML = `<div class="panel__head"><h2>${title}</h2>${homeBtn}</div>${rows}`;
}

function renderHistory() {
  const rows = history.length
    ? `<ul class="track-list">${history.map((r) => trackRowHTML(r, `<span class="track__time">${relTime(r.ts)}</span>`)).join("")}</ul>`
    : emptyHTML("Nothing yet — your generated tracks will appear here.");
  const head = `<div class="panel__head"><h2>History</h2><div class="head-actions">${history.length ? '<button class="ghost-btn" data-action="clear-history" type="button">Clear</button>' : ""}${homeBtn}</div></div>`;
  viewPanel.innerHTML = head + rows;
}

function renderSettings() {
  viewPanel.innerHTML = `<div class="panel__head"><h2>Settings</h2>${homeBtn}</div>
    <div class="settings">
      <label class="set-row"><span><strong>Autoplay on generate</strong><small>Start playback as soon as a track is composed</small></span>
        <input type="checkbox" data-setting="autoplay" ${settings.autoplay ? "checked" : ""}></label>
      <label class="set-row"><span><strong>Waveform animation</strong><small>Animate the Now Playing bars</small></span>
        <input type="checkbox" data-setting="waveform" ${settings.waveform ? "checked" : ""}></label>
      <label class="set-row"><span><strong>Default mood</strong><small>Mood selected on load</small></span>
        <select data-setting="defaultMood">${MOOD_ORDER.map((k) => `<option value="${k}" ${settings.defaultMood === k ? "selected" : ""}>${MOODS[k].label}</option>`).join("")}</select></label>
      <label class="set-row"><span><strong>Default duration</strong><small>Track length selected on load</small></span>
        <select data-setting="defaultDuration">${[1, 3, 5, 10, 30].map((m) => `<option value="${m}" ${settings.defaultDuration === m ? "selected" : ""}>${m} min</option>`).join("")}</select></label>
      <div class="set-row set-row--danger"><span><strong>Saved data</strong><small>${library.length} tracks · ${favorites.length} favorites · ${history.length} in history</small></span>
        <button class="ghost-btn" data-action="clear-data" type="button">Clear all</button></div>
    </div>`;
}

function applyWaveformSetting() { visualizer.classList.toggle("no-motion", !settings.waveform); }

viewPanel.addEventListener("click", (e) => {
  const tile = e.target.closest("[data-explore-mood]");
  if (tile) { selectMood(tile.dataset.exploreMood); generate({ play: settings.autoplay }); toast(`Composing ${MOODS[tile.dataset.exploreMood].label}…`); return; }

  const actBtn = e.target.closest("[data-action]");
  if (actBtn) {
    const a = actBtn.dataset.action;
    if (a === "go-home") setView("home");
    else if (a === "clear-history") { history = []; STORE.save("history", history); renderView("history"); toast("History cleared"); }
    else if (a === "clear-data") {
      library = []; favorites = []; history = [];
      STORE.save("library", library); STORE.save("favorites", favorites); STORE.save("history", history);
      refreshFavBtn(); renderView("settings"); toast("All saved data cleared");
    }
    return;
  }

  const row = e.target.closest(".track[data-id]");
  if (!row) return;
  const rec = findRec(row.dataset.id);
  if (!rec) return;
  if (e.target.closest('[data-act="unfav"]')) { favorites = favorites.filter((t) => t.id !== rec.id); STORE.save("favorites", favorites); renderView("favorites"); refreshFavBtn(); toast("Removed from Favorites"); return; }
  if (e.target.closest('[data-act="dl"]')) { loadTrack(rec, false); downloadMidi(); toast("MIDI downloaded"); return; }
  loadTrack(rec, true);
});

viewPanel.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest(".track[data-id]");
  if (!row) return;
  e.preventDefault();
  const rec = findRec(row.dataset.id);
  if (rec) loadTrack(rec, true);
});

viewPanel.addEventListener("change", (e) => {
  const el = e.target.closest("[data-setting]");
  if (!el) return;
  const key = el.dataset.setting;
  if (el.type === "checkbox") settings[key] = el.checked;
  else if (key === "defaultDuration") settings[key] = Number(el.value);
  else settings[key] = el.value;
  STORE.save("settings", settings);
  if (key === "waveform") applyWaveformSetting();
  toast("Setting saved");
});

for (const a of navItems) a.addEventListener("click", (e) => { e.preventDefault(); setView(a.dataset.view); });

// ── Init ───────────────────────────────────────────────
buildMoodCards();
buildVisualizer();
setupInstrumentChips();
setupDurationChips();

minutes = [1, 3, 5, 10, 30].includes(settings.defaultDuration) ? settings.defaultDuration : 3;
for (const c of durChips.querySelectorAll(".chip")) c.classList.toggle("is-on", Number(c.dataset.min) === minutes);
selectMood(MOODS[settings.defaultMood] ? settings.defaultMood : "chill");
applyWaveformSetting();

paintRange(energyInput); energyVal.textContent = energyWord(Number(energyInput.value));
paintRange(volumeInput);
syncInstrumentChips();
setPlaying(false);
