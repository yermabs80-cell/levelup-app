const SDK_VERSION = '11.10.0';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const SAVE_DEBOUNCE_MS = 800;
const REDIRECT_FLAG = 'levelup-google-redirect';

/**
 * Если redirect не увёл страницу за это время, значит браузер его подавил
 * (partitioned storage, sandbox). Молча висеть нельзя — показываем причину.
 */
const REDIRECT_STALL_MS = 6000;

/** Popup нужно открывать тем же жестом, что и клик: эти коды — не отказ пользователя. */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
]);

let sdkPromise = null;

/**
 * Firebase грузится динамически и только модульными точками входа.
 * Если CDN недоступен (офлайн, блокировка), приложение продолжает работать
 * локально — раньше три блокирующих <script> молча ломали облако целиком.
 *
 * Результат кэшируется: загрузка стартует заранее, чтобы к моменту клика
 * по «Войти через Google» сеть уже не понадобилась.
 */
function loadFirebase() {
  sdkPromise ??= Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`)
  ])
    .then(([app, auth, firestore]) => ({ app, auth, firestore }))
    .catch(error => {
      sdkPromise = null;
      throw error;
    });

  return sdkPromise;
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

  let readyPromise = null;

  /** Прогрев: тянем SDK заранее, чтобы клик по кнопке не ждал сеть. */
  function prewarm() {
    if (!state.configured || isFileProtocol()) return Promise.resolve(false);
    return loadFirebase().then(() => true, () => false);
  }

  function ensureReady() {
    if (state.ready) return Promise.resolve(true);

    readyPromise ??= bootstrap().then(
      ok => {
        // Неудача не должна залипать навсегда: после починки сети можно повторить.
        if (!ok) readyPromise = null;
        return ok;
      },
      error => {
        readyPromise = null;
        throw error;
      }
    );

    return readyPromise;
  }

  async function bootstrap() {
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

  /**
   * Popup обязан открыться тем же жестом, что и клик. Любой `await` до него
   * (загрузка SDK по сети) стирает user activation, и браузер режет окно —
   * именно из-за этого вход раньше всегда падал в `auth/popup-blocked`.
   * Поэтому когда SDK уже прогрет, popup стартует синхронно.
   */
  function signInGoogle(options = {}) {
    if (state.ready) return startGoogleSignIn(options);

    return ensureReady().then(ok => {
      if (!ok) {
        throw new Error(isFileProtocol()
          ? 'Открой приложение по адресу http://localhost, а не как файл — Google не пускает вход со страницы file://.'
          : 'Firebase недоступен. Проверь настройки и интернет.');
      }
      return startGoogleSignIn(options);
    });
  }

  function startGoogleSignIn(options) {
    const provider = buildGoogleProvider(options);
    emitSync('syncing', 'Открываем вход через Google');

    return state.sdk.auth.signInWithPopup(state.auth, provider)
      .then(result => publicUser(result.user))
      .catch(error => {
        // Закрытое или отменённое окно — осознанное действие пользователя,
        // уводить его редиректом в этом случае нельзя.
        if (!REDIRECT_FALLBACK_CODES.has(error?.code)) {
          // Иначе статус навсегда застревает на «Синхронизация…».
          emitSync(state.user ? 'synced' : 'signed-out', '');
          throw error;
        }
        return fallbackToRedirect(provider);
      });
  }

  /**
   * `signInWithRedirect` не резолвится при успехе — страница просто уходит на
   * Google. Раньше код его дожидался, и интерфейс намертво вис на «Открываем
   * вход…». Теперь навигация ограничена сторожевым таймером.
   */
  async function fallbackToRedirect(provider) {
    sessionStorage.setItem(REDIRECT_FLAG, '1');
    emitSync('syncing', 'Переходим на страницу входа Google');

    const stalled = Symbol('stalled');
    let watchdog = null;

    try {
      const outcome = await Promise.race([
        state.sdk.auth.signInWithRedirect(state.auth, provider),
        new Promise(resolve => {
          watchdog = setTimeout(() => resolve(stalled), REDIRECT_STALL_MS);
        })
      ]);

      if (outcome === stalled) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        throw new Error(
          'Браузер заблокировал и всплывающее окно, и переход на страницу Google. '
          + 'Разреши всплывающие окна для этого сайта и попробуй ещё раз.'
        );
      }

      return { redirecting: true };
    } catch (error) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      throw error;
    } finally {
      clearTimeout(watchdog);
    }
  }

  /**
   * Явная смена аккаунта. Предварительный signOut убран намеренно: он съедал
   * жест клика, а при отмене окна оставлял пользователя вообще без входа.
   * `prompt: 'login select_account'` и так заставляет Google спросить логин,
   * а успешный вход просто заменяет текущего пользователя.
   */
  function switchGoogleAccount() {
    // Незаписанные изменения уходят под старым uid: doc() берёт его синхронно.
    clearTimeout(state.saveTimer);
    flushSave();
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
    prewarm,
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
  'auth/account-exists-with-different-credential': 'Этот email уже привязан к другому способу входа.',
  'auth/web-storage-unsupported': 'Браузер блокирует хранилище — разреши куки для этого сайта.',
  'auth/missing-initial-state': 'Браузер блокирует сторонние куки. Разреши всплывающие окна и войди через popup.',
  'auth/redirect-cancelled-by-user': 'Вход через Google отменён.',
  'auth/timeout': 'Домен не отвечает. Проверь Authorized domains в Firebase.'
};

export function describeAuthError(error) {
  if (!error) return 'Неизвестная ошибка.';
  if (AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  return error.message || 'Не удалось выполнить вход.';
}
