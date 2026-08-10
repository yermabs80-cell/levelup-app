// Разовый конвертер старой library.js в сгруппированный формат.
// Запускается вручную: node scripts/convert-library.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('library.js', 'utf8');

// Отрезаем старые определения pack/ten/uniqByTitle — подставим свои,
// которые сохраняют тему трека вместо того, чтобы её терять при flatMap.
const body = source
  .replace(/^const pack=.*$/m, '')
  .replace(/^const ten=.*$/m, '')
  .replace(/^const uniqByTitle=.*$/m, '');

const pack = (src, tracks) =>
  tracks.map(([stat, theme, how, long, items]) => ({ stat, theme, how, long, items, source: src }));

const ten = (...values) => values;

const uniqByTitle = groups => {
  const seen = new Set();
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(title => {
        const key = title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    }))
    .filter(group => group.items.length > 0);
};

const factory = new Function('pack', 'ten', 'uniqByTitle', `${body}\nreturn { LIBRARY, HABITS, ISLAM_KVSETY };`);
const { LIBRARY, HABITS } = factory(pack, ten, uniqByTitle);

const BRANCH_STATS = {
  forcePath: ['strength', 'health'],
  mindPath: ['intellect', 'knowledge', 'skills'],
  financePath: ['wealth'],
  faithPath: ['faith', 'discipline']
};

// HABITS раньше объявлялся, но нигде не использовался — раскладываем его треки
// по веткам согласно характеристике, чтобы 123 строки контента заработали.
for (const [branchKey, stats] of Object.entries(BRANCH_STATS)) {
  const extra = HABITS.filter(group => stats.includes(group.stat));
  if (extra.length > 0) LIBRARY[branchKey].items.push(...extra);
}

const result = {};
for (const [key, group] of Object.entries(LIBRARY)) {
  const seen = new Set();
  const groups = [];

  for (const track of group.items) {
    const items = track.items.filter(title => {
      const normalized = title.trim().toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
    if (items.length === 0) continue;

    groups.push({
      theme: track.theme,
      stat: track.stat,
      how: track.how,
      impact: track.long,
      source: track.source,
      items
    });
  }

  result[key] = { title: group.title, label: group.label, type: group.type, groups };
}

const totals = Object.entries(result)
  .map(([key, group]) => `${key}: ${group.groups.length} тем, ${group.groups.reduce((sum, g) => sum + g.items.length, 0)} квестов`)
  .join('\n');

const output = `/**
 * Библиотека квестов: четыре ветки, внутри — тематические группы.
 * Тема больше не подменяет поле «зачем»: у группы есть свой заголовок,
 * подсказка «как» и объяснение долгосрочной пользы.
 */
export const LIBRARY = ${JSON.stringify(result, null, 2)};

export const LIBRARY_KEYS = Object.keys(LIBRARY);

export function countQuests(branchKey) {
  return LIBRARY[branchKey].groups.reduce((sum, group) => sum + group.items.length, 0);
}

export function findQuest(branchKey, groupIndex, itemIndex) {
  const group = LIBRARY[branchKey]?.groups[groupIndex];
  const title = group?.items[itemIndex];
  if (!group || !title) return null;
  return { title, stat: group.stat, how: group.how, impact: group.impact, source: group.source, theme: group.theme };
}
`;

writeFileSync('src/data/library.js', output);
console.log(totals);
