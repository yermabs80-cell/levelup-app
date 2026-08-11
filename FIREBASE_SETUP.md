# Настройка Firebase для LevelUp

Интеграция использует **модульный Firebase JS SDK**, который подгружается
динамически с CDN прямо из `src/data/cloud.js` — bundler и npm не нужны.

> **Важно:** конфигурация Firebase Web (`apiKey`, `projectId` и другие поля)
> видна каждому посетителю сайта и сама по себе **не является секретом**.
> Защиту данных обеспечивают Firebase Authentication и, прежде всего,
> корректные **Firestore Security Rules**. Никогда не добавляйте в клиентский
> код ключи сервисного аккаунта или другие серверные секреты.

## 1. Создайте проект и Web App

1. Откройте [Firebase Console](https://console.firebase.google.com/).
2. Создайте проект или выберите существующий.
3. В **Project settings → General → Your apps** добавьте Web App.
4. Скопируйте поля из объекта `firebaseConfig` в
   `firebase-config.js`. Не меняйте имя `window.LEVELUP_FIREBASE_CONFIG`.

Пока обязательные поля пусты, `cloud.js` остаётся безопасно отключённым и
возвращает `configured === false`.

## 2. Подключите конфиг

Подключите конфигурацию **до** кода приложения, который использует Firebase:

```html
<script src="./firebase-config.js"></script>
<script type="module" src="./src/main.js"></script>
```

SDK загружается динамически из CDN (`gstatic.com`) при первом обращении.
Если CDN недоступен или конфиг не заполнен, приложение продолжит работать
без облачной синхронизации.

Если проект применяет Content Security Policy, разрешите загрузку скриптов с
`https://www.gstatic.com` и необходимые Firebase-соединения.

## 3. Включите способы входа

1. Перейдите в **Authentication → Sign-in method**.
2. Включите провайдер **Email/Password** (первый переключатель, без Email link).
3. Включите провайдер **Google**.
4. Выберите support email и сохраните настройки.

Запросы `signInGoogle()`, `signUpEmail()`, `signInEmail()` и `resetPassword()`
вызываются из обработчиков интерфейса и возвращают `Promise`. Вход через Google
работает только при открытии по `http://localhost`.

## 4. Настройте Authorized domains

В **Authentication → Settings → Authorized domains** добавьте:

- домен production-сайта;
- домены preview/staging-окружений, если они используются;
- `localhost` для локальной разработки (если его ещё нет в списке).

Указывайте только доменное имя, без протокола и пути. Для Firebase Hosting
служебные домены проекта обычно добавляются автоматически.

## 5. Создайте Firestore и установите правила

Создайте базу в **Firestore Database**, выберите подходящий регион и замените
правила следующими:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, create, update, delete:
        if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Опубликуйте правила. Они разрешают пользователю доступ только к документу
`users/{его uid}` и не дают читать или изменять документы других
пользователей. **Не используйте открытые тестовые правила в production:**
Firebase Web config публичен, поэтому строгие Firestore Rules критичны.

Если позднее появятся подколлекции внутри `users/{userId}`, добавьте для них
отдельные правила: правило документа не распространяется на подколлекции.

## 6. Включите App Check (рекомендуется)

Правила защищают чужие данные, но не мешают постороннему сайту с вашим `apiKey`
создавать аккаунты и расходовать квоту проекта. Закрывает это App Check:

1. **App Check → Apps → Web** → зарегистрируйте приложение с провайдером
   **reCAPTCHA v3** (или Enterprise) и получите site key.
2. Прогоните несколько дней в режиме мониторинга — вкладка **Metrics** покажет
   долю запросов без валидного токена.
3. Когда доля близка к нулю, включите **Enforce** для Authentication и Firestore.

Для локальной разработки заведите debug-токен: **App Check → Apps → Manage debug
tokens**, а в консоли браузера перед загрузкой Firebase выставьте
`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` — токен появится в логе.

## Как вход устроен в приложении

- Кнопка Google всегда запрашивает `prompt: 'select_account'`, поэтому Google
  показывает список аккаунтов с пунктом «Другой аккаунт», а не входит молча
  в уже открытую сессию браузера.
- Firebase SDK начинает грузиться при старте приложения, ещё до клика. Это
  обязательное условие: popup должен открываться **тем же жестом**, что и клик.
  Любое ожидание сети между кликом и `signInWithPopup` тратит user activation,
  и браузер блокирует окно с `auth/popup-blocked`.
- Если popup всё же заблокирован, приложение переключается на
  `signInWithRedirect`. У этого вызова нет «успешного» завершения — при удаче
  страница просто уходит на Google, поэтому переход ограничен сторожевым
  таймером (6 с). Если за это время навигации не случилось, пользователь видит
  просьбу разрешить всплывающие окна, а не бесконечное «Открываем вход…».
- Закрытое или отменённое пользователем окно (`auth/popup-closed-by-user`,
  `auth/cancelled-popup-request`) редирект **не** запускает: это осознанный
  отказ, и уводить человека со страницы в таком случае нельзя.
- Кнопка **«Войти в другой Google-аккаунт»** запрашивает
  `prompt: 'login select_account'` — Google обязан заново спросить логин и
  пароль. Предварительного `signOut` нет намеренно: он тратил жест клика и при
  отмене окна оставлял пользователя вообще без входа.
- При открытии страницы как `file://` вход через Google невозможен — приложение
  показывает понятное сообщение вместо молчаливой ошибки.

### Если вход не открывается

| Симптом | Причина | Что делать |
|---|---|---|
| `auth/unauthorized-domain` | домена нет в списке | добавить домен в Authorized domains |
| Просьба разрешить всплывающие окна | popup и redirect заблокированы | разрешить popup для сайта в настройках браузера |
| `auth/operation-not-allowed` | провайдер Google выключен | включить Google в Sign-in method |
| `auth/missing-initial-state` | заблокированы сторонние куки | разрешить куки или входить через popup |

## Формат данных в Firestore

Документ `users/{uid}` содержит поле `schemaVersion` (сейчас `2`). Опыт хранится
в журнале `completions[дата][ключ]`, а не готовой суммой — это позволяет сливать
данные двух устройств без задвоения. Фотографии в облако не выгружаются.

## 7. API и колбэки

Доступные методы cloud-модуля (`src/data/cloud.js`):

```js
cloud.configured    // true если заполнен firebase-config.js
cloud.user          // { uid, displayName, email, photoURL } или null
cloud.canUseGoogle  // true если конфиг есть и страница открыта не как file://
cloud.prewarm()     // начать загрузку SDK заранее (вызывается при старте)
cloud.init()        // полная инициализация Firebase
cloud.signInGoogle()
cloud.switchGoogleAccount()
cloud.signUpEmail(email, password, displayName)
cloud.signInEmail(email, password)
cloud.resetPassword(email)
cloud.signOut()
cloud.scheduleSave(data)
cloud.flushSave()
```

- `scheduleSave(data)` объединяет частые вызовы (debounce 800 мс) и пишет
  документ целиком; фотографии в payload не попадают.
- `flushSave()` немедленно отправляет отложенную запись — используется перед
  выходом из аккаунта и при закрытии вкладки.
- Данные не «загружаются» разово: активна живая подписка `onSnapshot`, поэтому
  изменения с другого устройства приходят сами.
- Все методы возвращают `Promise`.

Модуль не использует глобальные события — `createCloud()` принимает колбэки:

```js
const cloud = createCloud({
  config: window.LEVELUP_FIREBASE_CONFIG,
  onAuthChange: ({ user, configured }) => {},  // user или null
  onRemoteData: data => {},                    // данные из Firestore или null
  onSyncState: ({ status, message }) => {}     // syncing | synced | error | ...
});
```

В `onAuthChange` поле `user` содержит безопасное для интерфейса представление
(`uid`, `displayName`, `email`, `photoURL`) либо `null`.
