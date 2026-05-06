// =========================================================
// SeeleScans · api.js
// HTTP client for the SeeleScans API.
// =========================================================

/**
 * Decide a qué API hablamos según dónde se sirve el cliente.
 *
 * Orden de precedencia:
 *  1. `window.SEELE_API_URL` (override runtime, ej. para staging desde la consola)
 *  2. Match exacto en KNOWN_HOSTS (deploys conocidos)
 *  3. localhost / 127.0.0.1 → http://localhost:3000 (dev)
 *  4. Fallback genérico: mismo protocolo, prepend "api." al hostname
 */
const KNOWN_HOSTS = {
  'seelescans.servigtdev.com': 'https://api.seele.servigtdev.com',
};

function detectBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3000';

  if (window.SEELE_API_URL) return window.SEELE_API_URL;

  const { hostname, protocol } = window.location;

  if (KNOWN_HOSTS[hostname]) return KNOWN_HOSTS[hostname];

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    return 'http://localhost:3000';
  }

  return `${protocol}//api.${hostname}`;
}

export const BASE_URL = detectBaseUrl();

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

// ---- Uploads ----
export const uploadCover = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch('/upload/cover', { method: 'POST', body: fd });
};

// ---- Ratings ----
export const getRating = (mangaId, clientId, { signal } = {}) => {
  const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return apiFetch(`/manga/${encodeURIComponent(mangaId)}/rating${qs}`, { signal });
};

export const submitRating = (mangaId, clientId, value) =>
  apiFetch(`/manga/${encodeURIComponent(mangaId)}/rating`, {
    method: 'POST',
    body: { client_id: clientId, value },
  });

export const deleteRating = (mangaId, clientId) =>
  apiFetch(
    `/manga/${encodeURIComponent(mangaId)}/rating?client_id=${encodeURIComponent(clientId)}`,
    { method: 'DELETE' },
  );

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
  uploadCover,
  getRating,
  submitRating,
  deleteRating,
};
