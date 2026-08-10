import { MODAL_TITLES, STATS } from '../core/constants.js';
import { $, openDialog } from './dom.js';
import { html, setHtml } from './html.js';

let activeType = '';

export function getActiveType() {
  return activeType;
}

function questFields() {
  return html`
    <label>
      Название
      <input name="title" required maxlength="60" placeholder="Например: Прочитать 10 страниц">
    </label>
    <label>
      Характеристика
      <select name="stat">
        ${STATS.map(stat => html`<option value="${stat.id}">${stat.icon} ${stat.title}</option>`)}
      </select>
    </label>
    <label>
      Опыт за квест
      <input name="xp" type="number" min="1" max="200" value="15" required>
    </label>
  `;
}

function taskFields() {
  return html`
    <label>
      Название
      <input name="title" required maxlength="60" placeholder="Главное дело на сегодня">
    </label>
  `;
}

function scheduleFields() {
  return html`
    <label>
      Время
      <input name="time" type="time" required value="09:00">
    </label>
    <label>
      Название
      <input name="title" required maxlength="60" placeholder="Например: Тренировка">
    </label>
  `;
}

function moneyFields() {
  return html`
    <label>
      Название
      <input name="title" required maxlength="60" placeholder="Например: Продукты">
    </label>
    <label>
      Тип
      <select name="type">
        <option value="expense">Расход</option>
        <option value="income">Доход</option>
      </select>
    </label>
    <label>
      Сумма, ₸
      <input name="amount" type="number" min="1" step="1" required placeholder="0">
    </label>
  `;
}

const FIELD_BUILDERS = {
  quest: questFields,
  task: taskFields,
  schedule: scheduleFields,
  money: moneyFields
};

export function openEntryModal(type) {
  const build = FIELD_BUILDERS[type];
  if (!build) return;

  activeType = type;
  const title = $('#modalTitle');
  if (title) title.textContent = MODAL_TITLES[type];

  setHtml($('#formFields'), build());
  openDialog('#modal');

  // autofocus не срабатывает на разметке, вставленной после открытия диалога.
  requestAnimationFrame(() => $('#formFields input')?.focus());
}

export function resetEntryModal() {
  activeType = '';
  $('#form')?.reset();
  setHtml($('#formFields'), '');
}
