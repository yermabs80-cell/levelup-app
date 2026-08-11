/**
 * Фоновые звуки синтезируются из шума прямо в браузере.
 * Это даёт бесшовное зацикливание, нулевой вес и работу офлайн —
 * в отличие от mp3-файлов, которые пришлось бы качать и которые щёлкают на стыке петли.
 *
 * Весь характер звука задаётся числами в AMBIENT_CONFIG ниже: чтобы сделать дождь
 * глуше — опусти lowpass, чтобы волны накатывали реже — уменьши swell.rate.
 * Логику ниже при этом трогать не нужно.
 *
 * ── Если однажды понадобятся настоящие записи ──────────────────────────────
 * Положи файлы в audio/rain.mp3 и т. д., замени в пресете `filters`/`swell`
 * на `file: './audio/rain.mp3'`, а в buildPreset() добавь ветку:
 *
 *   if (recipe.file) {
 *     const element = new Audio(recipe.file);
 *     element.loop = true;
 *     const source = ctx.createMediaElementSource(element);
 *     source.connect(gain);
 *     element.play();
 *     return [{ stop: () => element.pause(), disconnect: () => source.disconnect() }];
 *   }
 *
 * Тогда же понадобится лицензия на записи (CC0 или коммерческая) — особенно
 * перед публикацией в Play Market, и вес приложения вырастет с килобайт до мегабайт.
 */

export const AMBIENT_CONFIG = {
  /** Длина буфера белого шума. Две секунды — компромисс между памятью и «неповторяемостью». */
  noiseSeconds: 2,

  /** Плавный вход и выход вместо резкого шума в ухо. */
  fadeInSeconds: 1.2,
  fadeOutSeconds: 0.4,

  /**
   * Пресеты. `gain` — базовая громкость шума после фильтров, она же центр качания
   * для `swell`. `filters` включаются в цепочку в порядке объявления.
   * `swell` — медленная синусоида на громкости (порывы ветра, накат волн):
   * rate в герцах (0.09 Гц ≈ период 11 секунд), depth — размах вокруг gain.
   */
  presets: {
    rain: {
      gain: 0.34,
      filters: [
        { type: 'highpass', frequency: 700 },
        { type: 'lowpass', frequency: 6200 }
      ],
      swell: { rate: 0.12, depth: 0.06 }
    },
    forest: {
      // Узкая полоса вокруг 1 кГц звучит как шелест листвы.
      gain: 0.24,
      filters: [{ type: 'bandpass', frequency: 1050, q: 0.8 }],
      swell: { rate: 0.07, depth: 0.11 }
    },
    waves: {
      gain: 0.3,
      filters: [{ type: 'lowpass', frequency: 850 }],
      swell: { rate: 0.09, depth: 0.22 }
    },
    night: {
      gain: 0.26,
      filters: [{ type: 'lowpass', frequency: 380 }],
      // Тихая высокая трель поверх низкого гула — сверчки.
      chirp: { type: 'triangle', frequency: 4300, pulseRate: 2.6, pulseDepth: 0.012 }
    }
  },

  /** Сигнал в конце фазы: два тона вместо резкого будильника. */
  chime: {
    low: [587.3, 880],
    high: [880, 1174.7],
    peak: 0.22,
    stepSeconds: 0.16,
    tailSeconds: 0.85
  }
};

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

/** База для всех пресетов; фильтры лепят из неё характер. */
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  const length = Math.round(ctx.sampleRate * AMBIENT_CONFIG.noiseSeconds);
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
function addSwell(ctx, target, { rate, depth }) {
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;

  lfo.connect(lfoGain);
  lfoGain.connect(target.gain);
  lfo.start();

  return lfo;
}

/** Пульсирующий тон поверх шума: громкость трели качает второй осциллятор. */
function addChirp(ctx, { type, frequency, pulseRate, pulseDepth }) {
  const voice = ctx.createOscillator();
  const voiceGain = ctx.createGain();

  voice.type = type;
  voice.frequency.value = frequency;
  voiceGain.gain.value = 0;

  voice.connect(voiceGain);
  voiceGain.connect(masterGain);

  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();

  pulse.frequency.value = pulseRate;
  pulseGain.gain.value = pulseDepth;
  pulse.connect(pulseGain);
  pulseGain.connect(voiceGain.gain);

  voice.start();
  pulse.start();

  return [voice, pulse];
}

/** Одна сборка для всех пресетов: разница между ними — только числа в конфиге. */
function buildPreset(ctx, recipe) {
  const source = createNoiseSource(ctx);
  const gain = ctx.createGain();
  gain.gain.value = recipe.gain;

  let node = source;
  for (const spec of recipe.filters ?? []) {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    if (spec.q !== undefined) filter.Q.value = spec.q;
    node.connect(filter);
    node = filter;
  }

  node.connect(gain);
  gain.connect(masterGain);

  const nodes = [source];
  if (recipe.swell) nodes.push(addSwell(ctx, gain, recipe.swell));
  if (recipe.chirp) nodes.push(...addChirp(ctx, recipe.chirp));

  source.start();
  return nodes;
}

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

  const recipe = AMBIENT_CONFIG.presets[soundId];
  if (soundId === 'none' || !recipe) return { ok: true };

  currentNodes = buildPreset(ctx, recipe);

  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(currentVolume, ctx.currentTime + AMBIENT_CONFIG.fadeInSeconds);

  return { ok: true };
}

export function stopAmbient() {
  if (!context) return;

  const fadeOut = AMBIENT_CONFIG.fadeOutSeconds;
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

/** Короткий сигнал в конце фазы. */
export async function playChime({ high = false } = {}) {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();

  const { low, high: highTones, peak, stepSeconds, tailSeconds } = AMBIENT_CONFIG.chime;
  const now = ctx.currentTime;
  const frequencies = high ? highTones : low;

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const startAt = now + index * stepSeconds;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tailSeconds);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tailSeconds + 0.05);
  });
}
