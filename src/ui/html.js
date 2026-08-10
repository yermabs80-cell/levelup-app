const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ESCAPE_MAP[char]);
}

/** Помечает строку как уже безопасную — только для готовой разметки, не для данных. */
class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export function raw(value) {
  return new SafeHtml(String(value));
}

function serialize(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

/**
 * Тег-шаблон, экранирующий каждую подстановку по умолчанию.
 * В отличие от ручного esc() здесь нельзя «забыть» экранировать поле:
 * чтобы вставить готовую разметку, нужно явно обернуть её в raw().
 */
export function html(strings, ...values) {
  let result = strings[0];

  for (let index = 0; index < values.length; index += 1) {
    result += serialize(values[index]) + strings[index + 1];
  }

  return new SafeHtml(result);
}

export function setHtml(element, content) {
  if (!element) return;
  // Массив нужно склеить тем же сериализатором: String([a, b]) вставил бы
  // между элементами запятые.
  element.innerHTML = serialize(content);
}

/** Атрибуты стилей строятся отдельно, чтобы цвет из данных не попадал в разметку как есть. */
export function styleVars(vars) {
  const safe = Object.entries(vars)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => `${name}:${String(value).replace(/[^\w\s#%.,()-]/g, '')}`)
    .join(';');

  return raw(escapeHtml(safe));
}

export const escape = escapeHtml;
