export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = String(value);
}

export function setWidth(selector, percent) {
  const element = $(selector);
  if (element) element.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

export function toggleHidden(selector, hidden) {
  const element = $(selector);
  if (element) element.hidden = Boolean(hidden);
}

/**
 * Делегирование событий: один слушатель на документ вместо переподписки
 * после каждой перерисовки.
 */
export function delegate(eventName, selector, handler, root = document) {
  root.addEventListener(eventName, event => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

export function openDialog(selector) {
  const dialog = $(selector);
  if (dialog && !dialog.open) dialog.showModal();
  return dialog;
}

export function closeDialog(selector) {
  const dialog = $(selector);
  if (dialog?.open) dialog.close();
  return dialog;
}

export function formatMoney(amount) {
  return `${new Intl.NumberFormat('ru-RU').format(amount)} ₸`;
}

export function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date);
}

export function initials(name) {
  const parts = String(name || 'Охотник').trim().split(/\s+/).slice(0, 2);
  const letters = parts.map(part => part[0]?.toUpperCase() ?? '').join('');
  return letters || 'ОХ';
}

/** Пропускает кадр, чтобы браузер применил свежую разметку до анимации. */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
