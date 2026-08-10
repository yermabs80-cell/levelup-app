import {
  RANKS,
  STAT_IDS,
  TREE_STAGES,
  TREE_STAGE_LEVELS,
  TREE_XP_STEP,
  XP_PER_LEVEL
} from './constants.js';
import { monthKey, questKey, shiftDay, todayKey } from './schema.js';

/**
 * Опыт по характеристикам — производная от журнала выполнений.
 * Удаление квеста больше не оставляет «осиротевший» опыт: его нельзя накрутить
 * циклом добавил → выполнил → удалил, потому что за день по каждому ключу
 * засчитывается ровно одна запись.
 */
export function computeStats(state) {
  const stats = Object.fromEntries(STAT_IDS.map(id => [id, 0]));

  for (const entries of Object.values(state.completions || {})) {
    for (const entry of Object.values(entries)) {
      if (entry.stats) {
        for (const [statId, value] of Object.entries(entry.stats)) {
          if (statId in stats) stats[statId] += value;
        }
        continue;
      }
      if (entry.stat in stats) stats[entry.stat] += entry.xp;
    }
  }

  return stats;
}

export function totalXp(stats) {
  return Object.values(stats).reduce((sum, value) => sum + value, 0);
}

export function levelFromXp(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp) {
  const current = xp % XP_PER_LEVEL;
  return { current, target: XP_PER_LEVEL, percent: (current / XP_PER_LEVEL) * 100 };
}

export function rankForLevel(level) {
  return RANKS.findLast(rank => level >= rank.level) ?? RANKS[0];
}

export function nextRank(currentRank) {
  const index = RANKS.findIndex(rank => rank.name === currentRank.name);
  return RANKS[index + 1] ?? null;
}

export function branchXp(stats, statKeys) {
  return statKeys.reduce((sum, key) => sum + (stats[key] || 0), 0);
}

export function branchProgress(stats, branch) {
  const xp = branchXp(stats, branch.stats);
  const level = Math.floor(xp / TREE_XP_STEP) + 1;
  const inStep = xp % TREE_XP_STEP;
  const stageIndex = Math.min(TREE_STAGES.length - 1, Math.floor((level - 1) / TREE_STAGE_LEVELS));

  return {
    xp,
    level,
    percent: (inStep / TREE_XP_STEP) * 100,
    toNext: TREE_XP_STEP - inStep,
    stage: TREE_STAGES[stageIndex]
  };
}

export function isQuestDone(state, quest, day = todayKey()) {
  return Boolean(state.completions?.[day]?.[questKey(quest.title)]);
}

export function isTaskDone(state, task, day = todayKey()) {
  return Boolean(state.taskDone?.[day]?.[questKey(task.title)]);
}

export function dayHasProgress(state, day) {
  return Object.keys(state.completions?.[day] || {}).length > 0;
}

/**
 * Серия считается по журналу, а не по счётчику в состоянии — поэтому она
 * самовосстанавливается после мерджа с другого устройства и не зависит
 * от того, открывал ли пользователь приложение в конкретный день.
 */
export function computeStreak(state, today = todayKey()) {
  let streak = 0;
  let cursor = dayHasProgress(state, today) ? today : shiftDay(today, -1);

  if (cursor !== today && !dayHasProgress(state, cursor)) return 0;

  while (dayHasProgress(state, cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  return streak;
}

export function monthlyMoney(state, day = todayKey()) {
  const month = monthKey(day);
  const entries = (state.money || []).filter(entry => monthKey(entry.date) === month);
  const income = entries
    .filter(entry => entry.type === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries
    .filter(entry => entry.type === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return { entries, income, expense, balance: income - expense };
}

export function todayQuestSummary(state, day = todayKey()) {
  const done = (state.quests || []).filter(quest => isQuestDone(state, quest, day)).length;
  return { done, total: (state.quests || []).length };
}

export function sortedSchedule(state) {
  return [...(state.schedule || [])].sort((a, b) => a.time.localeCompare(b.time));
}

export function recentMoney(state, day = todayKey()) {
  return monthlyMoney(state, day).entries.slice().reverse();
}
