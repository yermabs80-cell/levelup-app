const DB_NAME = 'levelup-photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error('IndexedDB не удалось открыть'));
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

export async function savePhoto(key, dataURL) {
  if (!dataURL || typeof dataURL !== 'string') return { ok: false };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const request = store.put(dataURL, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Не удалось сохранить фото'));
    });
    return { ok: true };
  } catch (error) {
    console.error('[photos]', error);
    return { ok: false, error };
  }
}

export async function loadPhoto(key) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const dataURL = await new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Не удалось загрузить фото'));
    });
    return { ok: true, dataURL: dataURL || null };
  } catch (error) {
    console.error('[photos]', error);
    return { ok: false, dataURL: null };
  }
}

export async function deletePhoto(key) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Не удалось удалить фото'));
    });
    return { ok: true };
  } catch (error) {
    console.error('[photos]', error);
    return { ok: false };
  }
}

export async function loadAllPhotos() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keys = await new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject();
    });

    const photos = {};
    for (const key of keys) {
      const result = await loadPhoto(key);
      if (result.ok && result.dataURL) photos[key] = result.dataURL;
    }

    return { ok: true, photos };
  } catch (error) {
    console.error('[photos]', error);
    return { ok: false, photos: {} };
  }
}

/**
 * Миграция фотографий из старого localStorage в IndexedDB.
 * Вызывается один раз при загрузке, если обнаружены старые данные.
 */
export async function migratePhotosFromLocalStorage(oldPhotos) {
  if (!oldPhotos || typeof oldPhotos !== 'object') return { ok: true, migrated: 0 };

  let migrated = 0;
  for (const [key, dataURL] of Object.entries(oldPhotos)) {
    if (!dataURL || typeof dataURL !== 'string') continue;
    const result = await savePhoto(key, dataURL);
    if (result.ok) migrated += 1;
  }

  return { ok: true, migrated };
}

export const photosAvailable = typeof indexedDB !== 'undefined';
