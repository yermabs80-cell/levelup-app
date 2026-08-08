const STAT = [
  ['strength', 'Сила', '💪', '#fb7185'],
  ['health', 'Здоровье', '♥', '#4ade80'],
  ['intellect', 'Интеллект', '◈', '#60a5fa'],
  ['discipline', 'Дисциплина', '◎', '#fbbf24'],
  ['skills', 'Навыки', '✦', '#a78bfa'],
  ['wealth', 'Финансы', '₸', '#4de0ff'],
  ['faith', 'Вера', '🕌', '#8b5cf6'],
  ['knowledge', 'Знания', '📚', '#60a5fb']
];

const RANKS = [
  { name: 'EEE', level: 1, color: '#cbd5e1', percentile: '0–1%', score403030: '≤ 5', score333334: '≤ 5', description: 'Новичок. Только начинает свой путь, не имеет опыта и сражается голыми руками.' },
  { name: 'EE', level: 2, color: '#a8b3c2', percentile: '1–3%', score403030: '5–10', score333334: '5–10', description: 'Получил первое простое оружие и начинает осваивать основы боя.' },
  { name: 'E', level: 3, color: '#94a3b8', percentile: '3–5%', score403030: '10–15', score333334: '10–18', description: 'Приобрёл деревянный меч и научился побеждать слабых противников.' },
  { name: 'DDD', level: 5, color: '#16a34a', percentile: '5–8%', score403030: '15–20', score333334: '18–25', description: 'Настоящий ученик воина. Получил первую броню и стал увереннее в бою.' },
  { name: 'DD', level: 7, color: '#22c55e', percentile: '8–12%', score403030: '20–30', score333334: '25–35', description: 'Хорошо владеет мечом и способен противостоять опытным врагам.' },
  { name: 'D', level: 9, color: '#4ade80', percentile: '12–20%', score403030: '30–40', score333334: '35–45', description: 'Полностью освоил базовую подготовку. Готов к серьёзным испытаниям.' },
  { name: 'CCC', level: 12, color: '#2563eb', percentile: '20–30%', score403030: '40–50', score333334: '45–55', description: 'Опытный воин. Использует качественную экипировку и уверенно побеждает большинство противников.' },
  { name: 'CC', level: 15, color: '#3b82f6', percentile: '30–40%', score403030: '50–60', score333334: '55–65', description: 'Элитный боец. Отличается высокой выносливостью, техникой и дисциплиной.' },
  { name: 'C', level: 18, color: '#60a5fa', percentile: '40–50%', score403030: '60–70', score333334: '65–75', description: 'Один из лучших воинов своего поколения. Его навыки вызывают уважение.' },
  { name: 'BBB', level: 22, color: '#7c3aed', percentile: '50–60%', score403030: '70–75', score333334: '75–80', description: 'Великий воин. Освоил особые техники и значительно превосходит обычных бойцов.' },
  { name: 'BB', level: 26, color: '#8b5cf6', percentile: '60–70%', score403030: '75–80', score333334: '80–85', description: 'Легендарный чемпион. Его сила и мастерство известны далеко за пределами своего региона.' },
  { name: 'B', level: 30, color: '#a78bfa', percentile: '70–80%', score403030: '80–85', score333334: '85–90', description: 'Абсолютный мастер. Владеет редкими способностями и почти не знает равных среди людей.' },
  { name: 'AAA', level: 35, color: '#d97706', percentile: '80–90%', score403030: '85–90', score333334: '90–92', description: 'Герой. Символ силы, мужества и лидерства.' },
  { name: 'AA', level: 40, color: '#f59e0b', percentile: '90–95%', score403030: '90–93', score333334: '92–94', description: 'Живая легенда. Его имя известно во многих землях, а способности поражают даже мастеров.' },
  { name: 'A', level: 45, color: '#fbbf24', percentile: '95–99%', score403030: '93–95', score333334: '94–96', description: 'Мифический герой. Его возможности кажутся невозможными для обычного человека.' },
  { name: 'SSS', level: 50, color: '#e11d48', percentile: '99–99.5%', score403030: '95–97', score333334: '96–98', description: 'Эпический воин. Обладает невероятной силой, скоростью и контролем энергии.' },
  { name: 'SS', level: 55, color: '#f43f5e', percentile: '99.5–99.9%', score403030: '97–99', score333334: '98–99', description: 'Высшее воплощение мастерства. Способен менять ход великих битв в одиночку.' },
  { name: 'S', level: 60, color: '#fb7185', percentile: '99.9–100%', score403030: '99–100', score333334: '99–100', description: 'Абсолютная вершина человеческого потенциала. Идеал силы, техники, опыта и воли. Практически недостижимый уровень для большинства.' }
];

const TREE_XP_STEP = 120;
const TREE_STAGES = ['Семя', 'Росток', 'Ствол', 'Крона', 'Легенда'];
const TREE_BRANCHES = [
  { key: 'forcePath', icon: '💪', title: 'Титан Тела', subtitle: 'Путь Силы', color: '#fb7185', stats: ['strength', 'health'] },
  { key: 'mindPath', icon: '🧠', title: 'Архитектор Разума', subtitle: 'Путь Знаний', color: '#60a5fa', stats: ['intellect', 'knowledge', 'skills'] },
  { key: 'financePath', icon: '💎', title: 'Кузница Капитала', subtitle: 'Путь Финансов', color: '#4de0ff', stats: ['wealth'] },
  { key: 'faithPath', icon: '🕌', title: 'Свет Имана', subtitle: 'Путь Веры', color: '#8b5cf6', stats: ['faith', 'discipline'] }
];

const seed = {
  name: 'Охотник',
  onboarded: false,
  updatedAt: 0,
  streak: 0,
  lastDay: '',
  stats: Object.fromEntries(STAT.map(([id]) => [id, 0])),
  quests: [
    { id: 1, title: 'Выпить стакан воды', stat: 'health', xp: 10, done: false },
    { id: 2, title: 'Сделать зарядку 10 минут', stat: 'strength', xp: 15, done: false },
    { id: 3, title: 'Прочитать 10 страниц', stat: 'intellect', xp: 15, done: false }
  ],
  tasks: [],
  schedule: [],
  money: [],
  photos: { avatar: null, before: null, after: null }
};

const ONBOARDING_KEY = 'levelup-onboarded';
const storedDb = JSON.parse(localStorage.getItem('levelup-data') || 'null');
let db = storedDb || structuredClone(seed);
db = {
  ...structuredClone(seed),
  ...db,
  stats: { ...seed.stats, ...(db.stats || {}) },
  photos: db.photos || { avatar: null, before: null, after: null }
};
db.onboarded = storedDb?.onboarded === true
  || localStorage.getItem(ONBOARDING_KEY) === '1'
  || db.name !== 'Охотник';
let modalType = '', photoTarget = '';
let cloudUser = null;
let cloudConfigured = false;
let cloudSyncState = 'local';
let guestUpgradePending = false;

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

function cloudData() {
  const { photos, ...data } = db;
  return data;
}

function save({ sync = true } = {}) {
  db.updatedAt = Date.now();
  localStorage.setItem('levelup-data', JSON.stringify(db));
  if (sync && window.LevelUpCloud?.configured && window.LevelUpCloud.getUser?.()) {
    window.LevelUpCloud.save(cloudData());
  }
}
function today() { return new Date().toISOString().slice(0, 10); }
function xp() { return Object.values(db.stats).reduce((a, b) => a + b, 0); }
function level() { return Math.floor(xp() / 100) + 1; }
function rank() { return [...RANKS].reverse().find(r => level() >= r.level) || RANKS[0]; }

function goToPage(pageId) {
  document.querySelectorAll('.tabs button, .page').forEach(x => x.classList.remove('active'));
  $(`.tabs button[data-page="${pageId}"]`)?.classList.add('active');
  $('#' + pageId)?.classList.add('active');
}

function branchXp(statKeys) {
  return statKeys.reduce((sum, key) => sum + (db.stats[key] || 0), 0);
}

function branchStage(level) {
  return TREE_STAGES[Math.min(TREE_STAGES.length - 1, Math.floor((level - 1) / 4))];
}

function renderBranchTree() {
  const root = $('#branchTreeRoot');
  if (!root) return;

  const total = TREE_BRANCHES.reduce((sum, branch) => sum + branchXp(branch.stats), 0);
  const totalLevel = Math.floor(total / TREE_XP_STEP) + 1;

  root.innerHTML = `
    <div class="tree-core">
      <b>${esc(db.name)}</b>
      <span>Ядро Древа · ${total} XP · ${totalLevel} ур.</span>
    </div>
    <div class="tree-grid">
      ${TREE_BRANCHES.map((branch, index) => {
        const totalXp = branchXp(branch.stats);
        const localLevel = Math.floor(totalXp / TREE_XP_STEP) + 1;
        const currentInStep = totalXp % TREE_XP_STEP;
        const percent = Math.round((currentInStep / TREE_XP_STEP) * 100);
        const toNext = TREE_XP_STEP - currentInStep || TREE_XP_STEP;
        const stage = branchStage(localLevel);

        return `
          <button type="button" class="tree-node" data-branch-open="${branch.key}" style="--tree-color:${branch.color};--float-delay:${index * 0.2}s">
            <div class="tree-node-top">
              <span class="tree-icon">${branch.icon}</span>
              <div>
                <b>${esc(branch.title)}</b>
                <small>${esc(branch.subtitle)}</small>
              </div>
            </div>
            <div class="tree-node-meta">${stage} · ${localLevel} ур. · ${totalXp} XP</div>
            <div class="tree-track"><i style="width:${percent}%"></i></div>
            <div class="tree-node-foot">До роста: ${toNext} XP</div>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderDashboardBranches() {
  const root = $('#dashboardBranches');
  if (!root) return;

  root.innerHTML = TREE_BRANCHES.map((branch, index) => {
    const totalXp = branchXp(branch.stats);
    const localLevel = Math.floor(totalXp / TREE_XP_STEP) + 1;
    const progress = Math.round(((totalXp % TREE_XP_STEP) / TREE_XP_STEP) * 100);

    return `
      <button type="button" class="dashboard-branch" data-branch-open="${branch.key}" style="--branch-accent:${branch.color};--card-delay:${index * 0.08}s">
        <span class="dashboard-branch-glow"></span>
        <div class="dashboard-branch-top">
          <span class="dashboard-branch-icon">${branch.icon}</span>
          <span class="dashboard-branch-level">${localLevel} ур.</span>
        </div>
        <strong>${esc(branch.title)}</strong>
        <small>${esc(branch.subtitle)} · ${branchStage(localLevel)}</small>
        <div class="dashboard-branch-track"><i style="width:${progress}%"></i></div>
        <span class="dashboard-branch-xp">${totalXp} XP</span>
      </button>
    `;
  }).join('');
}

function initials(name) {
  return String(name || 'Охотник')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'OH';
}

function setAccountAvatar(element, user, name) {
  if (!element) return;
  if (user?.photoURL) {
    element.innerHTML = `<img src="${esc(user.photoURL)}" alt="Фото аккаунта">`;
  } else {
    element.textContent = initials(name);
  }
}

function updateAccountUi() {
  const displayName = cloudUser?.displayName || db.name || 'Охотник';
  const statusByState = {
    local: cloudConfigured ? 'Готов к синхронизации' : 'Локально',
    syncing: 'Синхронизация…',
    synced: 'Сохранено в облаке',
    error: 'Ошибка синхронизации',
    offline: 'Офлайн-режим'
  };
  const status = cloudUser ? (statusByState[cloudSyncState] || 'Облако подключено') : (cloudConfigured ? 'Google не подключён' : 'Firebase не настроен');

  $('#accountLabel').textContent = cloudUser ? displayName : 'Гость';
  $('#cloudStatus').textContent = status;
  $('#accountModalName').textContent = cloudUser ? displayName : 'Локальный профиль';
  $('#accountModalEmail').textContent = cloudUser?.email || 'Данные хранятся только на этом устройстве';
  $('#syncTitle').textContent = status;
  $('#syncDescription').textContent = cloudUser
    ? 'Прогресс автоматически синхронизируется между устройствами'
    : (cloudConfigured ? 'Войди через Google для облачного сохранения' : 'Добавь Firebase-конфиг, чтобы включить облако');
  $('#accountGoogleBtn').hidden = !!cloudUser;
  $('#signOutBtn').hidden = !cloudUser;
  $('#syncIndicator').className = `sync-dot ${cloudUser ? cloudSyncState : 'local'}`;

  setAccountAvatar($('#accountAvatar'), cloudUser, displayName);
  setAccountAvatar($('#accountModalAvatar'), cloudUser, displayName);
}

function setAuthMessage(message, type = '') {
  const element = $('#authMessage');
  if (!element) return;
  element.textContent = message;
  element.className = `auth-message ${type}`.trim();
}

async function signInWithGoogle() {
  if (!window.LevelUpCloud?.configured) {
    setAuthMessage('Сначала добавь настройки Firebase из FIREBASE_SETUP.md.', 'error');
    return;
  }

  guestUpgradePending = db.onboarded && !cloudUser;
  setAuthMessage('Открываем вход через Google…');
  try {
    const user = await window.LevelUpCloud.signInGoogle();
    if (!user) return;
    if (user.redirecting) {
      setAuthMessage('Popup заблокирован — перенаправляем на безопасный вход Google…');
      return;
    }

    cloudUser = user;
    db.onboarded = true;
    if (!db.name || db.name === 'Охотник') db.name = user.displayName || db.name;
    localStorage.setItem(ONBOARDING_KEY, '1');
    save({ sync: false });

    $('#onboardingModal')?.close();
    $('#accountModal')?.close();
    updateAccountUi();
    render();

    window.LevelUpCloud?.load?.();
    setAuthMessage('Google подключён. Загружаем и объединяем прогресс…', 'success');
  } catch (error) {
    guestUpgradePending = false;
    console.error(error);
    const messages = {
      'auth/unauthorized-domain': 'Этот домен не добавлен в Firebase Authorized domains.',
      'auth/popup-blocked': 'Браузер заблокировал окно Google. Разреши всплывающие окна.',
      'auth/popup-closed-by-user': 'Окно Google было закрыто до завершения входа.',
      'auth/cancelled-popup-request': 'Предыдущее окно входа было отменено. Попробуй ещё раз.',
      'auth/operation-not-allowed': 'Google-вход не включён в Firebase Authentication.',
      'auth/invalid-api-key': 'Неверный apiKey в firebase-config.js.'
    };
    setAuthMessage(messages[error?.code] || `${error?.code || 'Ошибка'}: ${error?.message || 'Не удалось войти через Google.'}`, 'error');
  }
}

function mergeLists(remoteItems = [], localItems = [], keyOf = item => item.id) {
  const merged = new Map();
  remoteItems.forEach(item => merged.set(keyOf(item), item));
  localItems.forEach(item => {
    const key = keyOf(item);
    merged.set(key, { ...(merged.get(key) || {}), ...item });
  });
  return [...merged.values()];
}

function mergeGuestProgress(local, remote = {}) {
  const mergedStats = Object.fromEntries(
    Object.keys(seed.stats).map(key => [key, Math.max(local.stats?.[key] || 0, remote.stats?.[key] || 0)])
  );

  return {
    ...structuredClone(seed),
    ...remote,
    ...local,
    name: local.name !== 'Охотник' ? local.name : (remote.name || local.name),
    onboarded: true,
    updatedAt: Date.now(),
    streak: Math.max(local.streak || 0, remote.streak || 0),
    lastDay: [local.lastDay, remote.lastDay].filter(Boolean).sort().at(-1) || '',
    stats: mergedStats,
    quests: mergeLists(remote.quests, local.quests, item => item.title),
    tasks: mergeLists(remote.tasks, local.tasks, item => item.title),
    schedule: mergeLists(remote.schedule, local.schedule, item => `${item.time}|${item.title}`),
    money: mergeLists(remote.money, local.money, item => `${item.id}|${item.title}|${item.amount}`),
    photos: local.photos
  };
}

function applyRemoteData(remote) {
  if (!remote || (remote.updatedAt || 0) <= (db.updatedAt || 0)) return;
  const localPhotos = db.photos;
  db = {
    ...structuredClone(seed),
    ...remote,
    stats: { ...seed.stats, ...(remote.stats || {}) },
    photos: localPhotos
  };
  if (cloudUser) db.onboarded = true;
  localStorage.setItem('levelup-data', JSON.stringify(db));
  render();
}

function focusLibraryGroup(groupKey) {
  const card = $(`[data-library-group="${groupKey}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.classList.add('library-group-focus');
  setTimeout(() => card.classList.remove('library-group-focus'), 1300);
}

function maybeShowOnboarding() {
  const modal = $('#onboardingModal');
  const onboardingDone = db.onboarded || localStorage.getItem(ONBOARDING_KEY) === '1';
  if (!modal || onboardingDone || modal.open) return;
  const input = $('#onboardingName');
  if (input) input.value = db.name && db.name !== 'Охотник' ? db.name : '';
  modal.showModal();
}

function completeOnboarding(name) {
  db.name = (name || '').trim() || 'Охотник';
  db.onboarded = true;
  localStorage.setItem(ONBOARDING_KEY, '1');
  save();
  $('#onboardingModal')?.close();
  render();
}

function resetDay() {
  let d = today();
  if (db.lastDay && db.lastDay !== d) {
    let y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    db.streak = db.lastDay === y && db.quests.some(q => q.done) ? db.streak + 1 : 0;
    db.quests.forEach(q => q.done = false);
    db.tasks.forEach(q => q.done = false);
    db.lastDay = d;
    save();
  }
  if (!db.lastDay) {
    db.lastDay = d;
    save();
  }
}

function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не удалось открыть изображение'));
      image.onload = () => {
        let width = image.width;
        let height = image.height;
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * maxSize / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#070b16';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setPhotoElement(imageSelector, fallbackSelector, photo) {
  const image = $(imageSelector);
  const fallback = $(fallbackSelector);
  if (!image || !fallback) return;
  if (photo) {
    image.src = photo;
    image.hidden = false;
    fallback.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    fallback.hidden = false;
  }
}

function renderPhotos() {
  setPhotoElement('#avatarImage', '#avatarFallback', db.photos.avatar);
  setPhotoElement('#characterImage', '#characterFallback', db.photos.avatar);

  const photoGrid = $('#photoGrid');
  if (!photoGrid) return;
  photoGrid.innerHTML = `
    ${photoCard('before', 'До', db.photos.before)}
    ${photoCard('after', 'После', db.photos.after)}
  `;
}

function photoCard(type, title, photo) {
  return `
    <article class="panel photo-card">
      <div class="photo-preview">
        ${photo ? `<img src="${photo}" alt="Фотография ${esc(title)}">` : '<span>📷</span>'}
      </div>
      <h3>${esc(title)}</h3>
      <button type="button" class="photo-button" data-photo="${type}">
        ${photo ? 'Изменить фото' : 'Добавить фото'}
      </button>
      ${photo ? `<button type="button" class="photo-remove" data-remove-photo="${type}">Удалить</button>` : ''}
    </article>
  `;
}

function renderNextRankProgress(currentRank, level) {
  const box = $('#nextRankProgress');
  if (!box) return;

  const currentIndex = RANKS.findIndex(x => x.name === currentRank.name);
  const nextRank = RANKS[currentIndex + 1];

  if (!nextRank) {
    box.style.setProperty('--next-rank-color', currentRank.color);
    box.innerHTML = `
      <div class="next-rank-head">
        <span class="next-rank-label">Вершина достигнута: <b>${esc(currentRank.name)}</b></span>
        <span class="next-rank-pill max">MAX</span>
      </div>
      <div class="next-rank-foot">Открыты все ступени рангов.</div>
    `;
    return;
  }

  const levelsLeft = Math.max(nextRank.level - level, 0);
  const levelSpan = Math.max(nextRank.level - currentRank.level, 1);
  const passed = Math.min(Math.max(level - currentRank.level, 0), levelSpan);
  const progress = Math.round((passed / levelSpan) * 100);

  box.style.setProperty('--next-rank-color', nextRank.color);
  box.innerHTML = `
    <div class="next-rank-head">
      <span class="next-rank-label">Следующий ранг: <b>${esc(nextRank.name)}</b></span>
      <span class="next-rank-pill">${levelsLeft === 0 ? 'Готов к апу' : `Осталось ${levelsLeft} ур.`}</span>
    </div>
    <div class="next-rank-track"><i style="width:${progress}%"></i></div>
    <div class="next-rank-foot">${level} → ${nextRank.level} ур. · ${esc(nextRank.percentile)} перцентиль</div>
  `;
}

function renderAscension(currentRank, level) {
  const path = $('#rankPath');
  if (!path) return;
  const totalRanks = RANKS.length;

  path.innerHTML = RANKS.map((rankInfo, index) => {
    const { name, level: reqLevel, color, description, percentile, score403030, score333334 } = rankInfo;
    const isUnlocked = level >= reqLevel;
    const isCurrent = currentRank.name === name;
    const statusLabel = isCurrent
      ? '<span class="current-label">Текущий</span>'
      : `<span class="state-label ${isUnlocked ? 'open' : 'locked'}">${isUnlocked ? 'Открыт' : 'Закрыт'}</span>`;

    return `
      <article class="rank-step ${isUnlocked ? 'active' : 'locked'} ${isCurrent ? 'current' : ''}" style="--rank-color:${color}">
        <div class="rank-letter-wrap">
          <div class="rank-letter">${name}</div>
          <span class="rank-order">${index + 1}/${totalRanks}</span>
        </div>
        <div class="rank-info">
          <div class="rank-title-row">
            <div class="rank-head">
              <div class="rank-name">Ранг ${name}</div>
              <div class="rank-req">${isUnlocked ? 'Доступен' : 'Откроется'} на уровне ${reqLevel}</div>
              <div class="rank-percentile">${percentile} перцентиль</div>
            </div>
            ${statusLabel}
          </div>
          <details class="rank-details">
            <summary>Подробнее</summary>
            <p class="rank-desc">${esc(description)}</p>
            <div class="rank-meta">
              <span class="rank-chip">Перцентиль: ${esc(percentile)}</span>
              <span class="rank-chip">40/30/30: ${esc(score403030)}</span>
              <span class="rank-chip">33/33/34: ${esc(score333334)}</span>
            </div>
          </details>
        </div>
      </article>
    `;
  }).join('');

  $('#characterRank').textContent = currentRank.name;
  $('#characterLevel').textContent = level;
  $('#characterDescription').textContent = `${currentRank.description} · ${currentRank.percentile} перцентиль`;
  renderNextRankProgress(currentRank, level);
}

function renderLibrary() {
  const root = $('#libraryList');
  if (!root || typeof LIBRARY === 'undefined') return;
  root.innerHTML = Object.entries(LIBRARY).map(([key, group]) => `
    <article class="panel library-group" data-library-group="${key}">
      <div class="library-head"><b>${group.title}</b><span>${group.label}</span></div>
      <div class="library-items">${group.items.slice(0, 5).map((item, i) => preset(key, i, item)).join('')}</div>
      ${group.items.length > 5 ? `<button class="show-more" data-show="${key}">Показать все ${group.items.length}</button>` : ''}
    </article>
  `).join('');
}

function preset(group, index, item) {
  return `
    <div class="preset-wrap">
      <div class="preset"><span class="preset-title">${esc(item.title)}</span><button data-add-preset="${group}" data-index="${index}">+ Добавить</button></div>
      <details class="preset-details"><summary>Подробнее</summary><p><b>Как:</b> ${esc(item.how)}</p><p><b>Зачем:</b> ${esc(item.why)}</p><p><b>Долгосрочно:</b> ${esc(item.long)}</p><small>${esc(item.source)}</small></details>
    </div>
  `;
}

function showGroup(key) {
  const group = LIBRARY[key];
  const card = $(`[data-library-group="${key}"]`);
  if (!group || !card) return;
  card.querySelector('.library-items').innerHTML = group.items.map((item, i) => preset(key, i, item)).join('');
  card.querySelector('[data-show]')?.remove();
}

function item(q, side, type) {
  return `
    <article class="item ${q.done ? 'done' : ''}">
      <button class="check" data-toggle="${type}" data-id="${q.id}">${q.done ? '✓' : ''}</button>
      <div class="item-main"><div class="item-title">${esc(q.title)}</div></div>
      ${side}
      <button class="delete" data-del="${type}" data-id="${q.id}">×</button>
    </article>
  `;
}

function fmt(n) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₸';
}

function collection(type) {
  return { quest: 'quests', task: 'tasks', schedule: 'schedule', money: 'money' }[type];
}

function open(type) {
  modalType = type;
  $('#modalTitle').textContent = {
    quest: 'Новый квест',
    task: 'Новая задача',
    schedule: 'Событие в расписании',
    money: 'Финансовая операция'
  }[type];
  let f = '<label>Название<input name="title" required maxlength="60" autofocus></label>';
  if (type === 'quest') f += '<label>Характеристика<select name="stat">' + STAT.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('') + '</select></label><label>Опыт за квест<input name="xp" type="number" min="1" value="15"></label>';
  if (type === 'schedule') f = '<label>Время<input name="time" type="time" required value="09:00"></label>' + f;
  if (type === 'money') f += '<label>Тип<select name="type"><option value="expense">Расход</option><option value="income">Доход</option></select></label><label>Сумма, ₸<input name="amount" type="number" min="1" required></label>';
  $('#formFields').innerHTML = f;
  $('#modal').showModal();
}

document.addEventListener('click', e => {
  const closeButton = e.target.closest('button.close');
  if (closeButton && !closeButton.classList.contains('ghost')) {
    closeButton.closest('dialog')?.close();
    return;
  }

  const tab = e.target.closest('[data-page]');
  if (tab) goToPage(tab.dataset.page);

  const branchOpen = e.target.closest('[data-branch-open]');
  if (branchOpen) {
    const key = branchOpen.dataset.branchOpen;
    $('#treeModal')?.close();
    goToPage('library');
    showGroup(key);
    focusLibraryGroup(key);
  }

  const op = e.target.closest('[data-open]');
  if (op) open(op.dataset.open);
  const more = e.target.closest('[data-show]');
  if (more) showGroup(more.dataset.show);
  const presetBtn = e.target.closest('[data-add-preset]');
  if (presetBtn) {
    const group = LIBRARY[presetBtn.dataset.addPreset];
    const source = group.items[+presetBtn.dataset.index];
    const list = collection(group.type);
    if (db[list].some(x => x.title === source.title)) return alert('Этот пункт уже добавлен');
    const itemObj = { id: Date.now(), title: source.title, done: false };
    if (group.type === 'quest') Object.assign(itemObj, { stat: source.stat, xp: 15 });
    db[list].push(itemObj);
    save();
    presetBtn.textContent = 'Добавлено';
    presetBtn.disabled = true;
    render();
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    const c = collection(del.dataset.del);
    db[c] = db[c].filter(x => x.id != del.dataset.id);
    save();
    render();
  }
  const tog = e.target.closest('[data-toggle]');
  if (tog) {
    const q = db[collection(tog.dataset.toggle)].find(x => x.id == tog.dataset.id);
    q.done = !q.done;
    if (tog.dataset.toggle === 'quest') db.stats[q.stat] += q.done ? q.xp : -q.xp;
    save();
    render();
  }

  const photoButton = e.target.closest('[data-photo]');
  if (photoButton) {
    photoTarget = photoButton.dataset.photo;
    $('#photoInput').value = '';
    $('#photoInput').click();
  }

  const removePhotoButton = e.target.closest('[data-remove-photo]');
  if (removePhotoButton) {
    const type = removePhotoButton.dataset.removePhoto;
    if (confirm('Удалить фотографию?')) {
      db.photos[type] = null;
      save();
      render();
    }
  }
});

$('#modal')?.addEventListener('close', () => {
  modalType = '';
  $('#form')?.reset();
});

$('#form').addEventListener('submit', e => {
  e.preventDefault();

  const listKey = collection(modalType);
  if (!listKey || !db[listKey]) {
    console.warn('Modal type is not set, closing dialog safely.');
    $('#modal').close();
    return;
  }

  const x = Object.fromEntries(new FormData(e.target));
  const obj = { id: Date.now(), title: x.title, done: false };
  if (modalType === 'quest') Object.assign(obj, { stat: x.stat, xp: +x.xp });
  if (modalType === 'schedule') obj.time = x.time;
  if (modalType === 'money') Object.assign(obj, { type: x.type, amount: +x.amount });

  db[listKey].push(obj);
  save();
  $('#modal').close();
  render();
});

$('#settingsBtn').onclick = () => {
  $('#nameInput').value = db.name;
  $('#settings').showModal();
};

$('#nameTreeBtn')?.addEventListener('click', () => {
  renderBranchTree();
  $('#treeModal')?.showModal();
});

$('#openTreeBtn')?.addEventListener('click', () => {
  renderBranchTree();
  $('#treeModal')?.showModal();
});

$('#accountBtn')?.addEventListener('click', () => {
  updateAccountUi();
  $('#accountModal')?.showModal();
});

$('#googleSignInBtn')?.addEventListener('click', signInWithGoogle);
$('#accountGoogleBtn')?.addEventListener('click', signInWithGoogle);
$('#signOutBtn')?.addEventListener('click', async () => {
  guestUpgradePending = false;
  await window.LevelUpCloud?.signOut?.();
  $('#accountModal')?.close();
});

window.addEventListener('levelup:auth-error', event => {
  const messages = {
    'auth/unauthorized-domain': 'Этот домен не добавлен в Firebase Authorized domains.',
    'auth/operation-not-allowed': 'Google-вход не включён в Firebase Authentication.',
    'auth/invalid-api-key': 'Неверный apiKey в firebase-config.js.'
  };
  const code = event.detail?.code;
  setAuthMessage(messages[code] || `${code || 'Ошибка'}: ${event.detail?.message || 'Не удалось завершить Google-вход.'}`, 'error');
});

window.addEventListener('levelup:auth-change', event => {
  cloudConfigured = event.detail?.configured ?? !!window.LevelUpCloud?.configured;
  cloudUser = event.detail?.user || null;

  if (cloudUser) {
    const wasNotOnboarded = !db.onboarded;
    if (wasNotOnboarded) {
      db.name = cloudUser.displayName || db.name || 'Охотник';
      db.onboarded = true;
      save({ sync: false });
    }
    localStorage.setItem(ONBOARDING_KEY, '1');
    $('#onboardingModal')?.close();
    if (wasNotOnboarded) render();
  }

  updateAccountUi();
});

window.addEventListener('levelup:remote-data', event => {
  const remote = event.detail?.data;

  if (guestUpgradePending && cloudUser) {
    db = mergeGuestProgress(db, remote || {});
    guestUpgradePending = false;
    localStorage.setItem(ONBOARDING_KEY, '1');
    save();
    render();
    return;
  }

  if (!remote && cloudUser) {
    window.LevelUpCloud?.save?.(cloudData());
    return;
  }
  if ((remote?.updatedAt || 0) > (db.updatedAt || 0)) applyRemoteData(remote);
  else if (remote && cloudUser) window.LevelUpCloud?.save?.(cloudData());
});

window.addEventListener('levelup:sync-state', event => {
  const rawState = event.detail?.state || 'local';
  const stateMap = {
    queued: 'syncing',
    saving: 'syncing',
    loading: 'syncing',
    'signing-in': 'syncing',
    saved: 'synced',
    loaded: 'synced',
    'signed-out': 'local',
    unavailable: 'local'
  };
  cloudSyncState = stateMap[rawState] || rawState;
  updateAccountUi();
});

$('#onboardingForm')?.addEventListener('submit', e => {
  e.preventDefault();
  completeOnboarding($('#onboardingName')?.value);
});

$('#skipOnboardingBtn')?.addEventListener('click', () => {
  completeOnboarding(db.name || 'Охотник');
});

$('#onboardingModal')?.addEventListener('cancel', e => {
  if (!db.onboarded) e.preventDefault();
});

$('#settingsForm').addEventListener('submit', e => {
  e.preventDefault();
  db.name = $('#nameInput').value.trim() || 'Охотник';
  db.onboarded = true;
  localStorage.setItem(ONBOARDING_KEY, '1');
  save();
  $('#settings').close();
  render();
});

$('#resetBtn').onclick = () => {
  if (confirm('Стереть весь прогресс?')) {
    db = structuredClone(seed);
    localStorage.removeItem(ONBOARDING_KEY);
    save();
    $('#settings').close();
    render();
  }
};

$('#avatarBtn').addEventListener('click', () => {
  photoTarget = 'avatar';
  $('#photoInput').value = '';
  $('#photoInput').click();
});

$('#characterImage')?.closest('.character-photo')?.addEventListener('click', () => {
  photoTarget = 'avatar';
  $('#photoInput').value = '';
  $('#photoInput').click();
});

$('#photoInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file || !photoTarget) return;
  if (!file.type.startsWith('image/')) {
    alert('Выберите изображение');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    alert('Файл слишком большой. Максимальный размер — 15 МБ.');
    return;
  }
  try {
    const compressedPhoto = await compressImage(file);
    db.photos[photoTarget] = compressedPhoto;
    save();
    render();
  } catch (error) {
    console.error(error);
    alert('Не удалось загрузить фотографию');
  } finally {
    event.target.value = '';
    photoTarget = '';
  }
});

function render() {
  resetDay();
  let l = level(), r = rank();
  let inM = db.money.filter(x => x.type === 'income').reduce((a, x) => a + x.amount, 0);
  let outM = db.money.filter(x => x.type === 'expense').reduce((a, x) => a + x.amount, 0);

  $('#dateLabel').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('#heroName').textContent = db.name;
  $('#level').textContent = l;
  $('#xpLabel').textContent = `${xp() % 100} / 100 XP`;
  $('#xpBar').style.width = `${xp() % 100}%`;
  $('#rankBadge').textContent = r.name;
  $('#rankBadge').style.cssText = `border-color:${r.color};color:${r.color};box-shadow:0 0 20px ${r.color}55`;
  $('#rankText').textContent = `${r.description} · ${r.percentile} перцентиль`;
  $('#streak').textContent = db.streak;
  $('#streakSmall').textContent = db.streak;
  $('#questCount').textContent = `${db.quests.filter(x => x.done).length} / ${db.quests.length}`;
  $('#balance').textContent = fmt(inM - outM);
  $('#bigBalance').textContent = fmt(inM - outM);
  $('#income').textContent = `Доходы: ${fmt(inM)}`;
  $('#expense').textContent = `Расходы: ${fmt(outM)}`;

  $('#questList').innerHTML = db.quests.length
    ? db.quests.map(q => item(q, `<span class="tag">${STAT.find(s => s[0] === q.stat)?.[1] || 'Общее'} · +${q.xp} XP</span>`, 'quest')).join('')
    : '<p class="item-sub">Квестов пока нет — добавь первый.</p>';

  $('#taskList').innerHTML = db.tasks.length
    ? db.tasks.map(q => item(q, '<span class="tag">Задача</span>', 'task')).join('')
    : '<p class="item-sub">Выбери до 3 главных задач.</p>';

  $('#scheduleList').innerHTML = db.schedule.length
    ? db.schedule.sort((a, b) => a.time.localeCompare(b.time)).map(q => `<article class="item"><b class="tag">${q.time}</b><div class="item-main"><div class="item-title">${esc(q.title)}</div></div><button class="delete" data-del="schedule" data-id="${q.id}">×</button></article>`).join('')
    : '<p class="item-sub">Запланируй время для важных дел.</p>';

  $('#moneyList').innerHTML = db.money.length
    ? db.money.slice().reverse().map(m => `<article class="item"><b class="${m.type}">${m.type === 'income' ? '+' : '−'} ${fmt(m.amount)}</b><div class="item-main"><div class="item-title">${esc(m.title)}</div></div><button class="delete" data-del="money" data-id="${m.id}">×</button></article>`).join('')
    : '<p class="item-sub">Добавь доходы и расходы за месяц.</p>';

  $('#statGrid').innerHTML = STAT.map(s => {
    let v = db.stats[s[0]], lv = Math.floor(v / 100) + 1;
    return `<article class="stat panel"><div class="stat-head"><b>${s[2]} ${s[1]}</b><span>${lv} ур.</span></div><div class="progress"><i style="width:${v % 100}%;background:${s[3]}"></i></div><small>${v % 100} / 100 XP</small></article>`;
  }).join('');

  renderAscension(r, l);
  renderLibrary();
  renderBranchTree();
  renderDashboardBranches();
  renderPhotos();
  updateAccountUi();
  maybeShowOnboarding();
}

cloudConfigured = !!window.LevelUpCloud?.configured;
cloudUser = window.LevelUpCloud?.getUser?.() || null;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
render();