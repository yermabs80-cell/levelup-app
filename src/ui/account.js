import { describeAuthError } from '../data/cloud.js';
import { $, closeDialog, initials, toggleHidden } from './dom.js';
import { html, setHtml } from './html.js';
import { showToast } from './feedback.js';

const SYNC_LABELS = {
  local: 'Локально',
  syncing: 'Синхронизация…',
  synced: 'Сохранено в облаке',
  error: 'Ошибка синхронизации',
  unavailable: 'Облако недоступно',
  'signed-out': 'Вход не выполнен'
};

let syncStatus = 'local';

export function setSyncStatus(status) {
  syncStatus = status;
}

function setAvatar(element, user, name) {
  if (!element) return;

  if (user?.photoURL) {
    setHtml(element, html`<img src="${user.photoURL}" alt="" referrerpolicy="no-referrer">`);
  } else {
    element.textContent = initials(name);
  }
}

export function renderAccount({ state, cloud }) {
  const user = cloud.user;
  const displayName = user?.displayName || state.name;
  const configured = cloud.configured;

  const statusText = user
    ? (SYNC_LABELS[syncStatus] ?? 'Облако подключено')
    : (configured ? 'Вход не выполнен' : 'Firebase не настроен');

  const label = $('#accountLabel');
  if (label) label.textContent = user ? displayName : 'Гость';

  const status = $('#cloudStatus');
  if (status) status.textContent = statusText;

  const modalName = $('#accountModalName');
  if (modalName) modalName.textContent = user ? displayName : 'Локальный профиль';

  const modalEmail = $('#accountModalEmail');
  if (modalEmail) modalEmail.textContent = user?.email || 'Данные хранятся только на этом устройстве';

  const syncTitle = $('#syncTitle');
  if (syncTitle) syncTitle.textContent = statusText;

  const syncDescription = $('#syncDescription');
  if (syncDescription) {
    syncDescription.textContent = user
      ? 'Прогресс синхронизируется между устройствами автоматически'
      : (cloud.canUseGoogle
        ? 'Войди, чтобы прогресс сохранялся в облаке'
        : 'Открой приложение по http://localhost, чтобы включить облако');
  }

  const indicator = $('#syncIndicator');
  if (indicator) indicator.className = `sync-dot ${user ? syncStatus : 'local'}`;

  toggleHidden('#accountAuthSection', Boolean(user));
  toggleHidden('#accountSignedIn', !user);

  setAvatar($('#accountAvatar'), user, displayName);
  setAvatar($('#accountModalAvatar'), user, displayName);
}

export function setAuthMessage(target, message, type = '') {
  const element = $(target);
  if (!element) return;
  element.textContent = message;
  element.className = `auth-message ${type}`.trim();
}

/** Переключение между вкладками «Вход» и «Регистрация». */
export function setAuthMode(scope, mode) {
  const root = $(scope);
  if (!root) return;

  root.dataset.authMode = mode;

  for (const button of root.querySelectorAll('[data-auth-tab]')) {
    const active = button.dataset.authTab === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }

  const nameField = root.querySelector('[data-auth-name]');
  if (nameField) {
    nameField.hidden = mode !== 'register';

    // required на скрытом поле ломает вход: браузер отказывается отправлять форму
    // и пытается сфокусировать невидимый input, не показав никакого сообщения.
    const nameInput = nameField.querySelector('input');
    if (nameInput) nameInput.required = mode === 'register';
  }

  const submit = root.querySelector('[data-auth-submit]');
  if (submit) submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';

  const password = root.querySelector('input[type="password"]');
  if (password) {
    // Менеджер паролей должен предлагать новый пароль при регистрации
    // и подставлять сохранённый при входе.
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  }

  const reset = root.querySelector('[data-auth-reset]');
  if (reset) reset.hidden = mode !== 'login';
}

export function bindPasswordToggles(root = document) {
  for (const toggle of root.querySelectorAll('[data-password-toggle]')) {
    toggle.addEventListener('click', () => {
      const input = $(toggle.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.textContent = visible ? 'Показать' : 'Скрыть';
      toggle.setAttribute('aria-label', visible ? 'Показать пароль' : 'Скрыть пароль');
    });
  }
}

export function reportAuthError(error, target) {
  const message = describeAuthError(error);
  setAuthMessage(target, message, 'error');
  return message;
}

export function finishAuthSuccess(message) {
  closeDialog('#onboardingModal');
  closeDialog('#accountModal');
  showToast(message, { type: 'success' });
}
