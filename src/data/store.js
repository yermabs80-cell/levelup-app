import { COLLECTIONS, FOCUS_XP } from '../core/constants.js';
import { createSeed, normalize, questKey, todayKey } from '../core/schema.js';
import { mergeStates } from '../core/merge.js';
import {
  clearStoredState,
  loadState,
  persistState,
  readOnboardedFlag,
  writeOnboardedFlag
} from './storage.js';

const listeners = new Set();
let state = createSeed();
let quotaWarned = false;

export const storeEvents = {
  QUESTS: 'quests',
  TASKS: 'tasks',
  SCHEDULE: 'schedule',
  MONEY: 'money',
  PROFILE: 'profile',
  PROGRESS: 'progress',
  FOCUS: 'focus',
  ALL: 'all'
};

/** Подписчики получают набор изменившихся областей, чтобы перерисовать только их. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(scopes) {
  const payload = new Set(Array.isArray(scopes) ? scopes : [scopes]);
  for (const listener of listeners) listener(payload, state);
}

export function getState() {
  return state;
}

let onQuotaExceeded = null;
export function setQuotaHandler(handler) {
  onQuotaExceeded = handler;
}

let onPersist = null;
export function setPersistHandler(handler) {
  onPersist = handler;
}

function persist({ sync = true } = {}) {
  state.updatedAt = Date.now();
  const result = persistState(state);

  if (!result.ok && result.quotaExceeded && !quotaWarned) {
    quotaWarned = true;
    onQuotaExceeded?.();
  }

  if (sync) onPersist?.(state);
  return result;
}

function commit(scopes, { sync = true } = {}) {
  persist({ sync });
  notify(scopes);
}

export function hydrate() {
  const { data, corrupted } = loadState();
  state = normalize(data);

  if (!state.onboarded && readOnboardedFlag()) state.onboarded = true;
  if (state.onboarded) writeOnboardedFlag(true);

  notify([storeEvents.ALL]);
  return { corrupted, legacyPhotos: data?.photos ?? null, migratedFromV1: Boolean(data) && Number(data.schemaVersion || 1) < 2 };
}

export function replaceState(next, { sync = false } = {}) {
  state = normalize(next);
  if (state.onboarded) writeOnboardedFlag(true);
  commit([storeEvents.ALL], { sync });
}

export function mergeRemote(remote) {
  state = mergeStates(state, remote);
  if (state.onboarded) writeOnboardedFlag(true);
  commit([storeEvents.ALL], { sync: true });
}

export function resetAll() {
  state = createSeed();
  clearStoredState();
  writeOnboardedFlag(false);
  commit([storeEvents.ALL], { sync: true });
}

/**
 * Пустое имя — ошибка валидации, а не повод подставить DEFAULT_NAME.
 * Молчаливый фолбэк как раз и приводил к тому, что у всех был «Охотник»:
 * поле в онбординге не было обязательным, и незаполненное значение
 * превращалось в имя, которое потом уезжало в профиль Firebase.
 */
export function setName(name) {
  const clean = String(name || '').trim().slice(0, 24);
  if (!clean) return { ok: false, reason: 'empty-name' };

  state.name = clean;
  state.onboarded = true;
  writeOnboardedFlag(true);
  commit([storeEvents.PROFILE]);
  return { ok: true, name: clean };
}

export function markOnboarded() {
  state.onboarded = true;
  writeOnboardedFlag(true);
  commit([storeEvents.PROFILE]);
}

/**
 * Ежедневный сброс больше не стирает флаги: отметки живут в журнале по дате,
 * поэтому «новый день» — это просто другой ключ, а история остаётся целой.
 */
export function rollOverDay() {
  const day = todayKey();
  if (state.lastDay === day) return false;
  state.lastDay = day;
  commit([storeEvents.PROGRESS], { sync: false });
  return true;
}

function collectionKey(type) {
  return COLLECTIONS[type] ?? null;
}

/** Явная карта: вычислять имя события из типа нельзя — «task» дало бы TASK вместо TASKS. */
const SCOPE_BY_TYPE = {
  quest: storeEvents.QUESTS,
  task: storeEvents.TASKS,
  schedule: storeEvents.SCHEDULE,
  money: storeEvents.MONEY
};

export function addItem(type, payload) {
  const key = collectionKey(type);
  if (!key) return { ok: false, reason: 'unknown-type' };

  const title = String(payload.title || '').trim().slice(0, 80);
  if (!title) return { ok: false, reason: 'empty-title' };

  if (type === 'quest' || type === 'task') {
    const duplicate = state[key].some(item => questKey(item.title) === questKey(title));
    if (duplicate) return { ok: false, reason: 'duplicate' };
  }

  const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const item = { id, title };

  if (type === 'quest') {
    item.stat = payload.stat;
    item.xp = Math.max(1, Math.round(Number(payload.xp) || 15));
  }
  if (type === 'schedule') item.time = payload.time || '09:00';
  if (type === 'money') {
    item.type = payload.type === 'income' ? 'income' : 'expense';
    item.amount = Math.max(1, Math.round(Number(payload.amount) || 0));
    item.date = todayKey();
  }

  state[key].push(item);
  commit([SCOPE_BY_TYPE[type], storeEvents.PROGRESS]);
  return { ok: true, item };
}

export function removeItem(type, id) {
  const key = collectionKey(type);
  if (!key) return { ok: false };

  const before = state[key].length;
  state[key] = state[key].filter(item => item.id !== id);
  if (state[key].length === before) return { ok: false };

  commit([SCOPE_BY_TYPE[type], storeEvents.PROGRESS]);
  return { ok: true };
}

/**
 * Отметка квеста пишет запись в журнал за конкретный день.
 * Снятие отметки удаляет её же — опыт всегда согласован с журналом,
 * поэтому «начислил и удалил квест» больше не оставляет лишний XP.
 */
export function toggleQuest(id) {
  const quest = state.quests.find(item => item.id === id);
  if (!quest) return { ok: false };

  const day = todayKey();
  const key = questKey(quest.title);
  state.completions[day] ??= {};

  const wasDone = Boolean(state.completions[day][key]);
  if (wasDone) {
    delete state.completions[day][key];
    if (Object.keys(state.completions[day]).length === 0) delete state.completions[day];
  } else {
    state.completions[day][key] = { stat: quest.stat, xp: quest.xp };
  }

  commit([storeEvents.QUESTS, storeEvents.PROGRESS]);
  return { ok: true, done: !wasDone, quest };
}

export function toggleTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return { ok: false };

  const day = todayKey();
  const key = questKey(task.title);
  state.taskDone[day] ??= {};

  const wasDone = state.taskDone[day][key] === true;
  if (wasDone) {
    delete state.taskDone[day][key];
    if (Object.keys(state.taskDone[day]).length === 0) delete state.taskDone[day];
  } else {
    state.taskDone[day][key] = true;
  }

  commit([storeEvents.TASKS]);
  return { ok: true, done: !wasDone };
}

export function hasItemWithTitle(type, title) {
  const key = collectionKey(type);
  if (!key) return false;
  return state[key].some(item => questKey(item.title) === questKey(title));
}

/**
 * Завершённая сессия фокуса записывается в тот же журнал, что и квесты:
 * у каждой свой ключ, поэтому опыт не задваивается при синхронизации,
 * но несколько сессий за день считаются каждая отдельно.
 */
export function addFocusSession({ minutes, xp }) {
  const day = todayKey();
  const index = (state.focusSessions ?? []).filter(session => session.day === day).length + 1;
  const id = `${day}-${index}`;

  state.focusSessions = [...(state.focusSessions ?? []), { id, day, minutes }];

  state.completions[day] ??= {};
  state.completions[day][`@focus-${index}`] = { stat: FOCUS_XP.stat, xp };

  commit([storeEvents.PROGRESS, storeEvents.FOCUS]);
  return { ok: true, id };
}

export function getFocusStats(source = state) {
  const day = todayKey();
  const sessions = source.focusSessions ?? [];
  const todaySessions = sessions.filter(session => session.day === day);

  return {
    today: {
      sessions: todaySessions.length,
      minutes: todaySessions.reduce((sum, session) => sum + session.minutes, 0)
    },
    total: {
      sessions: sessions.length,
      minutes: sessions.reduce((sum, session) => sum + session.minutes, 0)
    }
  };
}

export function cloudPayload() {
  const { legacyStreak: _legacyStreak, ...payload } = state;
  return payload;
}
