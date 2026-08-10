/**
 * Фоновые звуки синтезируются из шума прямо в браузере.
 * Это даёт бесшовное зацикливание, нулевой вес и работу офлайн —
 * в отличие от mp3-файлов, которые пришлось бы качать и которые щёлкают на стыке петли.
 */

let context = null;
let masterGain = null;
let currentNodes = [];
let currentSound = 'none';
let currentVolume = 0.5;
let noiseBuffer = null;

function ensureContext() {
  if (context) return context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  context = new AudioContextClass();
  masterGain = context.createGain();
  masterGain.gain.value = currentVolume;
  masterGain.connect(context.destination);
  return context;
}

/** Две секунды белого шума — база для всех пресетов; фильтры лепят из неё характер. */
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  const length = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
}

function createNoiseSource(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.loop = true;
  return source;
}

/** Медленная синусоида на громкости — имитирует порывы ветра и накат волн. */
function addSwell(ctx, target, { rate, depth, base }) {
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  target.gain.value = base;

  lfo.connect(lfoGain);
  lfoGain.connect(target.gain);
  lfo.start();

  return lfo;
}

function buildRain(ctx) {
  const source = createNoiseSource(ctx);
  const highpass = ctx.createBiquadFilter();
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  highpass.type = 'highpass';
  highpass.frequency.value = 700;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 6200;
  gain.gain.value = 0.34;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(masterGain);

  const swell = addSwell(ctx, gain, { rate: 0.12, depth: 0.06, base: 0.34 });
  source.start();
  return [source, swell];
}

function buildForest(ctx) {
  const source = createNoiseSource(ctx);
  const bandpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  // Узкая полоса вокруг 1 кГц звучит как шелест листвы.
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1050;
  bandpass.Q.value = 0.8;
  gain.gain.value = 0.24;

  source.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(masterGain);

  const swell = addSwell(ctx, gain, { rate: 0.07, depth: 0.11, base: 0.24 });
  source.start();
  return [source, swell];
}

function buildWaves(ctx) {
  const source = createNoiseSource(ctx);
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  lowpass.type = 'lowpass';
  lowpass.frequency.value = 850;
  gain.gain.value = 0.3;

  source.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(masterGain);

  // Медленный период ≈ 11 секунд — примерно ритм прибоя.
  const swell = addSwell(ctx, gain, { rate: 0.09, depth: 0.22, base: 0.3 });
  source.start();
  return [source, swell];
}

function buildNight(ctx) {
  const source = createNoiseSource(ctx);
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  lowpass.type = 'lowpass';
  lowpass.frequency.value = 380;
  gain.gain.value = 0.26;

  source.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(masterGain);

  // Тихая высокая трель поверх гула — сверчки.
  const cricket = ctx.createOscillator();
  const cricketGain = ctx.createGain();
  cricket.type = 'triangle';
  cricket.frequency.value = 4300;
  cricketGain.gain.value = 0;

  cricket.connect(cricketGain);
  cricketGain.connect(masterGain);

  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  pulse.frequency.value = 2.6;
  pulseGain.gain.value = 0.012;
  pulse.connect(pulseGain);
  pulseGain.connect(cricketGain.gain);

  cricket.start();
  pulse.start();
  source.start();

  return [source, cricket, pulse];
}

const BUILDERS = {
  rain: buildRain,
  forest: buildForest,
  waves: buildWaves,
  night: buildNight
};

function stopNodes() {
  for (const node of currentNodes) {
    try {
      node.stop();
    } catch {
      // Узел уже остановлен — это нормально при быстром переключении.
    }
    node.disconnect?.();
  }
  currentNodes = [];
}

export function isSoundSupported() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

export function getCurrentSound() {
  return currentSound;
}

export async function playAmbient(soundId) {
  const ctx = ensureContext();
  if (!ctx) return { ok: false };

  // Браузер запускает контекст только после жеста пользователя.
  if (ctx.state === 'suspended') await ctx.resume();

  stopNodes();
  currentSound = soundId;

  if (soundId === 'none' || !BUILDERS[soundId]) return { ok: true };

  currentNodes = BUILDERS[soundId](ctx);

  // Плавный вход вместо резкого включения шума в ухо.
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(currentVolume, ctx.currentTime + 1.2);

  return { ok: true };
}

export function stopAmbient() {
  if (!context) return;

  const fadeOut = 0.4;
  masterGain.gain.cancelScheduledValues(context.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, context.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, context.currentTime + fadeOut);

  const nodes = currentNodes;
  currentNodes = [];
  currentSound = 'none';

  setTimeout(() => {
    for (const node of nodes) {
      try {
        node.stop();
      } catch {
        // Уже остановлен.
      }
      node.disconnect?.();
    }
  }, fadeOut * 1000 + 60);
}

export function setVolume(value) {
  currentVolume = Math.max(0, Math.min(1, value));
  if (masterGain && context) {
    masterGain.gain.setTargetAtTime(currentVolume, context.currentTime, 0.08);
  }
}

export function getVolume() {
  return currentVolume;
}

/** Короткий сигнал в конце фазы: два тона вместо резкого будильника. */
export async function playChime({ high = false } = {}) {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();

  const now = ctx.currentTime;
  const frequencies = high ? [880, 1174.7] : [587.3, 880];

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const startAt = now + index * 0.16;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.22, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.85);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.9);
  });
}
