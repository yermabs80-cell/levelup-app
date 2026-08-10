import { FOCUS_PRESETS } from './constants.js';

export const PHASES = {
  IDLE: 'idle',
  FOCUS: 'focus',
  BREAK: 'break',
  LONG_BREAK: 'longBreak'
};

export const PHASE_LABELS = {
  [PHASES.IDLE]: 'Готов к работе',
  [PHASES.FOCUS]: 'Фокус',
  [PHASES.BREAK]: 'Короткий перерыв',
  [PHASES.LONG_BREAK]: 'Длинный перерыв'
};

export function getPreset(presetId) {
  return FOCUS_PRESETS.find(preset => preset.id === presetId) ?? FOCUS_PRESETS[0];
}

export function phaseDuration(phase, preset) {
  if (phase === PHASES.FOCUS) return preset.focus * 60_000;
  if (phase === PHASES.BREAK) return preset.break * 60_000;
  if (phase === PHASES.LONG_BREAK) return preset.longBreak * 60_000;
  return 0;
}

/**
 * Таймер считается от меток времени, а не вычитанием из счётчика по тику.
 * Браузер душит setInterval в фоновой вкладке до одного срабатывания в минуту,
 * поэтому подход «отнимаем секунду каждую секунду» отстаёт на десятки минут.
 */
export function createTimer({ preset = FOCUS_PRESETS[0].id } = {}) {
  return {
    presetId: preset,
    phase: PHASES.IDLE,
    startedAt: 0,
    // Накопленная пауза: сколько миллисекунд таймер простоял на паузе.
    pausedAt: 0,
    elapsedBeforePause: 0,
    completedFocusRuns: 0
  };
}

export function isRunning(timer) {
  return timer.phase !== PHASES.IDLE && timer.pausedAt === 0;
}

export function isPaused(timer) {
  return timer.phase !== PHASES.IDLE && timer.pausedAt > 0;
}

export function elapsedMs(timer, now = Date.now()) {
  if (timer.phase === PHASES.IDLE) return 0;
  if (timer.pausedAt > 0) return timer.elapsedBeforePause;
  // Системные часы могут прыгнуть назад (коррекция NTP, смена пояса).
  // Отрицательное «прошло» дало бы остаток больше длительности фазы.
  const sinceStart = Math.max(0, now - timer.startedAt);
  return timer.elapsedBeforePause + sinceStart;
}

export function remainingMs(timer, now = Date.now()) {
  const total = phaseDuration(timer.phase, getPreset(timer.presetId));
  const left = total - elapsedMs(timer, now);
  return Math.min(total, Math.max(0, left));
}

export function progressPercent(timer, now = Date.now()) {
  const total = phaseDuration(timer.phase, getPreset(timer.presetId));
  if (total === 0) return 0;
  return Math.min(100, (elapsedMs(timer, now) / total) * 100);
}

export function isComplete(timer, now = Date.now()) {
  return timer.phase !== PHASES.IDLE && remainingMs(timer, now) === 0;
}

export function startPhase(timer, phase, now = Date.now()) {
  return { ...timer, phase, startedAt: now, pausedAt: 0, elapsedBeforePause: 0 };
}

export function pause(timer, now = Date.now()) {
  if (!isRunning(timer)) return timer;
  return { ...timer, pausedAt: now, elapsedBeforePause: elapsedMs(timer, now) };
}

export function resume(timer, now = Date.now()) {
  if (!isPaused(timer)) return timer;
  return { ...timer, startedAt: now, pausedAt: 0 };
}

export function stop(timer) {
  return { ...timer, phase: PHASES.IDLE, startedAt: 0, pausedAt: 0, elapsedBeforePause: 0 };
}

/** Какая фаза идёт следом: после каждой четвёртой сессии — длинный перерыв. */
export function nextPhase(timer) {
  const preset = getPreset(timer.presetId);

  if (timer.phase === PHASES.FOCUS) {
    // completedFocusRuns уже увеличен к моменту вызова — после 1-й сессии
    // короткий перерыв, после 4-й длинный.
    const longBreakDue = preset.longBreakEvery > 0
      && timer.completedFocusRuns > 0
      && timer.completedFocusRuns % preset.longBreakEvery === 0;
    return longBreakDue ? PHASES.LONG_BREAK : PHASES.BREAK;
  }

  return PHASES.FOCUS;
}

export function formatClock(milliseconds) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}
