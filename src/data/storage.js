import { STORAGE_KEYS } from '../core/constants.js';

/**
 * localStorage может быть недоступен целиком (Safari в приватном режиме,
 * отключённые cookies, страница в песочнице), поэтому любой доступ к нему
 * оборачивается и деградирует до работы в памяти вместо падения приложения.
 */
function safeLocalStorage() {
  try {
    const probe = '__levelup_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = safeLocalStorage();
const memoryFallback = new Map();

export const storageAvailable = store !== null;

function readRaw(key) {
  if (!store) return memoryFallback.get(key) ?? null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  if (!store) {
    memoryFallback.set(key, value);
    return { ok: true, quotaExceeded: false };
  }
  try {
    store.setItem(key, value);
    return { ok: true, quotaExceeded: false };
  } catch (error) {
    const quotaExceeded = error?.name === 'QuotaExceededError'
      || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || error?.code === 22;
    memoryFallback.set(key, value);
    return { ok: false, quotaExceeded, error };
  }
}

/** Битый или частично записанный JSON не должен превращаться в белый экран. */
export function loadState() {
  const raw = readRaw(STORAGE_KEYS.data);
  if (!raw) return { data: null, corrupted: false };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: null, corrupted: true };
    }
    return { data: parsed, corrupted: false };
  } catch {
    try {
      store?.setItem(`${STORAGE_KEYS.data}-corrupted-${Date.now()}`, raw);
    } catch {
      // Резервную копию сохранить не удалось — продолжаем с чистого состояния.
    }
    return { data: null, corrupted: true };
  }
}

export function persistState(state) {
  return writeRaw(STORAGE_KEYS.data, JSON.stringify(state));
}

/** Мелкие служебные записи (отметки синхронизации) — тем же безопасным путём. */
export function readJson(key, fallback = null) {
  const raw = readRaw(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  return writeRaw(key, JSON.stringify(value));
}

export function readOnboardedFlag() {
  return readRaw(STORAGE_KEYS.onboarded) === '1';
}

export function writeOnboardedFlag(value) {
  if (value) writeRaw(STORAGE_KEYS.onboarded, '1');
  else if (store) {
    try {
      store.removeItem(STORAGE_KEYS.onboarded);
    } catch {
      memoryFallback.delete(STORAGE_KEYS.onboarded);
    }
  } else {
    memoryFallback.delete(STORAGE_KEYS.onboarded);
  }
}

export function clearStoredState() {
  if (!store) {
    memoryFallback.clear();
    return;
  }
  try {
    store.removeItem(STORAGE_KEYS.data);
    store.removeItem(STORAGE_KEYS.onboarded);
    store.removeItem(STORAGE_KEYS.photoSync);
  } catch {
    memoryFallback.clear();
  }
}
