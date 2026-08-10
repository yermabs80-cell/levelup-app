import { RANKS, STATS, STAT_BY_ID, TREE_BRANCHES } from '../core/constants.js';
import {
  branchProgress,
  computeStats,
  computeStreak,
  isQuestDone,
  isTaskDone,
  levelFromXp,
  levelProgress,
  monthlyMoney,
  nextRank,
  rankForLevel,
  recentMoney,
  sortedSchedule,
  todayQuestSummary,
  totalXp
} from '../core/progress.js';
import { LIBRARY } from '../data/library.js';
import { $, formatDate, formatMoney, setText, setWidth } from './dom.js';
import { html, raw, setHtml, styleVars } from './html.js';

/** Разворот групп библиотеки живёт вне состояния, чтобы перерисовка его не сбрасывала. */
const expandedGroups = new Set();

export function isGroupExpanded(key) {
  return expandedGroups.has(key);
}

export function expandGroup(key) {
  expandedGroups.add(key);
}

export function toggleGroupExpansion(key) {
  if (expandedGroups.has(key)) expandedGroups.delete(key);
  else expandedGroups.add(key);
  return expandedGroups.has(key);
}

function emptyState(icon, title, hint) {
  return html`
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">${icon}</span>
      <b>${title}</b>
      <small>${hint}</small>
    </div>
  `;
}

export function renderHeader(state) {
  setText('#dateLabel', formatDate());
  setText('#heroName', state.name);
}

export function renderHero(state) {
  const stats = computeStats(state);
  const xp = totalXp(stats);
  const level = levelFromXp(xp);
  const rank = rankForLevel(level);
  const progress = levelProgress(xp);
  const streak = computeStreak(state);

  setText('#level', level);
  setText('#xpLabel', `${progress.current} / ${progress.target} XP`);
  setWidth('#xpBar', progress.percent);
  setText('#rankText', `${rank.description} · ${rank.percentile} перцентиль`);
  setText('#streak', streak);
  setText('#streakSmall', streak);

  const badge = $('#rankBadge');
  if (badge) {
    badge.textContent = rank.name;
    badge.style.setProperty('--rank-color', rank.color);
  }

  const summary = todayQuestSummary(state);
  setText('#questCount', `${summary.done} / ${summary.total}`);

  const money = monthlyMoney(state);
  setText('#balance', formatMoney(money.balance));

  return { stats, level, rank };
}

export function renderQuests(state) {
  const list = $('#questList');
  if (!list) return;

  if (state.quests.length === 0) {
    setHtml(list, emptyState('🎯', 'Квестов пока нет', 'Добавь первый или возьми готовый из базы.'));
    return;
  }

  setHtml(list, state.quests.map(quest => {
    const done = isQuestDone(state, quest);
    const stat = STAT_BY_ID.get(quest.stat);

    return html`
      <article class="item ${done ? 'done' : ''}">
        <button
          class="check"
          type="button"
          data-toggle="quest"
          data-id="${quest.id}"
          role="checkbox"
          aria-checked="${done ? 'true' : 'false'}"
          aria-label="${done ? 'Отменить' : 'Выполнить'}: ${quest.title}"
        >${done ? '✓' : ''}</button>
        <div class="item-main"><div class="item-title">${quest.title}</div></div>
        <span class="tag" style="${styleVars({ '--tag-color': stat?.color ?? '#4de0ff' })}">
          ${stat?.icon ?? '✦'} ${stat?.title ?? 'Общее'} · +${quest.xp} XP
        </span>
        <button class="delete" type="button" data-del="quest" data-id="${quest.id}" aria-label="Удалить квест ${quest.title}">×</button>
      </article>
    `;
  }));
}

export function renderTasks(state) {
  const list = $('#taskList');
  if (!list) return;

  if (state.tasks.length === 0) {
    setHtml(list, emptyState('📌', 'Фокус не выбран', 'Выдели до трёх главных задач на сегодня.'));
    return;
  }

  setHtml(list, state.tasks.map(task => {
    const done = isTaskDone(state, task);

    return html`
      <article class="item ${done ? 'done' : ''}">
        <button
          class="check"
          type="button"
          data-toggle="task"
          data-id="${task.id}"
          role="checkbox"
          aria-checked="${done ? 'true' : 'false'}"
          aria-label="${done ? 'Отменить' : 'Выполнить'}: ${task.title}"
        >${done ? '✓' : ''}</button>
        <div class="item-main"><div class="item-title">${task.title}</div></div>
        <span class="tag">Задача</span>
        <button class="delete" type="button" data-del="task" data-id="${task.id}" aria-label="Удалить задачу ${task.title}">×</button>
      </article>
    `;
  }));
}

export function renderSchedule(state) {
  const list = $('#scheduleList');
  if (!list) return;

  const entries = sortedSchedule(state);
  if (entries.length === 0) {
    setHtml(list, emptyState('🕐', 'Расписание пустое', 'Запланируй время для важных дел.'));
    return;
  }

  setHtml(list, entries.map(entry => html`
    <article class="item schedule-item">
      <b class="tag time-tag">${entry.time}</b>
      <div class="item-main"><div class="item-title">${entry.title}</div></div>
      <button class="delete" type="button" data-del="schedule" data-id="${entry.id}" aria-label="Удалить событие ${entry.title}">×</button>
    </article>
  `));
}

export function renderMoney(state) {
  const money = monthlyMoney(state);
  setText('#bigBalance', formatMoney(money.balance));
  setText('#income', `Доходы: ${formatMoney(money.income)}`);
  setText('#expense', `Расходы: ${formatMoney(money.expense)}`);
  setText('#balance', formatMoney(money.balance));

  const list = $('#moneyList');
  if (!list) return;

  const entries = recentMoney(state);
  if (entries.length === 0) {
    setHtml(list, emptyState('💰', 'Операций за месяц нет', 'Добавь доходы и расходы, чтобы видеть баланс.'));
    return;
  }

  setHtml(list, entries.map(entry => html`
    <article class="item money-item">
      <b class="money-amount ${entry.type}">${entry.type === 'income' ? '+' : '−'} ${formatMoney(entry.amount)}</b>
      <div class="item-main"><div class="item-title">${entry.title}</div></div>
      <button class="delete" type="button" data-del="money" data-id="${entry.id}" aria-label="Удалить операцию ${entry.title}">×</button>
    </article>
  `));
}

export function renderStats(state) {
  const grid = $('#statGrid');
  if (!grid) return;

  const stats = computeStats(state);

  setHtml(grid, STATS.map(stat => {
    const value = stats[stat.id] ?? 0;
    const level = levelFromXp(value);
    const progress = levelProgress(value);

    return html`
      <article class="stat panel" style="${styleVars({ '--stat-color': stat.color })}">
        <div class="stat-head">
          <b><span class="stat-icon">${stat.icon}</span> ${stat.title}</b>
          <span class="stat-level">${level} ур.</span>
        </div>
        <div class="progress"><i style="${styleVars({ width: `${progress.percent}%`, background: stat.color })}"></i></div>
        <small>${progress.current} / ${progress.target} XP</small>
      </article>
    `;
  }));
}

export function renderBranches(state) {
  const stats = computeStats(state);
  const root = $('#dashboardBranches');
  if (!root) return;

  setHtml(root, TREE_BRANCHES.map((branch, index) => {
    const progress = branchProgress(stats, branch);

    return html`
      <button
        type="button"
        class="dashboard-branch"
        data-branch-open="${branch.key}"
        style="${styleVars({ '--branch-accent': branch.color, '--card-delay': `${index * 0.08}s` })}"
      >
        <span class="dashboard-branch-glow" aria-hidden="true"></span>
        <div class="dashboard-branch-top">
          <span class="dashboard-branch-icon" aria-hidden="true">${branch.icon}</span>
          <span class="dashboard-branch-level">${progress.level} ур.</span>
        </div>
        <strong>${branch.title}</strong>
        <small>${branch.subtitle} · ${progress.stage}</small>
        <div class="dashboard-branch-track"><i style="${styleVars({ width: `${progress.percent}%` })}"></i></div>
        <span class="dashboard-branch-xp">${progress.xp} XP</span>
      </button>
    `;
  }));
}

export function renderTree(state) {
  const root = $('#branchTreeRoot');
  if (!root) return;

  const stats = computeStats(state);
  const total = TREE_BRANCHES.reduce((sum, branch) => sum + branchProgress(stats, branch).xp, 0);

  setHtml(root, html`
    <div class="tree-core">
      <b>${state.name}</b>
      <span>Ядро Древа · ${total} XP</span>
    </div>
    <div class="tree-grid">
      ${TREE_BRANCHES.map((branch, index) => {
        const progress = branchProgress(stats, branch);

        return html`
          <button
            type="button"
            class="tree-node"
            data-branch-open="${branch.key}"
            style="${styleVars({ '--tree-color': branch.color, '--float-delay': `${index * 0.2}s` })}"
          >
            <div class="tree-node-top">
              <span class="tree-icon" aria-hidden="true">${branch.icon}</span>
              <div>
                <b>${branch.title}</b>
                <small>${branch.subtitle}</small>
              </div>
            </div>
            <div class="tree-node-meta">${progress.stage} · ${progress.level} ур. · ${progress.xp} XP</div>
            <div class="tree-track"><i style="${styleVars({ width: `${progress.percent}%` })}"></i></div>
            <div class="tree-node-foot">До роста: ${progress.toNext} XP</div>
          </button>
        `;
      })}
    </div>
  `);
}

function nextRankBlock(rank, level) {
  const upcoming = nextRank(rank);

  if (!upcoming) {
    return html`
      <div class="next-rank-head">
        <span class="next-rank-label">Вершина достигнута: <b>${rank.name}</b></span>
        <span class="next-rank-pill max">MAX</span>
      </div>
      <div class="next-rank-foot">Открыты все ступени рангов.</div>
    `;
  }

  const span = Math.max(upcoming.level - rank.level, 1);
  const passed = Math.min(Math.max(level - rank.level, 0), span);
  const percent = (passed / span) * 100;
  const left = Math.max(upcoming.level - level, 0);

  return html`
    <div class="next-rank-head">
      <span class="next-rank-label">Следующий ранг: <b>${upcoming.name}</b></span>
      <span class="next-rank-pill">${left === 0 ? 'Готов к апу' : `Осталось ${left} ур.`}</span>
    </div>
    <div class="next-rank-track"><i style="${styleVars({ width: `${percent}%` })}"></i></div>
    <div class="next-rank-foot">${level} → ${upcoming.level} ур. · ${upcoming.percentile} перцентиль</div>
  `;
}

export function renderAscension(state) {
  const stats = computeStats(state);
  const level = levelFromXp(totalXp(stats));
  const rank = rankForLevel(level);

  setText('#characterRank', rank.name);
  setText('#characterLevel', level);
  setText('#characterDescription', `${rank.description} · ${rank.percentile} перцентиль`);

  const box = $('#nextRankProgress');
  if (box) {
    const upcoming = nextRank(rank);
    box.style.setProperty('--next-rank-color', (upcoming ?? rank).color);
    setHtml(box, nextRankBlock(rank, level));
  }

  const path = $('#rankPath');
  if (!path) return;

  setHtml(path, RANKS.map((entry, index) => {
    const unlocked = level >= entry.level;
    const current = entry.name === rank.name;

    return html`
      <article
        class="rank-step ${unlocked ? 'active' : 'locked'} ${current ? 'current' : ''}"
        style="${styleVars({ '--rank-color': entry.color })}"
      >
        <div class="rank-letter-wrap">
          <div class="rank-letter">${entry.name}</div>
          <span class="rank-order">${index + 1}/${RANKS.length}</span>
        </div>
        <div class="rank-info">
          <div class="rank-title-row">
            <div class="rank-head">
              <div class="rank-name">Ранг ${entry.name}</div>
              <div class="rank-req">${unlocked ? 'Доступен' : 'Откроется'} на уровне ${entry.level}</div>
              <div class="rank-percentile">${entry.percentile} перцентиль</div>
            </div>
            ${current
              ? raw('<span class="current-label">Текущий</span>')
              : html`<span class="state-label ${unlocked ? 'open' : 'locked'}">${unlocked ? 'Открыт' : 'Закрыт'}</span>`}
          </div>
          <details class="rank-details">
            <summary>Подробнее</summary>
            <p class="rank-desc">${entry.description}</p>
            <div class="rank-meta">
              <span class="rank-chip">Перцентиль: ${entry.percentile}</span>
              <span class="rank-chip">40/30/30: ${entry.score403030}</span>
              <span class="rank-chip">33/33/34: ${entry.score333334}</span>
            </div>
          </details>
        </div>
      </article>
    `;
  }));
}

const PREVIEW_LIMIT = 3;

function libraryItem(branchKey, groupIndex, itemIndex, title, group, alreadyAdded) {
  return html`
    <div class="preset-wrap">
      <div class="preset">
        <span class="preset-title">${title}</span>
        <button
          type="button"
          class="preset-add"
          data-add-preset="${branchKey}"
          data-group="${groupIndex}"
          data-index="${itemIndex}"
          ${alreadyAdded ? raw('disabled') : ''}
        >${alreadyAdded ? 'Добавлено' : '+ Добавить'}</button>
      </div>
      <details class="preset-details">
        <summary>Подробнее</summary>
        <p><b>Как:</b> ${group.how}</p>
        <p><b>Зачем:</b> ${group.theme}</p>
        <p><b>Долгосрочно:</b> ${group.impact}</p>
        <small>${group.source}</small>
      </details>
    </div>
  `;
}

export function renderLibrary(state, addedTitles) {
  const root = $('#libraryList');
  if (!root) return;

  setHtml(root, Object.entries(LIBRARY).map(([branchKey, branch]) => {
    const expanded = expandedGroups.has(branchKey);
    const visibleGroups = expanded ? branch.groups : branch.groups.slice(0, PREVIEW_LIMIT);
    const totalQuests = branch.groups.reduce((sum, group) => sum + group.items.length, 0);
    const meta = TREE_BRANCHES.find(item => item.key === branchKey);

    return html`
      <article
        class="panel library-group"
        data-library-group="${branchKey}"
        style="${styleVars({ '--branch-accent': meta?.color ?? '#4de0ff' })}"
      >
        <div class="library-head">
          <div>
            <b>${branch.title}</b>
            <span>${branch.label}</span>
          </div>
          <span class="library-count">${totalQuests}</span>
        </div>
        <div class="library-items">
          ${visibleGroups.map((group, groupIndex) => html`
            <section class="library-theme">
              <h3 class="library-theme-title">${group.theme}</h3>
              ${group.items.map((title, itemIndex) =>
                libraryItem(branchKey, groupIndex, itemIndex, title, group, addedTitles.has(title.trim().toLowerCase())))}
            </section>
          `)}
        </div>
        ${branch.groups.length > PREVIEW_LIMIT
          ? html`<button type="button" class="show-more" data-show="${branchKey}">
              ${expanded ? 'Свернуть' : `Показать все ${branch.groups.length} тем`}
            </button>`
          : ''}
      </article>
    `;
  }));
}
