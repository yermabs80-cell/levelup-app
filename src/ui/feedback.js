import { html, setHtml } from './html.js';

let toastHost = null;
let confirmDialog = null;
let confirmResolver = null;

function ensureToastHost() {
  if (toastHost?.isConnected) return toastHost;
  toastHost = document.createElement('div');
  toastHost.className = 'toast-host';
  toastHost.setAttribute('role', 'status');
  toastHost.setAttribute('aria-live', 'polite');
  document.body.append(toastHost);
  return toastHost;
}

const TOAST_ICONS = {
  info: '•',
  success: '✓',
  error: '!'
};

export function showToast(message, { type = 'info', duration = 3200 } = {}) {
  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  setHtml(toast, html`<span class="toast-icon">${TOAST_ICONS[type] ?? '•'}</span><span>${message}</span>`);
  host.append(toast);

  const remove = () => {
    toast.classList.add('toast-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Если анимации отключены системно, событие не придёт — убираем по таймеру.
    setTimeout(() => toast.remove(), 400);
  };

  setTimeout(remove, duration);
  return remove;
}

function ensureConfirmDialog() {
  if (confirmDialog?.isConnected) return confirmDialog;

  confirmDialog = document.createElement('dialog');
  confirmDialog.className = 'confirm-dialog';
  setHtml(confirmDialog, html`
    <form method="dialog" class="confirm-form">
      <h2 class="confirm-title"></h2>
      <p class="confirm-text item-sub"></p>
      <div class="confirm-actions">
        <button class="secondary-auth-button" value="cancel" type="submit">Отмена</button>
        <button class="danger confirm-accept" value="accept" type="submit">Подтвердить</button>
      </div>
    </form>
  `);

  document.body.append(confirmDialog);

  confirmDialog.addEventListener('close', () => {
    const accepted = confirmDialog.returnValue === 'accept';
    confirmResolver?.(accepted);
    confirmResolver = null;
  });

  return confirmDialog;
}

/** Замена window.confirm: тот же контракт, но в стиле приложения и без блокировки потока. */
export function askConfirm(message, { title = 'Подтверждение', acceptLabel = 'Подтвердить', danger = true } = {}) {
  const dialog = ensureConfirmDialog();
  dialog.querySelector('.confirm-title').textContent = title;
  dialog.querySelector('.confirm-text').textContent = message;

  const accept = dialog.querySelector('.confirm-accept');
  accept.textContent = acceptLabel;
  accept.className = danger ? 'danger confirm-accept' : 'save confirm-accept';

  return new Promise(resolve => {
    confirmResolver = resolve;
    dialog.returnValue = '';
    dialog.showModal();
  });
}
