// =========================================================
// SeeleScans · app.js
// State, router, events. Wires api.js + ui.js together.
// =========================================================

import { api } from './api.js';
import {
  showView,
  showToast,
  showLoading,
  hideLoading,
  confirmDialog,
  renderHomeView,
  renderDetailView,
  renderReaderView,
  renderFormView,
  readFormPayload,
  validateMangaPayload,
  attachFieldErrors,
  mangasToCsv,
  downloadCsv,
  qs,
  qsa,
} from './ui.js';

// ---------- State ----------
const ADMIN_KEY = 'seele.admin';

const state = {
  filters: {
    page: 1,
    limit: 10,
    q: '',
    sort: 'created_at',
    order: 'desc',
  },
  adminMode: loadAdminMode(),
  tags: [],
  // last loaded home data (for CSV export)
  lastHomeData: { mangas: [], meta: null },
  // detail caches (key: manga id)
  currentManga: null,
  currentChapters: [],
  // chapters known to be empty / non-empty (cache)
  chaptersEmpty: new Set(),
  chaptersWithPages: new Set(),
  // request management
  searchController: null,
};

function loadAdminMode() {
  try { return localStorage.getItem(ADMIN_KEY) === '1'; } catch { return false; }
}

function saveAdminMode() {
  try { localStorage.setItem(ADMIN_KEY, state.adminMode ? '1' : '0'); } catch {}
}

// ---------- Utils ----------
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function parseHash() {
  const raw = (location.hash || '#/').slice(1) || '/';
  // normalize trailing slashes
  const path = raw.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '') return { name: 'home' };
  if (path === '/new') return { name: 'new' };

  const editMatch = path.match(/^\/edit\/([^/]+)$/);
  if (editMatch) return { name: 'edit', id: editMatch[1] };

  const detailMatch = path.match(/^\/manga\/([^/]+)$/);
  if (detailMatch) return { name: 'detail', id: detailMatch[1] };

  const readMatch = path.match(/^\/read\/([^/]+)$/);
  if (readMatch) return { name: 'reader', chapterId: readMatch[1] };

  return { name: 'home' };
}

// ---------- Navigation helpers ----------
function go(hash) { location.hash = hash; }
const goHome = () => go('#/');
const goDetail = (id) => go(`#/manga/${id}`);
const goReader = (chapterId) => go(`#/read/${chapterId}`);
const goNew = () => go('#/new');
const goEdit = (id) => go(`#/edit/${id}`);

// ---------- Router ----------
async function router() {
  const route = parseHash();
  syncAdminUi();

  // protect admin-only routes
  if ((route.name === 'new' || route.name === 'edit') && !state.adminMode) {
    showToast('Activá el modo Admin para gestionar mangas.', 'warning');
    goHome();
    return;
  }

  switch (route.name) {
    case 'home':
      showView('home');
      await loadHome();
      break;
    case 'detail':
      showView('detail');
      await loadDetail(route.id);
      break;
    case 'reader':
      showView('reader');
      await loadReader(route.chapterId);
      break;
    case 'new':
      showView('form');
      await loadForm({ mode: 'create' });
      break;
    case 'edit':
      showView('form');
      await loadForm({ mode: 'edit', id: route.id });
      break;
  }
}

// ---------- Loaders ----------
async function loadHome() {
  // cancel prior search
  if (state.searchController) state.searchController.abort();
  const ctrl = new AbortController();
  state.searchController = ctrl;

  showLoading();
  try {
    const res = await api.getMangas(state.filters, { signal: ctrl.signal });
    state.lastHomeData = { mangas: res?.data || [], meta: res?.meta || null };
    renderHomeView({
      mangas: state.lastHomeData.mangas,
      meta: state.lastHomeData.meta,
      filters: state.filters,
      adminMode: state.adminMode,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    renderHomeView({ mangas: [], meta: null, filters: state.filters, adminMode: state.adminMode });
    showToast(err.message || 'No se pudo cargar el catálogo.', 'error');
  } finally {
    if (state.searchController === ctrl) state.searchController = null;
    hideLoading();
  }
}

async function loadDetail(id) {
  showLoading();
  try {
    const [manga, chapters] = await Promise.all([
      api.getManga(id),
      api.getChapters(id).catch(() => []),
    ]);
    state.currentManga = manga;
    state.currentChapters = Array.isArray(chapters) ? chapters : [];

    renderDetailView({
      manga,
      chapters: state.currentChapters,
      chaptersWithPages: new Set([...state.chaptersWithPages]),
      adminMode: state.adminMode,
    });
  } catch (err) {
    renderDetailView({ error: err.message || 'No se pudo cargar el manga.' });
  } finally {
    hideLoading();
  }
}

async function loadReader(chapterId) {
  showLoading();
  try {
    const [chapter, pages] = await Promise.all([
      api.getChapter(chapterId),
      api.getPages(chapterId).catch(() => []),
    ]);

    // ensure we have the manga + sibling chapters for navigation
    let manga = state.currentManga;
    let siblingChapters = state.currentChapters;
    if (!manga || !manga.id || manga.id !== chapter.manga_id || !siblingChapters.length) {
      const [m, ch] = await Promise.all([
        api.getManga(chapter.manga_id),
        api.getChapters(chapter.manga_id).catch(() => []),
      ]);
      manga = m;
      siblingChapters = Array.isArray(ch) ? ch : [];
      state.currentManga = manga;
      state.currentChapters = siblingChapters;
    }

    // sort by chapter number ascending (numeric)
    const sorted = [...siblingChapters].sort(
      (a, b) => parseFloat(a.number) - parseFloat(b.number),
    );
    const idx = sorted.findIndex((c) => String(c.id) === String(chapter.id));
    const prevChapter = idx > 0 ? sorted[idx - 1] : null;
    const nextChapter = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

    // cache pages knowledge
    if (Array.isArray(pages) && pages.length > 0) {
      state.chaptersWithPages.add(chapter.id);
      state.chaptersEmpty.delete(chapter.id);
    } else {
      state.chaptersEmpty.add(chapter.id);
    }

    renderReaderView({ manga, chapter, pages: pages || [], prevChapter, nextChapter });
  } catch (err) {
    renderReaderView({ error: err.message || 'No se pudo cargar el capítulo.' });
  } finally {
    hideLoading();
  }
}

async function loadForm({ mode, id }) {
  showLoading();
  try {
    const [manga, tags] = await Promise.all([
      mode === 'edit' ? api.getManga(id) : Promise.resolve(null),
      ensureTags(),
    ]);
    state.currentManga = manga;
    renderFormView({ manga, tags, mode });
  } catch (err) {
    renderFormView({ manga: null, tags: state.tags, mode });
    showToast(err.message || 'No se pudo cargar el formulario.', 'error');
  } finally {
    hideLoading();
  }
}

async function ensureTags() {
  if (state.tags && state.tags.length) return state.tags;
  try {
    const tags = await api.getTags();
    state.tags = Array.isArray(tags) ? tags : [];
  } catch {
    state.tags = [];
  }
  return state.tags;
}

// ---------- Admin toggle ----------
function syncAdminUi() {
  const toggle = qs('#admin-toggle');
  const newBtn = qs('#new-btn');
  if (toggle) {
    toggle.setAttribute('aria-checked', state.adminMode ? 'true' : 'false');
  }
  if (newBtn) {
    newBtn.hidden = !state.adminMode;
  }
}

// ---------- Event delegation ----------
function bindGlobalEvents() {
  // hash routing
  window.addEventListener('hashchange', router);

  // admin toggle in header
  qs('#admin-toggle')?.addEventListener('click', () => {
    state.adminMode = !state.adminMode;
    saveAdminMode();
    syncAdminUi();
    router(); // re-render current view
    showToast(
      state.adminMode ? 'Modo Admin activado.' : 'Modo Admin desactivado.',
      state.adminMode ? 'success' : 'info',
    );
  });

  // new button in header
  qs('#new-btn')?.addEventListener('click', () => {
    if (!state.adminMode) return;
    goNew();
  });

  // delegated clicks on main
  qs('#main')?.addEventListener('click', onMainClick);
  qs('#main')?.addEventListener('keydown', onMainKeydown);
  qs('#main')?.addEventListener('input', onMainInput);
  qs('#main')?.addEventListener('change', onMainChange);
  qs('#main')?.addEventListener('submit', onMainSubmit);
}

async function onMainClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;

  switch (action) {
    case 'open-detail':
      // ignore clicks on internal admin buttons
      if (e.target.closest('[data-action="edit"], [data-action="delete"]')) return;
      goDetail(id);
      break;
    case 'open-reader':
      goReader(id);
      break;
    case 'edit':
      e.stopPropagation();
      goEdit(id);
      break;
    case 'delete':
      e.stopPropagation();
      await handleDelete(id);
      break;
    case 'order-toggle':
      e.preventDefault();
      state.filters.order = state.filters.order === 'asc' ? 'desc' : 'asc';
      state.filters.page = 1;
      await loadHome();
      break;
    case 'page-prev':
      if (state.filters.page > 1) {
        state.filters.page--;
        await loadHome();
      }
      break;
    case 'page-next': {
      const tp = state.lastHomeData.meta?.totalPages ?? 1;
      if (state.filters.page < tp) {
        state.filters.page++;
        await loadHome();
      }
      break;
    }
    case 'clear-search':
      state.filters.q = '';
      state.filters.page = 1;
      await loadHome();
      break;
    case 'csv-export':
      handleCsvExport();
      break;
    case 'reader-prev':
    case 'reader-next':
      if (id) goReader(id);
      break;
    case 'back-home':
      // anchor handles it
      break;
    case 'form-cancel':
      e.preventDefault();
      goHome();
      break;
    case 'cover-clear':
      e.preventDefault();
      handleCoverClear(target);
      break;
  }
}

function onMainKeydown(e) {
  // Make role=button elements activate on Enter/Space
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[data-action="open-detail"], [data-action="open-reader"]');
  if (!target) return;
  e.preventDefault();
  const action = target.dataset.action;
  if (action === 'open-detail') goDetail(target.dataset.id);
  if (action === 'open-reader') goReader(target.dataset.id);
}

const debouncedSearch = debounce(async () => {
  state.filters.page = 1;
  await loadHome();
}, 320);

function onMainInput(e) {
  const t = e.target;
  if (t.dataset?.action === 'search-input') {
    state.filters.q = t.value || '';
    debouncedSearch();
  } else if (t.dataset?.action === 'cover-url') {
    updateCoverPreview(t.closest('.cover-field'), t.value || '');
  }
}

async function onMainChange(e) {
  const t = e.target;
  if (t.dataset?.action === 'sort-select') {
    state.filters.sort = t.value;
    state.filters.page = 1;
    await loadHome();
  } else if (t.dataset?.action === 'limit-select') {
    state.filters.limit = parseInt(t.value, 10) || 10;
    state.filters.page = 1;
    await loadHome();
  } else if (t.dataset?.action === 'cover-file') {
    handleCoverFileChange(t);
  }
}

async function onMainSubmit(e) {
  const form = e.target.closest('form[data-action="form"]');
  if (!form) return;
  e.preventDefault();
  await handleFormSubmit(form);
}

// ---------- Action handlers ----------
async function handleDelete(id) {
  const target = state.lastHomeData.mangas.find((m) => String(m.id) === String(id))
    || state.currentManga;
  const title = target?.title || 'este manga';

  const ok = await confirmDialog({
    title: 'Eliminar manga',
    message: `Vas a borrar <strong>${escapeHtml(title)}</strong>. Esta acción es definitiva y arrastra capítulos y páginas asociados.`,
    confirmText: 'Borrar',
    cancelText: 'Cancelar',
    destructive: true,
  });
  if (!ok) return;

  showLoading();
  try {
    await api.deleteManga(id);
    showToast(`"${title}" eliminado.`, 'success');

    // refresh current view
    const route = parseHash();
    if (route.name === 'detail') {
      goHome();
    } else {
      await loadHome();
    }
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar.', 'error');
  } finally {
    hideLoading();
  }
}

async function handleFormSubmit(form) {
  const mode = form.dataset.mode;
  const id = form.dataset.id;
  const payload = readFormPayload(form);

  const fileInput = form.querySelector('[data-action="cover-file"]');
  const file = fileInput?.files?.[0] || null;

  // upload cover first (if a file was chosen) so we have its URL before submitting manga
  if (file) {
    if (!validateCoverFile(file, { silent: false })) {
      return;
    }
    showLoading();
    try {
      const res = await api.uploadCover(file);
      if (res?.url) {
        payload.cover_url = res.url;
        // reflect new URL in the input so the user sees what got saved
        const urlInput = form.querySelector('[data-action="cover-url"]');
        if (urlInput) urlInput.value = res.url;
      }
    } catch (err) {
      hideLoading();
      showToast(err.message || 'No se pudo subir la imagen.', 'error');
      return;
    } finally {
      hideLoading();
    }
  }

  // strip empty optional fields for cleanness
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0 && mode === 'create') continue;
    clean[k] = v;
  }

  const errors = validateMangaPayload(clean, { partial: false });
  attachFieldErrors(form, errors);
  if (Object.keys(errors).length > 0) {
    showToast('Revisá los campos marcados.', 'warning');
    return;
  }

  showLoading();
  try {
    if (mode === 'edit') {
      await api.updateManga(id, clean);
      showToast('Manga actualizado.', 'success');
      goDetail(id);
    } else {
      const created = await api.createManga(clean);
      showToast('Manga creado.', 'success');
      if (created && created.id) goDetail(created.id);
      else goHome();
    }
  } catch (err) {
    showToast(err.message || 'Error al guardar.', 'error');
  } finally {
    hideLoading();
  }
}

// ---------- Cover field helpers ----------
const MAX_COVER_BYTES = 1 * 1024 * 1024;
const ALLOWED_COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function validateCoverFile(file, { silent = false } = {}) {
  if (!ALLOWED_COVER_MIMES.includes(file.type)) {
    if (!silent) showToast(`Tipo no soportado: ${file.type || 'desconocido'}. Usá jpg, png o webp.`, 'error');
    return false;
  }
  if (file.size > MAX_COVER_BYTES) {
    if (!silent) showToast(`Imagen muy grande (${formatBytes(file.size)}). Máximo 1 MB.`, 'error');
    return false;
  }
  return true;
}

function handleCoverFileChange(input) {
  const wrapper = input.closest('.cover-field');
  const file = input.files?.[0];
  if (!file) return;

  if (!validateCoverFile(file)) {
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    updateCoverPreview(wrapper, reader.result);
  };
  reader.readAsDataURL(file);

  const meta = wrapper?.querySelector('[data-role="cover-file-meta"]');
  if (meta) meta.textContent = `${file.name} · ${formatBytes(file.size)}`;
}

function updateCoverPreview(wrapper, src) {
  if (!wrapper) return;
  const img = wrapper.querySelector('[data-role="cover-preview-img"]');
  const hint = wrapper.querySelector('[data-role="cover-empty-hint"]');
  if (!img) return;
  if (src) {
    img.src = src;
    img.hidden = false;
    if (hint) hint.hidden = true;
  } else {
    img.src = '';
    if (hint) hint.hidden = false;
  }
}

function handleCoverClear(triggerBtn) {
  const wrapper = triggerBtn.closest('.cover-field');
  if (!wrapper) return;
  const fileInput = wrapper.querySelector('[data-action="cover-file"]');
  const urlInput = wrapper.querySelector('[data-action="cover-url"]');
  const meta = wrapper.querySelector('[data-role="cover-file-meta"]');
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  if (meta) meta.textContent = 'Sin archivo · max 1 MB · jpg, png, webp';
  updateCoverPreview(wrapper, '');
}

function handleCsvExport() {
  const list = state.lastHomeData.mangas;
  if (!list || list.length === 0) {
    showToast('No hay datos para exportar.', 'warning');
    return;
  }
  const csv = mangasToCsv(list);
  const page = state.filters.page || 1;
  const filename = `seele-mangas-pagina-${page}.csv`;
  downloadCsv(filename, csv);
  showToast(`CSV exportado · ${list.length} filas.`, 'success');
}

// ---------- HTML escape (for confirmDialog message) ----------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Bootstrap ----------
function init() {
  bindGlobalEvents();
  syncAdminUi();
  router();

  // pre-warm tags in background (used by form view)
  ensureTags().catch(() => {});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
