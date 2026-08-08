# Настройка Firebase для LevelUp

Интеграция использует Firebase **compat API** и обычные `<script>`-теги —
bundler и npm не нужны.

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
выставляет `window.LevelUpCloud.configured === false`.

## 2. Подключите compat-скрипты

Подключайте файлы в этом порядке, до кода приложения, который использует
`window.LevelUpCloud`:

```html
<script defer src="https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js"></script>
<script defer src="https://www.gstatic.com/firebasejs/11.10.0/firebase-auth-compat.js"></script>
<script defer src="https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore-compat.js"></script>
<script defer src="firebase-config.js"></script>
<script defer src="cloud.js"></script>
```

Все скрипты должны использовать одну и ту же версию Firebase. Если проект
применяет Content Security Policy, разрешите загрузку скриптов с
`https://www.gstatic.com` и необходимые Firebase-соединения.

Если CDN недоступен, отсутствует один из compat-скриптов или конфигурация не
заполнена, приложение продолжит работать без облачной синхронизации.

## 3. Включите вход через Google

1. Перейдите в **Authentication → Sign-in method**.
2. Включите провайдер **Google**.
3. Выберите support email и сохраните настройки.

`window.LevelUpCloud.signInGoogle()` откроет popup Google. Браузер может
заблокировать popup, если метод вызван не непосредственно из обработчика
клика пользователя.

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

## 6. API и события

Доступный глобальный API:

```js
window.LevelUpCloud.configured;
window.LevelUpCloud.signInGoogle();
window.LevelUpCloud.signOut();
window.LevelUpCloud.save(data);
window.LevelUpCloud.getUser();
window.LevelUpCloud.load();
```

- `save(data)` объединяет частые вызовы (debounce 700 мс), записывает через
  Firestore `{ merge: true }` и намеренно исключает верхнеуровневое поле
  `photos` из отправляемых данных.
- `load()` читает документ текущего пользователя `users/{uid}`.
- При успешной авторизации данные загружаются автоматически.
- Методы возвращают `Promise`; `getUser()` возвращает текущий Firebase User
  или `null`.

Модуль отправляет события на `window`:

- `levelup:auth-change` — `detail: { user, configured }`;
- `levelup:remote-data` — `detail: { data }`;
- `levelup:sync-state` — `detail: { state, message }`.

Пример подписки:

```js
window.addEventListener("levelup:remote-data", function (event) {
  if (event.detail.data) {
    // Объединить облачные данные с локальным состоянием приложения.
  }
});
```

В `levelup:auth-change` поле `user` содержит безопасное для интерфейса
представление (`uid`, `displayName`, `email`, `photoURL`) либо `null`.
