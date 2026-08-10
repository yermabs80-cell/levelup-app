import { SCHEMA_VERSION, STAT_IDS, DEFAULT_NAME } from './constants.js';

/**
 * Ключ выполнения — нормализованное название квеста, а не его id.
 * Благодаря этому повторное добавление удалённого квеста не даёт второй раз
 * начислить опыт за тот же день, а мердж между устройствами остаётся идемпотентным.
 */
export function questKey(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function todayKey(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function shiftDay(dayKey, deltaDays) {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function monthKey(dayKey) {
  return String(dayKey || '').slice(0, 7);
}

export function createSeed() {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: DEFAULT_NAME,
    onboarded: false,
    updatedAt: 0,
    lastDay: '',
    quests: [
      { id: 'q-water', title: 'Выпить стакан воды', stat: 'health', xp: 10 },
      { id: 'q-workout', title: 'Сделать зарядку 10 минут', stat: 'strength', xp: 15 },
      { id: 'q-read', title: 'Прочитать 10 страниц', stat: 'intellect', xp: 15 }
    ],
    tasks: [],
    schedule: [],
    money: [],
    completions: {},
    taskDone: {},
    focusSessions: []
  };
}

function sanitizeAmount(value) {
  const amount = Math.round(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function dayFromId(id) {
  const timestamp = Number(String(id).replace(/\D/g, ''));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return todayKey();
  return todayKey(new Date(timestamp));
}

/**
 * Миграция v1 → v2.
 * В v1 опыт лежал в мутируемом db.stats, а выполнение — во флаге quest.done.
 * Переносим накопленный опыт в отдельную запись журнала, чтобы ничего не потерять,
 * и пересобираем сегодняшние отметки из старых флагов.
 */
function migrateFromV1(raw) {
  const seed = createSeed();
  const day = raw.lastDay || todayKey();
  const legacyStats = {};

  for (const statId of STAT_IDS) {
    const value = Math.round(Number(raw.stats?.[statId]));
    if (Number.isFinite(value) && value > 0) legacyStats[statId] = value;
  }

  const completions = {};
  if (Object.keys(legacyStats).length > 0) {
    completions['1970-01-01'] = { '@legacy-v1': { stats: legacyStats } };
  }

  const quests = Array.isArray(raw.quests) ? raw.quests : seed.quests;
  const todayCompletions = {};
  for (const quest of quests) {
    if (!quest?.done) continue;
    const stat = STAT_IDS.includes(quest.stat) ? quest.stat : 'discipline';
    todayCompletions[questKey(quest.title)] = { stat, xp: sanitizeAmount(quest.xp) || 15 };
  }
  if (Object.keys(todayCompletions).length > 0) completions[day] = todayCompletions;

  const taskDone = {};
  const doneTasks = (Array.isArray(raw.tasks) ? raw.tasks : []).filter(task => task?.done);
  if (doneTasks.length > 0) {
    taskDone[day] = Object.fromEntries(doneTasks.map(task => [questKey(task.title), true]));
  }

  return { ...raw, completions, taskDone, legacyStreak: Number(raw.streak) || 0 };
}

/** Приводит любые данные (из localStorage или облака) к актуальной схеме. */
export function normalize(raw) {
  const seed = createSeed();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return seed;

  const source = Number(raw.schemaVersion) >= 2 ? raw : migrateFromV1(raw);
  const name = String(source.name || '').trim().slice(0, 24) || DEFAULT_NAME;

  const quests = (Array.isArray(source.quests) ? source.quests : []).map((quest, index) => ({
    id: String(quest?.id ?? `q-${index}`),
    title: String(quest?.title || '').trim().slice(0, 80),
    stat: STAT_IDS.includes(quest?.stat) ? quest.stat : 'discipline',
    xp: sanitizeAmount(quest?.xp) || 15
  })).filter(quest => quest.title);

  const tasks = (Array.isArray(source.tasks) ? source.tasks : []).map((task, index) => ({
    id: String(task?.id ?? `t-${index}`),
    title: String(task?.title || '').trim().slice(0, 80)
  })).filter(task => task.title);

  const schedule = (Array.isArray(source.schedule) ? source.schedule : []).map((entry, index) => ({
    id: String(entry?.id ?? `s-${index}`),
    time: /^\d{2}:\d{2}$/.test(entry?.time) ? entry.time : '09:00',
    title: String(entry?.title || '').trim().slice(0, 80)
  })).filter(entry => entry.title);

  const money = (Array.isArray(source.money) ? source.money : []).map((entry, index) => ({
    id: String(entry?.id ?? `m-${index}`),
    title: String(entry?.title || '').trim().slice(0, 80),
    type: entry?.type === 'income' ? 'income' : 'expense',
    amount: sanitizeAmount(entry?.amount),
    date: /^\d{4}-\d{2}-\d{2}$/.test(entry?.date) ? entry.date : dayFromId(entry?.id)
  })).filter(entry => entry.title && entry.amount > 0);

  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    onboarded: source.onboarded === true || name !== DEFAULT_NAME,
    updatedAt: Number(source.updatedAt) || 0,
    lastDay: /^\d{4}-\d{2}-\d{2}$/.test(source.lastDay) ? source.lastDay : '',
    quests,
    tasks,
    schedule,
    money,
    completions: normalizeCompletions(source.completions),
    taskDone: normalizeTaskDone(source.taskDone),
    focusSessions: normalizeFocusSessions(source.focusSessions),
    legacyStreak: Number(source.legacyStreak) || 0
  };
}

function normalizeFocusSessions(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(session => ({
      id: String(session?.id ?? ''),
      day: /^\d{4}-\d{2}-\d{2}$/.test(session?.day) ? session.day : '',
      minutes: Math.max(0, Math.round(Number(session?.minutes) || 0))
    }))
    .filter(session => session.id && session.day && session.minutes > 0)
    // Держим журнал ограниченным: год ежедневных сессий с запасом.
    .slice(-2000);
}

function normalizeCompletions(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const result = {};

  for (const [day, entries] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !entries || typeof entries !== 'object') continue;
    const dayEntries = {};

    for (const [key, entry] of Object.entries(entries)) {
      if (entry?.stats && typeof entry.stats === 'object') {
        const stats = {};
        for (const statId of STAT_IDS) {
          const value = Math.round(Number(entry.stats[statId]));
          if (Number.isFinite(value) && value > 0) stats[statId] = value;
        }
        if (Object.keys(stats).length > 0) dayEntries[key] = { stats };
        continue;
      }
      const xp = sanitizeAmount(entry?.xp);
      if (xp > 0 && STAT_IDS.includes(entry?.stat)) dayEntries[key] = { stat: entry.stat, xp };
    }

    if (Object.keys(dayEntries).length > 0) result[day] = dayEntries;
  }

  return result;
}

function normalizeTaskDone(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const result = {};

  for (const [day, entries] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !entries || typeof entries !== 'object') continue;
    const keys = Object.keys(entries).filter(key => entries[key] === true);
    if (keys.length > 0) result[day] = Object.fromEntries(keys.map(key => [key, true]));
  }

  return result;
}
