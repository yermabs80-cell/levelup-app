import { AMBIENT_SOUNDS, FOCUS_PRESETS, FOCUS_XP } from '../core/constants.js';
import {
  PHASES,
  PHASE_LABELS,
  createTimer,
  formatClock,
  formatMinutes,
  getPreset,
  isComplete,
  isPaused,
  isRunning,
  nextPhase,
  pause,
  progressPercent,
  remainingMs,
  resume,
  startPhase,
  stop
} from '../core/focus.js';
import {
  getCurrentSound,
  getVolume,
  isSoundSupported,
  playAmbient,
  playChime,
  setVolume,
  stopAmbient
} from '../data/ambient.js';
import { addFocusSession, getFocusStats, getState } from '../data/store.js';
import { $, $$, setText } from './dom.js';
import { html, setHtml } from './html.js';
import { showToast } from './feedback.js';

const CIRCUMFERENCE = 2 * Math.PI * 52;

let timer = createTimer();
let ticker = null;

const PHASE_COLORS = {
  [PHASES.IDLE]: '#4de0ff',
  [PHASES.FOCUS]: '#4de0ff',
  [PHASES.BREAK]: '#4ade80',
  [PHASES.LONG_BREAK]: '#a78bfa'
};

function phaseColor() {
  return PHASE_COLORS[timer.phase] ?? PHASE_COLORS[PHASES.IDLE];
}

function displayMs() {
  if (timer.phase === PHASES.IDLE) return getPreset(timer.presetId).focus * 60_000;
  return remainingMs(timer);
}

export function renderFocus() {
  renderControls();
  renderDial();
  renderStats();
}

function renderDial() {
  const label = $('#focusClock');
  if (label) label.textContent = formatClock(displayMs());

  const phaseLabel = $('#focusPhase');
  if (phaseLabel) phaseLabel.textContent = PHASE_LABELS[timer.phase];

  const ring = $('#focusProgressRing');
  if (ring) {
    const percent = timer.phase === PHASES.IDLE ? 0 : progressPercent(timer);
    ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - percent / 100));
    ring.style.stroke = phaseColor();
  }

  const dial = $('#focusDial');
  if (dial) {
    dial.style.setProperty('--focus-color', phaseColor());
    dial.classList.toggle('running', isRunning(timer));
    dial.classList.toggle('paused', isPaused(timer));
  }

  const hint = $('#focusHint');
  if (hint) {
    const preset = getPreset(timer.presetId);
    if (timer.phase === PHASES.IDLE) {
      hint.textContent = `${preset.focus} минут работы, затем ${preset.break} минут отдыха`;
    } else if (timer.phase === PHASES.FOCUS) {
      hint.textContent = 'Убери телефон и закрой лишние вкладки';
    } else {
      hint.textContent = 'Встань, разомнись и посмотри вдаль';
    }
  }
}

function renderControls() {
  const primary = $('#focusPrimaryBtn');
  if (primary) {
    if (timer.phase === PHASES.IDLE) primary.textContent = 'Начать фокус';
    else if (isPaused(timer)) primary.textContent = 'Продолжить';
    else primary.textContent = 'Пауза';
  }

  const stopBtn = $('#focusStopBtn');
  if (stopBtn) stopBtn.hidden = timer.phase === PHASES.IDLE;

  const skipBtn = $('#focusSkipBtn');
  if (skipBtn) skipBtn.hidden = timer.phase === PHASES.IDLE;

  buildPresets();
  for (const button of $$('#focusPresets [data-focus-preset]')) {
    button.classList.toggle('active', button.dataset.focusPreset === timer.presetId);
    button.disabled = timer.phase !== PHASES.IDLE;
  }

  buildSounds();
  const activeSound = getCurrentSound();
  for (const button of $$('#focusSounds [data-focus-sound]')) {
    const on = button.dataset.focusSound === activeSound;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// Кнопки строятся один раз: дальше renderControls переключает только классы,
// иначе пересборка innerHTML на каждый тик сбрасывала бы фокус и hover.
function buildPresets() {
  const host = $('#focusPresets');
  if (!host || host.dataset.built === '1') return;
  setHtml(host, FOCUS_PRESETS.map(preset => html`
    <button type="button" class="focus-preset" data-focus-preset="${preset.id}">
      <b>${preset.title}</b>
      <small>${preset.subtitle}</small>
    </button>
  `));
  host.dataset.built = '1';
}

function buildSounds() {
  const host = $('#focusSounds');
  if (!host || host.dataset.built === '1') return;
  setHtml(host, AMBIENT_SOUNDS.map(sound => html`
    <button type="button" class="focus-sound" data-focus-sound="${sound.id}" aria-pressed="false">
      <span aria-hidden="true">${sound.icon}</span>
      ${sound.title}
    </button>
  `));
  host.dataset.built = '1';
}

function renderStats() {
  const stats = getFocusStats(getState());
  setText('#focusTodayCount', stats.today.sessions);
  setText('#focusTodayMinutes', formatMinutes(stats.today.minutes));
  setText('#focusTotalCount', stats.total.sessions);
  setText('#focusTotalMinutes', formatMinutes(stats.total.minutes));

  const cycle = $('#focusCycle');
  if (cycle) {
    const preset = getPreset(timer.presetId);
    const position = preset.longBreakEvery > 0
      ? (timer.completedFocusRuns % preset.longBreakEvery) + (timer.phase === PHASES.FOCUS ? 1 : 0)
      : 0;

    setHtml(cycle, Array.from({ length: preset.longBreakEvery }, (_unused, index) => html`
      <span class="cycle-dot ${index < position ? 'filled' : ''}" aria-hidden="true"></span>
    `));
  }
}

function startTicking() {
  stopTicking();
  ticker = setInterval(() => {
    if (isComplete(timer)) {
      completePhase();
      return;
    }
    renderDial();
  }, 250);
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
}

function completePhase() {
  const finishedPhase = timer.phase;
  const preset = getPreset(timer.presetId);

  if (finishedPhase === PHASES.FOCUS) {
    addFocusSession({ minutes: preset.focus, xp: FOCUS_XP.perSession });
    timer = { ...timer, completedFocusRuns: timer.completedFocusRuns + 1 };
  }

  const upcoming = nextPhase(timer);
  timer = startPhase(timer, upcoming);
  playChime({ high: finishedPhase !== PHASES.FOCUS });

  const message = finishedPhase === PHASES.FOCUS
    ? `Сессия завершена · +${FOCUS_XP.perSession} XP к дисциплине`
    : 'Перерыв окончен — возвращайся к работе';

  showToast(message, { type: 'success', duration: 4000 });
  notify(finishedPhase === PHASES.FOCUS ? 'Время отдохнуть' : 'Пора работать', message);

  renderFocus();
}

function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  new Notification(title, { body, icon: './icon.svg', tag: 'ethos-focus' });
}

function togglePrimary() {
  if (timer.phase === PHASES.IDLE) {
    timer = startPhase(timer, PHASES.FOCUS);
    startTicking();
    requestNotificationPermission();
  } else if (isPaused(timer)) {
    timer = resume(timer);
    startTicking();
  } else {
    timer = pause(timer);
    stopTicking();
  }

  renderFocus();
}

function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  Notification.requestPermission().catch(() => null);
}

function stopTimer() {
  timer = stop(timer);
  stopTicking();
  renderFocus();
}

function skipPhase() {
  // Пропуск не засчитывает сессию: XP даётся только за отработанное время.
  const upcoming = nextPhase(timer);
  timer = startPhase(timer, upcoming);
  if (!ticker) startTicking();
  renderFocus();
  showToast(`Переключено на: ${PHASE_LABELS[upcoming].toLowerCase()}`);
}

export function bindFocus() {
  $('#focusPrimaryBtn')?.addEventListener('click', togglePrimary);
  $('#focusStopBtn')?.addEventListener('click', stopTimer);
  $('#focusSkipBtn')?.addEventListener('click', skipPhase);

  $('#focusPresets')?.addEventListener('click', event => {
    const button = event.target.closest('[data-focus-preset]');
    if (!button || timer.phase !== PHASES.IDLE) return;
    timer = { ...timer, presetId: button.dataset.focusPreset };
    renderFocus();
  });

  $('#focusSounds')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-focus-sound]');
    if (!button) return;

    const soundId = button.dataset.focusSound;

    if (!isSoundSupported()) {
      showToast('Браузер не поддерживает фоновые звуки', { type: 'error' });
      return;
    }

    if (soundId === 'none' || soundId === getCurrentSound()) {
      stopAmbient();
    } else {
      await playAmbient(soundId);
    }

    renderControls();
  });

  const volume = $('#focusVolume');
  if (volume) {
    volume.value = String(Math.round(getVolume() * 100));
    volume.addEventListener('input', () => setVolume(Number(volume.value) / 100));
  }

  // Вкладку могли свернуть на час: пересчитываем состояние по возвращении.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (isComplete(timer)) completePhase();
    else renderDial();
  });
}

export function focusRingCircumference() {
  return CIRCUMFERENCE;
}
