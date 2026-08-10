import { DEFAULT_NAME, SCHEMA_VERSION } from './constants.js';
import { normalize, questKey } from './schema.js';

function mergeById(localItems = [], remoteItems = []) {
  const merged = new Map();
  for (const item of remoteItems) merged.set(item.id, item);
  for (const item of localItems) merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

/**
 * Объединение журналов — обычное объединение множеств: запись за день либо есть,
 * либо нет. Одинаковый квест, выполненный на двух устройствах, остаётся одной
 * записью, поэтому опыт не удваивается.
 */
function mergeCompletions(local = {}, remote = {}) {
  const result = {};

  for (const day of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const entries = { ...remote[day], ...local[day] };
    if (Object.keys(entries).length > 0) result[day] = entries;
  }

  return result;
}

function mergeTaskDone(local = {}, remote = {}) {
  const result = {};

  for (const day of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const entries = { ...remote[day], ...local[day] };
    const keys = Object.keys(entries).filter(key => entries[key] === true);
    if (keys.length > 0) result[day] = Object.fromEntries(keys.map(key => [key, true]));
  }

  return result;
}

function pickName(local, remote) {
  if (local.name && local.name !== DEFAULT_NAME) return local.name;
  if (remote.name && remote.name !== DEFAULT_NAME) return remote.name;
  return local.name || remote.name || DEFAULT_NAME;
}

/**
 * Сводит два состояния в одно так, что порядок аргументов не влияет на опыт
 * и историю. Списки объединяются по id, журналы — по дню и ключу квеста,
 * поэтому расхождение системных часов больше не приводит к потере данных.
 */
export function mergeStates(localRaw, remoteRaw) {
  const local = normalize(localRaw);
  const remote = normalize(remoteRaw);

  const questsById = mergeById(local.quests, remote.quests);
  const seenQuestKeys = new Set();
  const quests = questsById.filter(quest => {
    const key = questKey(quest.title);
    if (seenQuestKeys.has(key)) return false;
    seenQuestKeys.add(key);
    return true;
  });

  return normalize({
    schemaVersion: SCHEMA_VERSION,
    name: pickName(local, remote),
    onboarded: local.onboarded || remote.onboarded,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    lastDay: [local.lastDay, remote.lastDay].filter(Boolean).sort().at(-1) || '',
    quests,
    tasks: mergeById(local.tasks, remote.tasks),
    schedule: mergeById(local.schedule, remote.schedule),
    money: mergeById(local.money, remote.money),
    completions: mergeCompletions(local.completions, remote.completions),
    taskDone: mergeTaskDone(local.taskDone, remote.taskDone),
    legacyStreak: Math.max(local.legacyStreak, remote.legacyStreak)
  });
}
