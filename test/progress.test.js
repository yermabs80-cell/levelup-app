import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSeed, normalize, questKey, shiftDay, todayKey } from '../src/core/schema.js';
import { mergeStates } from '../src/core/merge.js';
import {
  computeStats,
  computeStreak,
  levelFromXp,
  monthlyMoney,
  rankForLevel,
  totalXp
} from '../src/core/progress.js';

const TODAY = '2026-08-10';

function stateWith(overrides) {
  return normalize({ ...createSeed(), schemaVersion: 2, ...overrides });
}

test('опыт нельзя накрутить повторным добавлением удалённого квеста', () => {
  // Журнал хранит одну запись на ключ квеста за день, поэтому цикл
  // «выполнил → удалил → добавил снова → выполнил» не удваивает опыт.
  const state = stateWith({
    completions: {
      [TODAY]: { [questKey('Прочитать 10 страниц')]: { stat: 'intellect', xp: 15 } }
    }
  });

  const first = totalXp(computeStats(state));

  state.completions[TODAY][questKey('Прочитать 10 страниц')] = { stat: 'intellect', xp: 15 };
  assert.equal(totalXp(computeStats(state)), first);
});

test('удаление квеста не оставляет осиротевший опыт в другой день', () => {
  const state = stateWith({
    completions: {
      [TODAY]: { [questKey('Сделать зарядку')]: { stat: 'strength', xp: 15 } },
      [shiftDay(TODAY, -1)]: { [questKey('Сделать зарядку')]: { stat: 'strength', xp: 15 } }
    }
  });

  assert.equal(computeStats(state).strength, 30);
});

test('уровень и ранг считаются от суммарного опыта', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(99), 1);
  assert.equal(levelFromXp(100), 2);
  assert.equal(rankForLevel(1).name, 'EEE');
  assert.equal(rankForLevel(30).name, 'B');
  assert.equal(rankForLevel(999).name, 'S');
});

test('серия считается по журналу и переживает пропущенный запуск', () => {
  const completions = {};
  for (let offset = 0; offset < 4; offset += 1) {
    completions[shiftDay(TODAY, -offset)] = { [questKey('Вода')]: { stat: 'health', xp: 10 } };
  }

  assert.equal(computeStreak(stateWith({ completions }), TODAY), 4);
});

test('серия не обнуляется, если сегодня ещё ничего не отмечено', () => {
  const completions = {
    [shiftDay(TODAY, -1)]: { [questKey('Вода')]: { stat: 'health', xp: 10 } },
    [shiftDay(TODAY, -2)]: { [questKey('Вода')]: { stat: 'health', xp: 10 } }
  };

  assert.equal(computeStreak(stateWith({ completions }), TODAY), 2);
});

test('серия рвётся при пропущенном дне', () => {
  const completions = {
    [TODAY]: { [questKey('Вода')]: { stat: 'health', xp: 10 } },
    [shiftDay(TODAY, -3)]: { [questKey('Вода')]: { stat: 'health', xp: 10 } }
  };

  assert.equal(computeStreak(stateWith({ completions }), TODAY), 1);
});

test('баланс считается только за текущий месяц', () => {
  const state = stateWith({
    money: [
      { id: 'm1', title: 'Зарплата', type: 'income', amount: 500000, date: TODAY },
      { id: 'm2', title: 'Еда', type: 'expense', amount: 120000, date: TODAY },
      { id: 'm3', title: 'Старый доход', type: 'income', amount: 900000, date: '2026-05-02' }
    ]
  });

  const month = monthlyMoney(state, TODAY);
  assert.equal(month.income, 500000);
  assert.equal(month.expense, 120000);
  assert.equal(month.balance, 380000);
  assert.equal(month.entries.length, 2);
});

test('мердж коммутативен: порядок устройств не влияет на опыт', () => {
  const deviceA = stateWith({
    name: 'Арслан',
    updatedAt: 10,
    completions: { [TODAY]: { [questKey('Вода')]: { stat: 'health', xp: 10 } } }
  });
  const deviceB = stateWith({
    updatedAt: 5,
    completions: { [TODAY]: { [questKey('Зарядка')]: { stat: 'strength', xp: 15 } } }
  });

  const forward = mergeStates(deviceA, deviceB);
  const backward = mergeStates(deviceB, deviceA);

  assert.equal(totalXp(computeStats(forward)), 25);
  assert.deepEqual(computeStats(forward), computeStats(backward));
});

test('мердж не удваивает опыт за один квест с двух устройств', () => {
  const entry = { [questKey('Вода')]: { stat: 'health', xp: 10 } };
  const merged = mergeStates(
    stateWith({ completions: { [TODAY]: entry } }),
    stateWith({ completions: { [TODAY]: entry } })
  );

  assert.equal(totalXp(computeStats(merged)), 10);
});

test('мердж сохраняет осмысленное имя вместо значения по умолчанию', () => {
  const named = stateWith({ name: 'Арслан' });
  const unnamed = stateWith({ name: 'Охотник' });

  assert.equal(mergeStates(unnamed, named).name, 'Арслан');
  assert.equal(mergeStates(named, unnamed).name, 'Арслан');
});

test('миграция v1 переносит накопленный опыт без потерь', () => {
  const legacy = {
    name: 'Арслан',
    streak: 7,
    lastDay: TODAY,
    stats: { strength: 250, intellect: 120, health: 0 },
    quests: [{ id: 1, title: 'Вода', stat: 'health', xp: 10, done: true }],
    tasks: [],
    schedule: [],
    money: []
  };

  const migrated = normalize(legacy);
  const stats = computeStats(migrated);

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(stats.strength, 250);
  assert.equal(stats.intellect, 120);
  assert.equal(stats.health, 10, 'выполненный сегодня квест переносится в журнал');
  assert.equal(totalXp(stats), 380);
});

test('нормализация выдерживает мусор вместо состояния', () => {
  for (const broken of [null, undefined, 42, 'строка', [], { quests: 'нет' }]) {
    const result = normalize(broken);
    assert.equal(result.schemaVersion, 2);
    assert.ok(Array.isArray(result.quests));
    assert.ok(Array.isArray(result.money));
  }
});

test('нормализация отбрасывает битые записи, а не падает', () => {
  const state = normalize({
    schemaVersion: 2,
    quests: [
      { id: 'ok', title: 'Норм', stat: 'health', xp: 10 },
      { id: 'bad', title: '   ', stat: 'health', xp: 10 },
      { id: 'unknown-stat', title: 'Другое', stat: 'нет-такой', xp: -5 }
    ],
    money: [
      { id: 'm1', title: 'Ок', type: 'income', amount: 100, date: TODAY },
      { id: 'm2', title: 'Плохо', type: 'income', amount: -3, date: TODAY }
    ],
    completions: { 'не-дата': { x: { stat: 'health', xp: 5 } } }
  });

  assert.equal(state.quests.length, 2);
  assert.equal(state.quests[1].stat, 'discipline', 'неизвестная характеристика заменяется');
  assert.equal(state.money.length, 1);
  assert.deepEqual(state.completions, {});
});

test('todayKey возвращает локальную дату в формате ISO', () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});
