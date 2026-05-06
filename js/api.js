// =========================================================
// SeeleScans · api.js
// HTTP client for the SeeleScans API.
// =========================================================

export const BASE_URL = 'http://localhost:3000';

/**
 * Wrapper around fetch that:
 * - serializes JSON body when an object is passed
 * - parses JSON response when there is one
 * - throws an Error with the backend message ({error: "..."}) on non-2xx
 * - supports AbortSignal for cancellable requests
 */
async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const opts = { ...options };

  const headers = new Headers(opts.headers || {});

  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    opts.body = JSON.stringify(opts.body);
  }

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  opts.headers = headers;

  let response;
  try {
    response = await fetch(url, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('No se pudo conectar con la API. ¿Está corriendo en localhost:3000?');
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const msg =
      (payload && typeof payload === 'object' && payload.error) ||
      (typeof payload === 'string' && payload) ||
      `HTTP ${response.status}`;
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

// ---- Manga ----
export const getMangas = (params = {}, { signal } = {}) =>
  apiFetch(`/manga${buildQuery(params)}`, { signal });

export const getManga = (id, { signal } = {}) =>
  apiFetch(`/manga/${encodeURIComponent(id)}`, { signal });

export const createManga = (data) =>
  apiFetch('/manga', { method: 'POST', body: data });

export const updateManga = (id, data) =>
  apiFetch(`/manga/${encodeURIComponent(id)}`, { method: 'PUT', body: data });

export const deleteManga = (id) =>
  apiFetch(`/manga/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Chapters / Pages ----
export const getChapters = (mangaId, { signal } = {}) =>
  apiFetch(`/manga/${encodeURIComponent(mangaId)}/chapters`, { signal });

export const getChapter = (id, { signal } = {}) =>
  apiFetch(`/chapters/${encodeURIComponent(id)}`, { signal });

export const getPages = (chapterId, { signal } = {}) =>
  apiFetch(`/chapters/${encodeURIComponent(chapterId)}/pages`, { signal });

// ---- Tags ----
export const getTags = ({ signal } = {}) => apiFetch('/tags', { signal });

export const api = {
  getMangas,
  getManga,
  createManga,
  updateManga,
  deleteManga,
  getChapters,
  getChapter,
  getPages,
  getTags,
};
