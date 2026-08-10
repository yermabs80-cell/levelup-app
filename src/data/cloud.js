const SDK_VERSION = '11.10.0';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const SAVE_DEBOUNCE_MS = 800;
const REDIRECT_FLAG = 'levelup-google-redirect';

/**
 * Firebase грузится динамически и только модульными точками входа.
 * Если CDN недоступен (офлайн, блокировка), приложение продолжает работать
 * локально — раньше три блокирующих <script> молча ломали облако целиком.
 */
async function loadFirebase() {
  const [app, auth, firestore] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`)
  ]);

  return { app, auth, firestore };
}

function hasCompleteConfig(config) {
  return Boolean(config)
    && ['apiKey', 'authDomain', 'projectId', 'appId']
      .every(key => typeof config[key] === 'string' && config[key].trim() !== '');
}

function publicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || ''
  };
}

export function createCloud({ config, onAuthChange, onRemoteData, onSyncState }) {
  const state = {
    ready: false,
    configured: hasCompleteConfig(config),
    sdk: null,
    auth: null,
    db: null,
    user: null,
    unsubscribeSnapshot: null,
    saveTimer: null,
    pendingPayload: null,
    lastPushedJson: ''
  };

  const emitSync = (status, message = '') => onSyncState?.({ status, message });

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  async function ensureReady() {
    if (state.ready) return true;
    if (!state.configured) {
      emitSync('unavailable', 'Firebase не настроен');
      return false;
    }
    if (isFileProtocol()) {
      emitSync('unavailable', 'Вход через Google не работает при открытии файла напрямую');
      return false;
    }

    try {
      state.sdk = await loadFirebase();
      const app = state.sdk.app.initializeApp(config);
      state.auth = state.sdk.auth.getAuth(app);
      state.db = state.sdk.firestore.getFirestore(app);

      await state.sdk.auth.setPersistence(state.auth, state.sdk.auth.browserLocalPersistence);
      state.ready = true;

      state.sdk.auth.onAuthStateChanged(state.auth, handleAuthState);
      await consumeRedirectResult();
      return true;
    } catch (error) {
      console.error('[cloud]', error);
      emitSync('unavailable', 'Не удалось загрузить Firebase');
      return false;
    }
  }

  async function consumeRedirectResult() {
    const attempted = sessionStorage.getItem(REDIRECT_FLAG) === '1';
    try {
      const result = await state.sdk.auth.getRedirectResult(state.auth);
      if (result?.user) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        return publicUser(result.user);
      }
      if (attempted && !state.auth.currentUser) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        emitSync('error', 'Вход через Google не завершился');
      }
    } catch (error) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      console.error('[cloud]', error);
      emitSync('error', describeAuthError(error));
    }
    return null;
  }

  function handleAuthState(user) {
    state.user = user;
    onAuthChange?.({ user: publicUser(user), configured: state.configured });

    stopWatching();
    if (user) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      startWatching(user.uid);
    } else {
      state.lastPushedJson = '';
      emitSync('signed-out', 'Не выполнен вход');
    }
  }

  /** Живая подписка вместо ручных опросов — второе устройство видит изменения сразу. */
  function startWatching(uid) {
    const { doc, onSnapshot } = state.sdk.firestore;
    emitSync('syncing', 'Подключаемся к облаку');

    state.unsubscribeSnapshot = onSnapshot(
      doc(state.db, 'users', uid),
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : null;
        // Собственную только что отправленную запись обратно не применяем.
        if (data && JSON.stringify(data) === state.lastPushedJson) {
          emitSync('synced', 'Сохранено в облаке');
          return;
        }
        onRemoteData?.(data);
        emitSync('synced', data ? 'Данные синхронизированы' : 'Облако пустое');
      },
      error => {
        console.error('[cloud]', error);
        emitSync('error', 'Нет доступа к облаку');
      }
    );
  }

  function stopWatching() {
    state.unsubscribeSnapshot?.();
    state.unsubscribeSnapshot = null;
  }

  async function flushSave() {
    state.saveTimer = null;
    const payload = state.pendingPayload;
    state.pendingPayload = null;
    if (!payload || !state.ready || !state.user) return false;

    try {
      const { doc, setDoc } = state.sdk.firestore;
      emitSync('syncing', 'Сохраняем в облако');
      state.lastPushedJson = JSON.stringify(payload);
      await setDoc(doc(state.db, 'users', state.user.uid), payload, { merge: false });
      emitSync('synced', 'Сохранено в облаке');
      return true;
    } catch (error) {
      console.error('[cloud]', error);
      state.lastPushedJson = '';
      emitSync('error', 'Не удалось сохранить в облако');
      return false;
    }
  }

  function scheduleSave(payload) {
    if (!state.ready || !state.user) return;
    state.pendingPayload = payload;
    clearTimeout(state.saveTimer);
    emitSync('syncing', 'Изменения будут сохранены');
    state.saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }

  function buildGoogleProvider({ forceCredentials = false } = {}) {
    const provider = new state.sdk.auth.GoogleAuthProvider();
    // select_account всегда показывает список аккаунтов с пунктом «Другой аккаунт»,
    // поэтому вход перестаёт молча использовать уже открытую сессию браузера.
    // При явном «войти в другой аккаунт» просим Google заново спросить пароль.
    provider.setCustomParameters({
      prompt: forceCredentials ? 'login select_account' : 'select_account'
    });
    return provider;
  }

  async function signInGoogle(options = {}) {
    if (!(await ensureReady())) {
      throw new Error(isFileProtocol()
        ? 'Открой приложение по адресу http://localhost, а не как файл — Google не пускает вход со страницы file://.'
        : 'Firebase недоступен. Проверь настройки и интернет.');
    }

    const { signInWithPopup, signInWithRedirect } = state.sdk.auth;
    const provider = buildGoogleProvider(options);
    emitSync('syncing', 'Открываем вход через Google');

    try {
      const result = await signInWithPopup(state.auth, provider);
      return publicUser(result.user);
    } catch (error) {
      const fallbackCodes = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment'
      ];

      // Раньше этот путь был мёртвым: приложение показывало сообщение про
      // редирект, но сам редирект никогда не запускался.
      if (fallbackCodes.includes(error?.code)) {
        sessionStorage.setItem(REDIRECT_FLAG, '1');
        emitSync('syncing', 'Переходим на страницу входа Google');
        await signInWithRedirect(state.auth, provider);
        return { redirecting: true };
      }

      throw error;
    }
  }

  /** Явная смена аккаунта: сначала выходим, затем просим Google спросить логин заново. */
  async function switchGoogleAccount() {
    if (state.ready && state.auth?.currentUser) {
      await state.sdk.auth.signOut(state.auth);
    }
    return signInGoogle({ forceCredentials: true });
  }

  async function signUpEmail(email, password, displayName) {
    if (!(await ensureReady())) throw new Error('Firebase недоступен.');
    const { createUserWithEmailAndPassword, updateProfile } = state.sdk.auth;

    emitSync('syncing', 'Создаём аккаунт');
    const result = await createUserWithEmailAndPassword(state.auth, email.trim(), password);
    const name = String(displayName || '').trim();
    if (name) {
      await updateProfile(result.user, { displayName: name }).catch(() => null);
    }
    return publicUser(result.user);
  }

  async function signInEmail(email, password) {
    if (!(await ensureReady())) throw new Error('Firebase недоступен.');
    const { signInWithEmailAndPassword } = state.sdk.auth;

    emitSync('syncing', 'Входим в аккаунт');
    const result = await signInWithEmailAndPassword(state.auth, email.trim(), password);
    return publicUser(result.user);
  }

  async function resetPassword(email) {
    if (!(await ensureReady())) throw new Error('Firebase недоступен.');
    const { sendPasswordResetEmail } = state.sdk.auth;
    await sendPasswordResetEmail(state.auth, email.trim());
  }

  async function signOut() {
    if (!state.ready || !state.auth) return false;
    clearTimeout(state.saveTimer);
    await flushSave();
    stopWatching();
    await state.sdk.auth.signOut(state.auth);
    sessionStorage.removeItem(REDIRECT_FLAG);
    return true;
  }

  return {
    get configured() {
      return state.configured;
    },
    get user() {
      return publicUser(state.user);
    },
    get canUseGoogle() {
      return state.configured && !isFileProtocol();
    },
    init: ensureReady,
    scheduleSave,
    flushSave,
    signInGoogle,
    switchGoogleAccount,
    signUpEmail,
    signInEmail,
    resetPassword,
    signOut
  };
}

const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'Этот email уже зарегистрирован — нажми «Войти».',
  'auth/invalid-email': 'Проверь правильность email.',
  'auth/weak-password': 'Пароль должен содержать минимум 6 символов.',
  'auth/missing-password': 'Введи пароль.',
  'auth/user-not-found': 'Аккаунт с таким email не найден.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/too-many-requests': 'Слишком много попыток. Попробуй позже.',
  'auth/network-request-failed': 'Нет соединения с Firebase. Проверь интернет.',
  'auth/unauthorized-domain': 'Домен не добавлен в Firebase → Authentication → Authorized domains.',
  'auth/popup-blocked': 'Браузер заблокировал окно Google — переходим на страницу входа.',
  'auth/popup-closed-by-user': 'Окно Google закрыли до конца входа.',
  'auth/cancelled-popup-request': 'Предыдущее окно входа отменено. Попробуй ещё раз.',
  'auth/operation-not-allowed': 'Способ входа не включён в Firebase Authentication.',
  'auth/operation-not-supported-in-this-environment': 'Открой приложение по http://localhost, а не как файл.',
  'auth/invalid-api-key': 'Неверный apiKey в firebase-config.js.',
  'auth/account-exists-with-different-credential': 'Этот email уже привязан к другому способу входа.'
};

export function describeAuthError(error) {
  if (!error) return 'Неизвестная ошибка.';
  if (AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  return error.message || 'Не удалось выполнить вход.';
}
