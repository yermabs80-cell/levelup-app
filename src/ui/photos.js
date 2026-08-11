import { MAX_PHOTO_BYTES, STORAGE_KEYS } from '../core/constants.js';
import { deletePhoto, loadAllPhotos, savePhoto } from '../data/photos.js';
import { readJson, writeJson } from '../data/storage.js';
import { $ } from './dom.js';
import { html, setHtml } from './html.js';
import { askConfirm, showToast } from './feedback.js';

const photos = { avatar: null, before: null, after: null };
const PHOTO_KEYS = Object.keys(photos);

/**
 * Облако подключается извне, а не импортом: photos.js рисует разметку и не должен
 * знать, как создаётся клиент Firebase.
 */
let cloud = null;
let syncing = null;
let hydrated = false;

export function setPhotoCloud(instance) {
  cloud = instance;
}

export function getPhoto(key) {
  return photos[key] ?? null;
}

/**
 * Отпечаток снимка, а не сам снимок: он решает, нужна ли повторная заливка.
 * Без него каждая перезагрузка страницы отправляла бы все фото заново.
 */
function fingerprint(dataURL) {
  return `${dataURL.length}:${dataURL.slice(-24)}`;
}

function syncedMarks(uid) {
  return readJson(STORAGE_KEYS.photoSync, {})?.[uid] ?? {};
}

function rememberMark(uid, key, mark) {
  const all = readJson(STORAGE_KEYS.photoSync, {}) ?? {};
  const forUser = { ...(all[uid] ?? {}) };

  if (mark) forUser[key] = mark;
  else delete forUser[key];

  writeJson(STORAGE_KEYS.photoSync, { ...all, [uid]: forUser });
}

export async function hydratePhotos(legacyPhotos) {
  const { photos: stored } = await loadAllPhotos();
  Object.assign(photos, stored);

  // Фотографии из старой версии лежали в localStorage вместе с остальным
  // состоянием и переполняли квоту — переносим их в IndexedDB один раз.
  if (legacyPhotos && typeof legacyPhotos === 'object') {
    for (const [key, dataURL] of Object.entries(legacyPhotos)) {
      if (!dataURL || photos[key]) continue;
      const result = await savePhoto(key, dataURL);
      if (result.ok) photos[key] = dataURL;
    }
  }

  renderPhotos();
  hydrated = true;

  // Вход мог завершиться раньше, чем поднялся IndexedDB: тогда синхронизация
  // ушла бы вхолостую, решив, что локально ничего нет.
  syncPhotosWithCloud();
}

/**
 * Двусторонний перенос при входе в аккаунт:
 * есть локально, но не залито — заливаем (это и есть миграция уже сделанных снимков);
 * локально пусто — забираем то, что залили с другого устройства.
 * IndexedDB остаётся тем, из чего рисуется интерфейс, в том числе офлайн.
 */
export function syncPhotosWithCloud() {
  if (!hydrated || !cloud?.canSyncPhotos) return Promise.resolve();
  // Повторный вызов во время работы (снапшот + смена авторизации) не должен
  // запускать вторую заливку тех же файлов.
  syncing ??= runPhotoSync()
    .catch(error => console.warn('[photos] синхронизация не завершилась', error))
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

async function runPhotoSync() {
  const uid = cloud.user?.uid;
  if (!uid) return;

  const marks = syncedMarks(uid);
  let pulled = false;

  for (const key of PHOTO_KEYS) {
    const local = photos[key];

    if (local) {
      const mark = fingerprint(local);
      if (marks[key] === mark) continue;

      const result = await cloud.uploadPhoto(key, local);
      if (result.ok) rememberMark(uid, key, mark);
      continue;
    }

    const remote = await cloud.downloadPhoto(key);
    if (!remote.ok || !remote.dataURL) continue;

    await savePhoto(key, remote.dataURL);
    photos[key] = remote.dataURL;
    rememberMark(uid, key, fingerprint(remote.dataURL));
    pulled = true;
  }

  if (pulled) renderPhotos();
}

function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));

    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не удалось открыть изображение'));

      image.onload = () => {
        let { width, height } = image;

        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
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

/** Меняет src только при реальной смене снимка — иначе браузер каждый раз декодирует data-URL заново. */
function applyPhoto(imageSelector, fallbackSelector, dataURL) {
  const image = $(imageSelector);
  const fallback = $(fallbackSelector);
  if (!image || !fallback) return;

  if (dataURL) {
    if (image.dataset.photoId !== dataURL.slice(-32)) {
      image.src = dataURL;
      image.dataset.photoId = dataURL.slice(-32);
    }
    image.hidden = false;
    fallback.hidden = true;
  } else {
    image.removeAttribute('src');
    delete image.dataset.photoId;
    image.hidden = true;
    fallback.hidden = false;
  }
}

function photoCard(type, title, dataURL) {
  return html`
    <article class="panel photo-card">
      <div class="photo-preview">
        ${dataURL ? html`<img src="${dataURL}" alt="Фотография «${title}»">` : html`<span aria-hidden="true">📷</span>`}
      </div>
      <h3>${title}</h3>
      <button type="button" class="photo-button" data-photo="${type}">
        ${dataURL ? 'Изменить фото' : 'Добавить фото'}
      </button>
      ${dataURL ? html`<button type="button" class="photo-remove" data-remove-photo="${type}">Удалить</button>` : ''}
    </article>
  `;
}

export function renderPhotos() {
  applyPhoto('#avatarImage', '#avatarFallback', photos.avatar);
  applyPhoto('#characterImage', '#characterFallback', photos.avatar);

  const grid = $('#photoGrid');
  if (!grid) return;

  setHtml(grid, html`
    ${photoCard('before', 'До', photos.before)}
    ${photoCard('after', 'После', photos.after)}
  `);
}

export async function handlePhotoFile(file, target) {
  if (!file || !target) return;

  if (!file.type.startsWith('image/')) {
    showToast('Нужно выбрать изображение', { type: 'error' });
    return;
  }

  if (file.size > MAX_PHOTO_BYTES) {
    showToast('Файл больше 15 МБ — выбери снимок поменьше', { type: 'error' });
    return;
  }

  try {
    const dataURL = await compressImage(file);
    const result = await savePhoto(target, dataURL);

    if (!result.ok) {
      showToast('Не удалось сохранить фото на устройстве', { type: 'error' });
      return;
    }

    photos[target] = dataURL;
    renderPhotos();
    showToast('Фотография сохранена', { type: 'success' });

    // Заливка идёт после отрисовки: интерфейс не должен ждать сеть.
    if (cloud?.canSyncPhotos) {
      const uid = cloud.user?.uid;
      const upload = await cloud.uploadPhoto(target, dataURL);
      if (upload.ok && uid) rememberMark(uid, target, fingerprint(dataURL));
    }
  } catch (error) {
    console.error(error);
    showToast('Не удалось обработать изображение', { type: 'error' });
  }
}

export async function removePhoto(target) {
  const confirmed = await askConfirm('Фотографию нельзя будет восстановить.', {
    title: 'Удалить фотографию?',
    acceptLabel: 'Удалить'
  });
  if (!confirmed) return;

  await deletePhoto(target);
  photos[target] = null;
  renderPhotos();

  const uid = cloud?.user?.uid;
  if (cloud?.canSyncPhotos) {
    await cloud.deleteCloudPhoto(target);
    if (uid) rememberMark(uid, target, null);
  }

  showToast('Фотография удалена');
}

export function clearPhotos() {
  const uid = cloud?.user?.uid;

  for (const key of PHOTO_KEYS) {
    deletePhoto(key);
    photos[key] = null;
    if (cloud?.canSyncPhotos) {
      cloud.deleteCloudPhoto(key);
      if (uid) rememberMark(uid, key, null);
    }
  }

  renderPhotos();
}
