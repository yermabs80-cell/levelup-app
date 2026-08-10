import { MAX_PHOTO_BYTES } from '../core/constants.js';
import { deletePhoto, loadAllPhotos, savePhoto } from '../data/photos.js';
import { $ } from './dom.js';
import { html, setHtml } from './html.js';
import { askConfirm, showToast } from './feedback.js';

const photos = { avatar: null, before: null, after: null };

export function getPhoto(key) {
  return photos[key] ?? null;
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
  showToast('Фотография удалена');
}

export function clearPhotos() {
  for (const key of Object.keys(photos)) {
    deletePhoto(key);
    photos[key] = null;
  }
  renderPhotos();
}
