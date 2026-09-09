const DB_NAME = "beatvision.audio.v1";
const STORE_NAME = "audio";
const DB_VERSION = 1;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const LOCAL_FALLBACK_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "flac"];
const ACCEPTED_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/flac"];
const FALLBACK_KEY_PREFIX = "beatvision.audio-fallback.v1:";

function extensionOf(name = "") {
  const parts = String(name).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function validateAudioFile(file) {
  if (!file) throw new Error("No audio file selected.");
  if (!file.size) throw new Error("The selected audio file is empty.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Audio files must be 25 MB or smaller.");
  const extension = extensionOf(file.name);
  const type = String(file.type || "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(extension) && !ACCEPTED_MIME_TYPES.includes(type)) {
    throw new Error("Unsupported audio format. Use MP3, WAV, M4A, AAC, OGG, or FLAC.");
  }
  return true;
}

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Could not open audio storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read audio file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

const fallbackKey = (projectId) => `${FALLBACK_KEY_PREFIX}${projectId}`;

export async function saveStoredAudioFile(projectId, file, metadata = {}) {
  if (!projectId) throw new Error("A project id is required to store audio.");
  validateAudioFile(file);
  const record = {
    projectId,
    blob: file,
    name: file.name,
    type: file.type || "audio/*",
    size: file.size,
    duration: Number(metadata.duration) || 0,
    lastModified: Number(file.lastModified) || Date.now(),
    storageType: "indexeddb",
  };
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.onerror = () => reject(tx.error || new Error("Could not save audio."));
      tx.oncomplete = resolve;
    });
    db.close();
    return { ...record, blob: undefined };
  } catch (_) {
    if (file.size > LOCAL_FALLBACK_MAX_BYTES || typeof localStorage === "undefined") {
      throw new Error("Browser audio storage is unavailable for this file. Use a browser with IndexedDB enabled.");
    }
    const dataUrl = await fileToDataUrl(file);
    localStorage.setItem(fallbackKey(projectId), JSON.stringify({ ...record, blob: undefined, dataUrl, storageType: "localStorage" }));
    return { ...record, blob: undefined, storageType: "localStorage" };
  }
}

export async function getStoredAudioFile(projectId) {
  if (!projectId) return null;
  try {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(projectId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
    db.close();
    if (record?.blob) return new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified });
  } catch (_) {}
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(fallbackKey(projectId));
    if (raw) {
      const record = JSON.parse(raw);
      if (record.dataUrl) {
        const response = await fetch(record.dataUrl);
        const blob = await response.blob();
        return new File([blob], record.name, { type: record.type, lastModified: record.lastModified });
      }
    }
  }
  return null;
}

export async function removeStoredAudioFile(projectId) {
  if (!projectId) return;
  if (typeof localStorage !== "undefined") localStorage.removeItem(fallbackKey(projectId));
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(projectId);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = resolve;
    });
    db.close();
  } catch (_) {}
}

export const AUDIO_STORAGE_LIMIT_BYTES = MAX_AUDIO_BYTES;
