import { COLLECTIONS, DEFAULT_NAME } from './core/constants.js';
import { createCloud, describeAuthError } from './data/cloud.js';
import { findQuest } from './data/library.js';
import {
  addItem,
  cloudPayload,
  getState,
  hydrate,
  markOnboarded,
  mergeRemote,
  removeItem,
  resetAll,
  rollOverDay,
  setName,
  setPersistHandler,
  setQuotaHandler,
  storeEvents,
  subscribe,
  toggleQuest,
  toggleTask
} from './data/store.js';
import { $, closeDialog, delegate, openDialog } from './ui/dom.js';
import { askConfirm, showToast } from './ui/feedback.js';
import {
  bindPasswordToggles,
  finishAuthSuccess,
  renderAccount,
  setAuthMessage,
  setAuthMode,
  setSyncStatus
} from './ui/account.js';
import { getActiveType, openEntryModal, resetEntryModal } from './ui/modals.js';
import { clearPhotos, handlePhotoFile, hydratePhotos, removePhoto, setPhotoCloud, syncPhotosWithCloud } from './ui/photos.js';
import { bindFocus, renderFocus } from './ui/focus.js';
import {
  expandGroup,
  renderAscension,
  renderBranches,
  renderHeader,
  renderHero,
  renderLibrary,
  renderMoney,
  renderQuests,
  renderSchedule,
  renderStats,
  renderTasks,
  renderTree,
  toggleGroupExpansion
} from './ui/render.js';

const cloud = createCloud({
  config: window.LEVELUP_FIREBASE_CONFIG,
  onAuthChange: handleAuthChange,
  onRemoteData: handleRemoteData,
  onSyncState: handleSyncState
});

let photoTarget = '';
let googleAuthPending = false;

function addedQuestTitles() {
  return new Set(getState().quests.map(quest => quest.title.trim().toLowerCase()));
}

/** Перерисовывает только затронутые области: раскрытые details и позиция скролла сохраняются. */
function handleStoreChange(scopes, state) {
  const all = scopes.has(storeEvents.ALL);

  if (all || scopes.has(storeEvents.PROFILE)) {
    renderHeader(state);
    renderAccount({ state, cloud });
  }

  if (all || scopes.has(storeEvents.PROGRESS) || scopes.has(storeEvents.QUESTS)) {
    renderHero(state);
    renderStats(state);
    renderBranches(state);
    renderAscension(state);
    renderTree(state);
  }

  if (all || scopes.has(storeEvents.QUESTS)) {
    renderQuests(state);
    renderLibrary(state, addedQuestTitles());
  }

  if (all || scopes.has(storeEvents.TASKS)) renderTasks(state);
  if (all || scopes.has(storeEvents.SCHEDULE)) renderSchedule(state);
  if (all || scopes.has(storeEvents.MONEY)) renderMoney(state);
  if (all || scopes.has(storeEvents.FOCUS) || scopes.has(storeEvents.PROGRESS)) renderFocus();
}

/**
 * Имя из аккаунта. У Google displayName есть всегда, у email-регистрации —
 * если её заполнили; иначе берём часть адреса до @. Что угодно человеческое
 * лучше безличного «Охотник», который раньше приезжал молча.
 */
function nameFromUser(user) {
  const displayName = String(user.displayName || '').trim();
  if (displayName) return displayName.slice(0, 24);

  const local = String(user.email || '').split('@')[0].replace(/[._\-+]+/g, ' ').trim();
  if (!local) return '';
  return `${local[0].toUpperCase()}${local.slice(1)}`.slice(0, 24);
}

function handleAuthChange({ user }) {
  const state = getState();

  if (user) {
    if (!state.onboarded) {
      const suggested = state.name === DEFAULT_NAME ? nameFromUser(user) : '';
      if (!suggested || !setName(suggested).ok) markOnboarded();
    }
    closeDialog('#onboardingModal');
    // Снимки, сделанные до входа, уезжают в облако; сделанные на другом
    // устройстве — приезжают сюда.
    syncPhotosWithCloud();
  }

  renderAccount({ state: getState(), cloud });
  maybeShowOnboarding();
}

function handleRemoteData(remote) {
  if (!remote) {
    // Документа ещё нет — заливаем текущий прогресс как первый снимок.
    if (cloud.user) cloud.scheduleSave(cloudPayload());
    return;
  }
  mergeRemote(remote);
}

function handleSyncState({ status, message }) {
  setSyncStatus(status);
  renderAccount({ state: getState(), cloud });
  if (status === 'error' && message) console.warn('[sync]', message);
}

function maybeShowOnboarding() {
  const state = getState();
  if (state.onboarded || cloud.user) return;

  const modal = $('#onboardingModal');
  if (!modal || modal.open) return;

  const known = state.name === DEFAULT_NAME ? '' : state.name;
  for (const selector of ['#onboardingName', '#localName']) {
    const input = $(selector);
    if (input) input.value = known;
  }

  modal.showModal();
}

function goToPage(pageId) {
  for (const element of document.querySelectorAll('.tabs button, .page')) {
    element.classList.remove('active');
  }
  for (const button of document.querySelectorAll('.tabs button')) {
    const active = button.dataset.page === pageId;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $(`#${pageId}`)?.classList.add('active');
}

function focusLibraryBranch(branchKey) {
  const card = $(`[data-library-group="${branchKey}"]`);
  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.classList.add('library-group-focus');
  setTimeout(() => card.classList.remove('library-group-focus'), 1400);
}

function openPhotoPicker(target) {
  photoTarget = target;
  const input = $('#photoInput');
  if (!input) return;
  input.value = '';
  input.click();
}

function authScopeSelector(scope) {
  return scope === 'account' ? '#accountAuth' : '#onboardingAuth';
}

async function authenticateEmail(scope) {
  const isAccount = scope === 'account';
  const messageTarget = isAccount ? '#accountAuthMessage' : '#authMessage';
  const mode = $(authScopeSelector(scope))?.dataset.authMode ?? 'login';

  const email = $(isAccount ? '#accountEmail' : '#onboardingEmail')?.value.trim() ?? '';
  const passwordInput = $(isAccount ? '#accountPassword' : '#onboardingPassword');
  const password = passwordInput?.value ?? '';
  const nameInput = $(isAccount ? '#accountName' : '#onboardingName');
  const displayName = nameInput?.value.trim() || getState().name;

  if (!cloud.configured) {
    setAuthMessage(messageTarget, 'Firebase не настроен — проверь firebase-config.js.', 'error');
    return;
  }
  if (!email || !password) {
    setAuthMessage(messageTarget, 'Введи email и пароль.', 'error');
    return;
  }
  if (password.length < 6) {
    setAuthMessage(messageTarget, 'Пароль должен содержать минимум 6 символов.', 'error');
    return;
  }

  setAuthMessage(messageTarget, mode === 'register' ? 'Создаём аккаунт…' : 'Входим…');

  try {
    if (mode === 'register') await cloud.signUpEmail(email, password, displayName);
    else await cloud.signInEmail(email, password);

    if (passwordInput) passwordInput.value = '';
    setAuthMessage(messageTarget, '');
    finishAuthSuccess(mode === 'register' ? 'Аккаунт создан' : 'Вход выполнен');
  } catch (error) {
    console.error(error);
    setAuthMessage(messageTarget, describeAuthError(error), 'error');
  }
}

const GOOGLE_BUTTONS = ['#googleSignInBtn', '#accountGoogleBtn', '#switchGoogleBtn'];

function setGoogleButtonsBusy(busy) {
  for (const selector of GOOGLE_BUTTONS) {
    const button = $(selector);
    if (button) button.disabled = busy;
  }
}

/**
 * Внутри нельзя ставить `await` до вызова cloud.signInGoogle(): жест клика
 * должен дойти до window.open, иначе браузер заблокирует окно Google.
 */
function authenticateGoogle({ scope = 'onboarding', switchAccount = false } = {}) {
  const messageTarget = scope === 'account' ? '#accountAuthMessage' : '#authMessage';

  if (googleAuthPending) return;

  if (!cloud.canUseGoogle) {
    setAuthMessage(
      messageTarget,
      cloud.configured
        ? 'Google-вход не работает, когда страница открыта как файл. Запусти npm start и открой http://localhost:4173.'
        : 'Firebase не настроен — добавь конфиг по инструкции из FIREBASE_SETUP.md.',
      'error'
    );
    return;
  }

  googleAuthPending = true;
  setGoogleButtonsBusy(true);
  setAuthMessage(messageTarget, 'Открываем выбор аккаунта Google…');

  const attempt = switchAccount ? cloud.switchGoogleAccount() : cloud.signInGoogle();

  attempt
    .then(result => {
      if (result?.redirecting) {
        setAuthMessage(messageTarget, 'Переходим на страницу входа Google…');
        return;
      }
      setAuthMessage(messageTarget, '');
      finishAuthSuccess('Google подключён');
    })
    .catch(error => {
      console.error(error);
      setAuthMessage(messageTarget, describeAuthError(error), 'error');
    })
    .finally(() => {
      googleAuthPending = false;
      setGoogleButtonsBusy(false);
    });
}

async function resetPassword(scope) {
  const messageTarget = scope === 'account' ? '#accountAuthMessage' : '#authMessage';
  const email = $(scope === 'account' ? '#accountEmail' : '#onboardingEmail')?.value.trim();

  if (!email) {
    setAuthMessage(messageTarget, 'Введи email, на который отправить ссылку.', 'error');
    return;
  }

  try {
    await cloud.resetPassword(email);
    setAuthMessage(messageTarget, 'Ссылка для сброса пароля отправлена на почту.', 'success');
  } catch (error) {
    setAuthMessage(messageTarget, describeAuthError(error), 'error');
  }
}

function bindEvents() {
  delegate('click', '[data-page]', (_event, target) => goToPage(target.dataset.page));

  delegate('click', '[data-close-dialog]', (_event, target) => target.closest('dialog')?.close());

  delegate('click', '[data-branch-open]', (_event, target) => {
    const key = target.dataset.branchOpen;
    closeDialog('#treeModal');
    goToPage('library');
    expandGroup(key);
    renderLibrary(getState(), addedQuestTitles());
    focusLibraryBranch(key);
  });

  delegate('click', '[data-open]', (_event, target) => openEntryModal(target.dataset.open));

  delegate('click', '[data-show]', (_event, target) => {
    toggleGroupExpansion(target.dataset.show);
    renderLibrary(getState(), addedQuestTitles());
  });

  delegate('click', '[data-add-preset]', (_event, target) => {
    const quest = findQuest(
      target.dataset.addPreset,
      Number(target.dataset.group),
      Number(target.dataset.index)
    );
    if (!quest) return;

    const result = addItem('quest', { title: quest.title, stat: quest.stat, xp: 15 });
    if (!result.ok) {
      showToast(result.reason === 'duplicate' ? 'Этот квест уже добавлен' : 'Не удалось добавить квест', {
        type: 'error'
      });
      return;
    }
    showToast(`«${quest.title}» добавлен в квесты`, { type: 'success' });
  });

  delegate('click', '[data-toggle]', (_event, target) => {
    const type = target.dataset.toggle;
    const result = type === 'quest' ? toggleQuest(target.dataset.id) : toggleTask(target.dataset.id);

    if (!result.ok) {
      showToast('Этот пункт уже удалён', { type: 'error' });
      return;
    }
    if (type === 'quest' && result.done) {
      showToast(`+${result.quest.xp} XP · ${result.quest.title}`, { type: 'success', duration: 2200 });
    }
  });

  delegate('click', '[data-del]', async (_event, target) => {
    const type = target.dataset.del;
    const item = getState()[COLLECTIONS[type]]?.find(entry => entry.id === target.dataset.id);
    if (!item) return;

    const confirmed = await askConfirm(`«${item.title}» будет удалён из списка.`, {
      title: 'Удалить запись?',
      acceptLabel: 'Удалить'
    });
    if (!confirmed) return;

    if (removeItem(type, target.dataset.id).ok) showToast('Удалено');
  });

  delegate('click', '[data-photo]', (_event, target) => openPhotoPicker(target.dataset.photo));
  delegate('click', '[data-remove-photo]', (_event, target) => removePhoto(target.dataset.removePhoto));
  delegate('click', '[data-avatar-trigger]', () => openPhotoPicker('avatar'));

  delegate('click', '[data-auth-tab]', (_event, target) => {
    const scope = target.closest('[data-auth-scope]');
    if (scope) setAuthMode(`#${scope.id}`, target.dataset.authTab);
  });

  delegate('click', '[data-auth-reset]', (_event, target) => {
    const scope = target.closest('[data-auth-scope]')?.id === 'accountAuth' ? 'account' : 'onboarding';
    resetPassword(scope);
  });

  $('#form')?.addEventListener('submit', event => {
    event.preventDefault();
    const type = getActiveType();
    if (!type) {
      closeDialog('#modal');
      return;
    }

    const values = Object.fromEntries(new FormData(event.target));
    const result = addItem(type, values);

    if (!result.ok) {
      showToast(result.reason === 'duplicate' ? 'Такая запись уже есть' : 'Проверь заполнение полей', {
        type: 'error'
      });
      return;
    }

    closeDialog('#modal');
    showToast('Добавлено', { type: 'success' });
  });

  $('#modal')?.addEventListener('close', resetEntryModal);

  $('#settingsBtn')?.addEventListener('click', () => {
    const input = $('#nameInput');
    if (input) input.value = getState().name;
    openDialog('#settings');
  });

  $('#settingsForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const input = $('#nameInput');
    const result = setName(input?.value);

    if (!result.ok) {
      showToast('Введи имя — оно видно в приложении', { type: 'error' });
      input?.focus();
      return;
    }

    closeDialog('#settings');
    showToast('Имя обновлено', { type: 'success' });

    // Без записи в аккаунт следующий вход на другом устройстве вернул бы старое имя.
    if (cloud.user) await cloud.updateDisplayName(result.name);
  });

  $('#resetBtn')?.addEventListener('click', async () => {
    const confirmed = await askConfirm(
      'Все квесты, задачи, финансы и фотографии будут удалены с этого устройства.',
      { title: 'Стереть весь прогресс?', acceptLabel: 'Стереть всё' }
    );
    if (!confirmed) return;

    resetAll();
    clearPhotos();
    closeDialog('#settings');
    showToast('Прогресс сброшен');
  });

  for (const selector of ['#nameTreeBtn', '#openTreeBtn']) {
    $(selector)?.addEventListener('click', () => {
      renderTree(getState());
      openDialog('#treeModal');
    });
  }

  $('#accountBtn')?.addEventListener('click', () => {
    renderAccount({ state: getState(), cloud });
    openDialog('#accountModal');
  });

  $('#googleSignInBtn')?.addEventListener('click', () => authenticateGoogle({ scope: 'onboarding' }));
  $('#accountGoogleBtn')?.addEventListener('click', () => authenticateGoogle({ scope: 'account' }));
  $('#switchGoogleBtn')?.addEventListener('click', () =>
    authenticateGoogle({ scope: 'account', switchAccount: true }));

  $('#onboardingAuthForm')?.addEventListener('submit', event => {
    event.preventDefault();
    authenticateEmail('onboarding');
  });

  $('#accountAuthForm')?.addEventListener('submit', event => {
    event.preventDefault();
    authenticateEmail('account');
  });

  $('#localStartForm')?.addEventListener('submit', event => {
    event.preventDefault();

    const input = $('#localName');
    const result = setName(input?.value);

    if (!result.ok) {
      setAuthMessage('#authMessage', 'Введи имя — приложение будет обращаться к тебе по нему.', 'error');
      input?.focus();
      return;
    }

    setAuthMessage('#authMessage', '');
    closeDialog('#onboardingModal');
    showToast(`Профиль создан локально · ${result.name}`, { type: 'success' });
  });

  $('#onboardingModal')?.addEventListener('cancel', event => {
    if (!getState().onboarded) event.preventDefault();
  });

  $('#signOutBtn')?.addEventListener('click', async () => {
    await cloud.signOut();
    closeDialog('#accountModal');
    showToast('Вы вышли из аккаунта');
  });

  $('#photoInput')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    const target = photoTarget;
    event.target.value = '';
    photoTarget = '';
    await handlePhotoFile(file, target);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (rollOverDay()) showToast('Новый день — квесты снова активны');
  });

  window.addEventListener('beforeunload', () => cloud.flushSave());
}

async function boot() {
  // Греем SDK сразу: к моменту клика по «Войти через Google» сеть уже не нужна,
  // и жест клика доходит до popup неизрасходованным.
  cloud.prewarm();

  subscribe(handleStoreChange);

  setQuotaHandler(() => {
    showToast('Память браузера заполнена. Удали часть записей или фотографий.', {
      type: 'error',
      duration: 6000
    });
  });

  setPersistHandler(() => {
    if (cloud.user) cloud.scheduleSave(cloudPayload());
  });

  const { corrupted, legacyPhotos, migratedFromV1 } = hydrate();
  rollOverDay();

  setPhotoCloud(cloud);
  setAuthMode('#onboardingAuth', 'login');
  setAuthMode('#accountAuth', 'login');
  bindPasswordToggles();
  bindEvents();
  bindFocus();
  renderFocus();

  // Обработчики уже привязаны, состояние поднято — можно поднимать Firebase.
  // Не ждём здесь: инициализация идёт параллельно загрузке фотографий, чтобы
  // к первому клику по кнопке Google вход был готов и не требовал await.
  const cloudReady = cloud.init();

  await hydratePhotos(legacyPhotos);
  maybeShowOnboarding();

  if (corrupted) {
    showToast('Сохранённые данные были повреждены — начинаем с чистого профиля.', {
      type: 'error',
      duration: 6000
    });
  } else if (migratedFromV1) {
    showToast('Прогресс перенесён в новый формат — опыт сохранён.', { type: 'success' });
  }

  await cloudReady;

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('[sw]', error));
  }
}

boot();
