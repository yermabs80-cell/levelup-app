import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PHASES,
  createTimer,
  formatClock,
  getPreset,
  isComplete,
  isPaused,
  isRunning,
  nextPhase,
  pause,
  phaseDuration,
  progressPercent,
  remainingMs,
  resume,
  startPhase,
  stop
} from '../src/core/focus.js';

const NOW = 1_800_000_000_000;

test('форматирование циферблата', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(25 * 60_000), '25:00');
  assert.equal(formatClock(24 * 60_000 + 59_999), '25:00', 'округляется вверх, чтобы не показывать 00:00 при старте');
  assert.equal(formatClock(90 * 60_000 + 1000), '90:01');
});

test('длительность фаз зависит от пресета', () => {
  const classic = getPreset('classic');
  const deep = getPreset('deep');

  assert.equal(phaseDuration(PHASES.FOCUS, classic), 25 * 60_000);
  assert.equal(phaseDuration(PHASES.BREAK, classic), 5 * 60_000);
  assert.equal(phaseDuration(PHASES.FOCUS, deep), 50 * 60_000);
  assert.equal(phaseDuration(PHASES.LONG_BREAK, deep), 25 * 60_000);
  assert.equal(phaseDuration(PHASES.IDLE, classic), 0);
});

test('таймер считает от меток времени и не отстаёт в фоне', () => {
  const timer = startPhase(createTimer(), PHASES.FOCUS, NOW);

  // «Свернули вкладку» на 12 минут: браузер душил тики, но расчёт точный.
  const later = NOW + 12 * 60_000;
  assert.equal(isRunning(timer), true);
  assert.equal(remainingMs(timer, later), 13 * 60_000);
  assert.equal(isComplete(timer, later), false);

  const finished = NOW + 25 * 60_000;
  assert.equal(remainingMs(timer, finished), 0);
  assert.equal(isComplete(timer, finished), true);
});

test('пауза останавливает отсчёт', () => {
  const started = startPhase(createTimer(), PHASES.FOCUS, NOW);
  const paused = pause(started, NOW + 10 * 60_000);

  assert.equal(isPaused(paused), true);
  assert.equal(isRunning(paused), false);
  assert.equal(remainingMs(paused, NOW + 10 * 60_000), 15 * 60_000);
  assert.equal(remainingMs(paused, NOW + 20 * 60_000), 15 * 60_000, 'на паузе время не уходит');

  const resumed = resume(paused, NOW + 20 * 60_000);
  assert.equal(isRunning(resumed), true);
  assert.equal(remainingMs(resumed, NOW + 25 * 60_000), 10 * 60_000, 'отсчёт продолжается с места паузы');
});

test('смена фаз: после четвёртой сессии — длинный перерыв', () => {
  let timer = startPhase(createTimer(), PHASES.FOCUS, NOW);

  for (let run = 1; run <= 3; run += 1) {
    timer = { ...timer, completedFocusRuns: run };
    assert.equal(nextPhase(timer), PHASES.BREAK, `после ${run}-й сессии — короткий перерыв`);
  }

  timer = { ...timer, completedFocusRuns: 4 };
  assert.equal(nextPhase(timer), PHASES.LONG_BREAK);

  timer = startPhase(timer, PHASES.LONG_BREAK, NOW);
  assert.equal(nextPhase(timer), PHASES.FOCUS, 'после длинного перерыва — снова фокус');
});

test('прогресс кольца', () => {
  const timer = startPhase(createTimer(), PHASES.FOCUS, NOW);
  assert.equal(progressPercent(timer, NOW), 0);
  assert.equal(progressPercent(timer, NOW + 12.5 * 60_000), 50);
  assert.equal(progressPercent(timer, NOW + 25 * 60_000), 100);
  assert.ok(progressPercent(timer, NOW + 30 * 60_000) <= 100, 'не выходит за 100');
});

test('обратный скачок системных часов не растягивает фазу', () => {
  // NTP-коррекция или смена часового пояса могут сдвинуть Date.now() назад.
  const timer = startPhase(createTimer(), PHASES.FOCUS, NOW);
  const backwards = NOW - 10 * 60_000;

  assert.equal(remainingMs(timer, backwards), 25 * 60_000, 'остаток не больше длительности фазы');
  assert.equal(progressPercent(timer, backwards), 0);
  assert.equal(isComplete(timer, backwards), false);
});

test('стоп возвращает в ожидание, сброс таймера не теряет пресет', () => {
  const timer = startPhase(createTimer({ preset: 'deep' }), PHASES.FOCUS, NOW);
  const idle = stop(timer);

  assert.equal(idle.phase, PHASES.IDLE);
  assert.equal(idle.presetId, 'deep');
  assert.equal(remainingMs(idle), 0);
});
