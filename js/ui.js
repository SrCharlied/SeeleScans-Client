// =========================================================
// SeeleScans · ui.js
// DOM helpers, global UI components, and view renderers.
// All renderers are pure: they accept data + write DOM.
// app.js wires events via delegation on data-action attrs.
// =========================================================

// ---------- DOM helpers ----------
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value == null) continue;
    if (key === 'class' || key === 'className') {
      node.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

// ---------- Image fallback (SVG data URI) ----------
const FALLBACK_COVER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='%23DBEAFE'/><stop offset='1' stop-color='%2393C5FD'/></linearGradient></defs><rect width='200' height='300' fill='url(%23g)'/><text x='50%25' y='50%25' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-size='18' fill='%231E3A8A' font-weight='800'>No cover</text></svg>";

const FALLBACK_PAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1200'><rect width='800' height='1200' fill='%23F1F5F9'/><text x='50%25' y='50%25' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-size='48' fill='%2393C5FD' font-weight='800'>Página no disponible</text></svg>";

function attachImageFallback(img, fallback = FALLBACK_COVER) {
  img.addEventListener('error', () => { img.src = fallback; }, { once: true });
}

// ---------- Format helpers ----------
const STATUS_LABELS = {
  ongoing: 'En curso',
  completed: 'Completado',
  hiatus: 'En pausa',
};

const SORT_LABELS = {
  title: 'Título',
  year: 'Año',
  created_at: 'Fecha alta',
  updated_at: 'Actualización',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatChapterNumber(value) {
  if (value == null) return '?';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? `#${num}` : `#${num.toFixed(1).replace(/\.0$/, '')}`;
}

// ---------- Components ----------
function statusBadge(status) {
  if (!status) return null;
  const label = STATUS_LABELS[status] || status;
  return el('span', { class: `status-badge status-badge--${status}` }, label);
}

function tagPill(tag) {
  return el('span', { class: 'tag-pill', dataset: { tagSlug: tag.slug || '' } }, tag?.name || '—');
}

function emptyState({ icon = 'シ', title = 'Sin resultados', text = '' } = {}) {
  return el(
    'div',
    { class: 'empty' },
    el('div', { class: 'empty__icon', 'aria-hidden': 'true' }, icon),
    el('h2', { class: 'empty__title' }, title),
    text ? el('p', { class: 'empty__text' }, text) : null,
  );
}

function errorState(message) {
  return el(
    'div',
    { class: 'error-state' },
    el('h2', { class: 'error-state__title' }, '⚠ Algo salió mal'),
    el('p', {}, message || 'No pudimos cargar los datos.'),
  );
}

function mangaCover(src, alt = '') {
  const img = el('img', {
    src: src || FALLBACK_COVER,
    alt,
    loading: 'lazy',
    decoding: 'async',
  });
  if (src) attachImageFallback(img, FALLBACK_COVER);
  return img;
}

function mangaCard(manga, { adminMode } = {}) {
  const id = manga.id;
  const tagsArr = Array.isArray(manga.tags) ? manga.tags.filter(Boolean) : [];

  const cover = el('div', { class: 'manga-card__cover' }, mangaCover(manga.cover_url, manga.title || ''));

  const body = el(
    'div',
    { class: 'manga-card__body' },
    el('h3', { class: 'manga-card__title' }, manga.title || 'Sin título'),
    manga.author ? el('p', { class: 'manga-card__author' }, manga.author) : null,
    el(
      'div',
      { class: 'manga-card__meta' },
      statusBadge(manga.status),
      manga.year ? el('span', { class: 'manga-card__year' }, manga.year) : null,
    ),
  );

  const tagRow = tagsArr.length
    ? el('div', { class: 'tag-row' }, ...tagsArr.slice(0, 4).map(tagPill))
    : null;

  const adminBar = adminMode
    ? el(
        'div',
        { class: 'manga-card__admin' },
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            dataset: { action: 'edit', id },
          },
          'Editar',
        ),
        el(
          'button',
          {
            class: 'btn btn--danger btn--sm',
            type: 'button',
            dataset: { action: 'delete', id },
          },
          'Borrar',
        ),
      )
    : null;

  return el(
    'article',
    {
      class: 'manga-card',
      role: 'button',
      tabindex: '0',
      dataset: { action: 'open-detail', id, admin: adminMode ? 'true' : 'false' },
      'aria-label': `Ver detalle de ${manga.title || 'manga'}`,
    },
    cover,
    body,
    tagRow,
    adminBar,
  );
}

// ---------- View management ----------
const VIEWS = ['home', 'detail', 'reader', 'form'];

export function showView(name) {
  for (const v of VIEWS) {
    const node = qs(`#view-${v}`);
    if (!node) continue;
    if (v === name) {
      node.hidden = false;
    } else {
      node.hidden = true;
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- Toast ----------
const TOAST_ICONS = { info: 'i', success: '✓', error: '!', warning: '!' };

export function showToast(message, type = 'info', { duration = 3800 } = {}) {
  const container = qs('#toast-container');
  if (!container) return;

  const toast = el(
    'div',
    { class: `toast toast--${type}`, role: 'alert' },
    el('span', { class: 'toast__icon', 'aria-hidden': 'true' }, TOAST_ICONS[type] || TOAST_ICONS.info),
    el('span', { class: 'toast__msg' }, message),
    el(
      'button',
      {
        class: 'toast__close',
        type: 'button',
        'aria-label': 'Cerrar notificación',
        onclick: () => dismiss(),
      },
      '×',
    ),
  );

  container.appendChild(toast);

  let timer;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.add('toast--leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  timer = setTimeout(dismiss, duration);
}

// ---------- Loading overlay ----------
let loadingDepth = 0;

export function showLoading() {
  loadingDepth++;
  const overlay = qs('#loading-overlay');
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
  }
}

export function hideLoading() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth === 0) {
    const overlay = qs('#loading-overlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
  }
}

// ---------- Confirm modal ----------
export function confirmDialog({
  title = '¿Confirmar?',
  message = '',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  destructive = false,
} = {}) {
  return new Promise((resolve) => {
    const root = qs('#modal-root');
    if (!root) { resolve(false); return; }

    const close = (result) => {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      clear(root);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };

    const modal = el(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      el('h2', { id: 'modal-title', class: 'modal__title' }, title),
      el('p', { class: 'modal__msg', html: message }),
      el(
        'div',
        { class: 'modal__actions' },
        el(
          'button',
          { class: 'btn btn--ghost', type: 'button', onclick: () => close(false) },
          cancelText,
        ),
        el(
          'button',
          {
            class: destructive ? 'btn btn--danger-solid' : 'btn btn--primary',
            type: 'button',
            onclick: () => close(true),
          },
          confirmText,
        ),
      ),
    );

    clear(root);
    root.appendChild(modal);
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');

    root.addEventListener('click', (e) => { if (e.target === root) close(false); }, { once: true });
    document.addEventListener('keydown', onKey);

    // focus the destructive button by default to make Enter intuitive
    requestAnimationFrame(() => {
      const target = qs('.btn--danger-solid, .btn--primary', modal);
      target?.focus();
    });
  });
}

// =========================================================
// Renderers
// =========================================================

// ---------- Home ----------
export function renderHomeView({ mangas, meta, filters, adminMode }) {
  const view = qs('#view-home');
  if (!view) return;
  clear(view);

  view.appendChild(renderHomeHero(meta));
  view.appendChild(renderToolbar(filters));

  if (mangas && mangas.length > 0) {
    view.appendChild(renderResultMeta(meta, filters, mangas.length));
    view.appendChild(renderMangaGrid(mangas, adminMode));
    if (meta && meta.totalPages > 1) {
      view.appendChild(renderPagination(meta));
    }
  } else {
    view.appendChild(
      emptyState({
        icon: '∅',
        title: 'Sin mangas para mostrar',
        text: filters?.q
          ? `No encontramos resultados para "${filters.q}". Probá con otra búsqueda o limpiá los filtros.`
          : 'Todavía no hay mangas en el catálogo. Activá el modo admin y agregá el primero.',
      }),
    );
  }
}

function renderHomeHero(meta) {
  const total = meta?.total ?? 0;
  return el(
    'header',
    { class: 'hero' },
    el(
      'span',
      { class: 'hero__eyebrow' },
      'CATÁLOGO ' + (total ? `· ${total} obras` : ''),
    ),
    el(
      'h1',
      { class: 'hero__title' },
      'Lee, descubre y ',
      el('em', {}, 'archiva.'),
    ),
    el(
      'p',
      { class: 'hero__subtitle' },
      'Una colección curada de mangas, con detalle de capítulos y lector integrado. Filtra, busca y descubre lo que sigue.',
    ),
  );
}

function renderToolbar(filters) {
  const f = filters || {};

  const search = el(
    'div',
    { class: 'search' },
    el('span', {
      class: 'search__icon',
      html:
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    }),
    el('input', {
      type: 'search',
      class: 'input search__input',
      placeholder: 'Buscar por título…',
      value: f.q || '',
      'aria-label': 'Buscar mangas por título',
      dataset: { action: 'search-input' },
    }),
  );

  const sortField = el(
    'label',
    { class: 'field', style: 'flex: 1' },
    el('span', { class: 'field__label' }, 'Ordenar por'),
    selectControl(
      Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label })),
      f.sort || 'created_at',
      'sort-select',
    ),
  );

  const orderToggle = el(
    'button',
    {
      class: 'order-toggle',
      type: 'button',
      'aria-label': `Orden actual: ${f.order === 'asc' ? 'ascendente' : 'descendente'}`,
      dataset: { action: 'order-toggle', order: f.order || 'desc' },
    },
    el('span', { class: 'order-toggle__icon', 'aria-hidden': 'true' }, '↓'),
    f.order === 'asc' ? 'ASC' : 'DESC',
  );

  const orderField = el(
    'label',
    { class: 'field' },
    el('span', { class: 'field__label' }, 'Dirección'),
    orderToggle,
  );

  const limitField = el(
    'label',
    { class: 'field' },
    el('span', { class: 'field__label' }, 'Por página'),
    selectControl(
      [
        { value: '5', label: '5' },
        { value: '10', label: '10' },
        { value: '20', label: '20' },
        { value: '40', label: '40' },
      ],
      String(f.limit || 10),
      'limit-select',
    ),
  );

  const csv = el(
    'button',
    {
      class: 'btn btn--ghost csv-btn',
      type: 'button',
      dataset: { action: 'csv-export' },
      title: 'Exportar página actual a CSV',
    },
    el('span', { 'aria-hidden': 'true' }, '⬇'),
    'CSV',
  );

  return el(
    'div',
    { class: 'toolbar', role: 'search' },
    search,
    sortField,
    orderField,
    limitField,
    csv,
  );
}

function selectControl(options, value, action) {
  const select = el(
    'select',
    { class: 'select', dataset: { action } },
    ...options.map((opt) =>
      el('option', { value: opt.value, selected: opt.value === value }, opt.label),
    ),
  );
  return select;
}

function renderResultMeta(meta, filters, count = 0) {
  const m = meta || {};
  const f = filters || {};
  const chips = [];

  if (f.q) {
    chips.push(
      el(
        'span',
        { class: 'filter-chip' },
        `q: "${f.q}"`,
        el(
          'button',
          {
            class: 'filter-chip__close',
            type: 'button',
            'aria-label': 'Quitar filtro de búsqueda',
            dataset: { action: 'clear-search' },
          },
          '×',
        ),
      ),
    );
  }

  return el(
    'div',
    { class: 'result-meta' },
    el(
      'div',
      { class: 'result-meta__count' },
      'Mostrando ',
      el('strong', {}, String(count)),
      ' de ',
      el('strong', {}, String(m.total ?? 0)),
      ' · página ',
      el('strong', {}, String(m.page ?? 1)),
      ' de ',
      el('strong', {}, String(m.totalPages ?? 1)),
    ),
    chips.length ? el('div', { class: 'result-meta__filters' }, ...chips) : null,
  );
}

function renderMangaGrid(mangas, adminMode) {
  return el(
    'div',
    { class: 'manga-grid', role: 'list' },
    ...mangas.map((m) => mangaCard(m, { adminMode })),
  );
}

function renderPagination(meta) {
  const page = meta.page ?? 1;
  const totalPages = meta.totalPages ?? 1;

  return el(
    'nav',
    { class: 'pagination', 'aria-label': 'Paginación' },
    el(
      'button',
      {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        dataset: { action: 'page-prev' },
        disabled: page <= 1,
      },
      '← Anterior',
    ),
    el(
      'span',
      { class: 'pagination__indicator' },
      'PÁGINA ',
      el('strong', {}, String(page)),
      ' / ',
      String(totalPages),
    ),
    el(
      'button',
      {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        dataset: { action: 'page-next' },
        disabled: page >= totalPages,
      },
      'Siguiente →',
    ),
  );
}

// ---------- Detail ----------
export function renderDetailView({ manga, chapters, chaptersWithPages, adminMode, error }) {
  const view = qs('#view-detail');
  if (!view) return;
  clear(view);

  if (error) {
    view.appendChild(detailBackLink());
    view.appendChild(errorState(error));
    return;
  }

  if (!manga) {
    view.appendChild(detailBackLink());
    view.appendChild(
      emptyState({
        icon: '?',
        title: 'Manga no encontrado',
        text: 'Puede que haya sido eliminado o que el ID no sea válido.',
      }),
    );
    return;
  }

  const tagsArr = Array.isArray(manga.tags) ? manga.tags.filter(Boolean) : [];
  const ch = Array.isArray(chapters) ? chapters : [];

  view.appendChild(detailBackLink());

  const cover = el(
    'aside',
    { class: 'detail__cover' },
    mangaCover(manga.cover_url, manga.title || ''),
  );

  const meta = el(
    'div',
    { class: 'detail__meta' },
    metaItem('Estado', statusBadge(manga.status) || '—'),
    metaItem('Año', manga.year || '—'),
    metaItem('Autor', manga.author || '—'),
    manga.artist && manga.artist !== manga.author
      ? metaItem('Dibujo', manga.artist)
      : null,
  );

  const tagsBlock = tagsArr.length
    ? el(
        'div',
        { class: 'detail__tags' },
        ...tagsArr.map(tagPill),
      )
    : null;

  const adminActions = adminMode
    ? el(
        'div',
        { class: 'detail__actions' },
        el(
          'button',
          {
            class: 'btn btn--ghost',
            type: 'button',
            dataset: { action: 'edit', id: manga.id },
          },
          'Editar',
        ),
        el(
          'button',
          {
            class: 'btn btn--danger',
            type: 'button',
            dataset: { action: 'delete', id: manga.id },
          },
          'Borrar',
        ),
      )
    : null;

  const content = el(
    'div',
    { class: 'detail__content' },
    el('span', { class: 'detail__eyebrow' }, '✦ Ficha'),
    el('h1', { class: 'detail__title' }, manga.title || 'Sin título'),
    meta,
    tagsBlock,
    manga.synopsis
      ? el('p', { class: 'detail__synopsis' }, manga.synopsis)
      : el('p', { class: 'detail__synopsis', style: 'color: var(--text-faint)' }, 'Sin sinopsis disponible.'),
    adminActions,
  );

  view.appendChild(el('div', { class: 'detail' }, cover, content));

  // chapters section
  const chaptersSection = el('section', { class: 'chapters' });
  chaptersSection.appendChild(
    el(
      'h2',
      { class: 'section-title' },
      'Capítulos',
      el('span', { class: 'section-title__count' }, `${ch.length} disponibles`),
    ),
  );

  if (ch.length === 0) {
    chaptersSection.appendChild(
      emptyState({
        icon: '◇',
        title: 'Aún no hay capítulos',
        text: 'Cuando se publiquen, aparecerán acá listos para leer.',
      }),
    );
  } else {
    chaptersSection.appendChild(renderChapterList(ch, chaptersWithPages || new Set()));
  }

  view.appendChild(chaptersSection);
}

function detailBackLink() {
  return el(
    'a',
    { class: 'detail-back', href: '#/', dataset: { action: 'back-home' } },
    '←',
    'Volver al catálogo',
  );
}

function metaItem(label, value) {
  return el(
    'div',
    { class: 'detail__meta-item' },
    el('span', { class: 'detail__meta-label' }, label),
    el('span', { class: 'detail__meta-value' }, value instanceof Node ? value : (value ?? '—')),
  );
}

function renderChapterList(chapters, withPagesSet) {
  return el(
    'ul',
    { class: 'chapter-list' },
    ...chapters.map((ch) => chapterRow(ch, withPagesSet.has(ch.id))),
  );
}

function chapterRow(chapter, hasPages) {
  // We don't actually know if chapter has pages until reader fetches.
  // But we can show "Sin páginas" if it was previously detected empty (cached set).
  const empty = hasPages === false;
  const numStr = formatChapterNumber(chapter.number);
  const dateStr = formatDate(chapter.published_at || chapter.created_at);

  if (empty) {
    return el(
      'li',
      { class: 'chapter-item chapter-item--empty', 'aria-disabled': 'true' },
      el('span', { class: 'chapter-item__num' }, numStr),
      el('span', { class: 'chapter-item__title' }, chapter.title || 'Sin título'),
      el('span', { class: 'chapter-item__date' }, dateStr),
      el('span', { class: 'chapter-empty-badge' }, 'Sin páginas'),
    );
  }

  return el(
    'li',
    {
      class: 'chapter-item',
      role: 'button',
      tabindex: '0',
      dataset: { action: 'open-reader', id: chapter.id },
    },
    el('span', { class: 'chapter-item__num' }, numStr),
    el('span', { class: 'chapter-item__title' }, chapter.title || 'Sin título'),
    el('span', { class: 'chapter-item__date' }, dateStr),
    el('span', { class: 'chapter-item__cta' }, 'Leer'),
  );
}

// ---------- Reader ----------
export function renderReaderView({ manga, chapter, pages, prevChapter, nextChapter, error }) {
  const view = qs('#view-reader');
  if (!view) return;
  clear(view);

  if (error) {
    view.appendChild(errorState(error));
    return;
  }

  const backHref = manga ? `#/manga/${manga.id}` : '#/';
  const back = el(
    'a',
    { class: 'detail-back', href: backHref },
    '←',
    'Volver',
  );

  const header = el(
    'header',
    { class: 'reader-header' },
    el(
      'div',
      { class: 'reader-header__inner' },
      back,
      el(
        'div',
        { class: 'reader-header__title' },
        el('span', { class: 'reader-header__manga' }, manga?.title || 'Manga'),
        el(
          'span',
          { class: 'reader-header__chapter' },
          `${formatChapterNumber(chapter?.number)} · ${chapter?.title || 'Capítulo'}`,
        ),
      ),
      el(
        'div',
        { style: 'display:flex; gap:.5rem' },
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            disabled: !prevChapter,
            dataset: prevChapter ? { action: 'reader-prev', id: prevChapter.id } : {},
          },
          '← Anterior',
        ),
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            disabled: !nextChapter,
            dataset: nextChapter ? { action: 'reader-next', id: nextChapter.id } : {},
          },
          'Siguiente →',
        ),
      ),
    ),
  );

  view.appendChild(back);
  view.appendChild(header);

  if (!pages || pages.length === 0) {
    view.appendChild(
      el(
        'div',
        { class: 'reader-empty' },
        el('h2', { class: 'reader-empty__title' }, 'Aún no disponible'),
        el(
          'p',
          {},
          'Las páginas de este capítulo todavía no se publicaron. Volvé a intentarlo más tarde.',
        ),
      ),
    );
    return;
  }

  const list = el(
    'div',
    { class: 'reader-pages' },
    ...pages.map((p) => readerPage(p)),
  );

  view.appendChild(list);

  view.appendChild(
    el(
      'div',
      { class: 'reader-footer' },
      el(
        'button',
        {
          class: 'btn btn--ghost',
          type: 'button',
          disabled: !prevChapter,
          dataset: prevChapter ? { action: 'reader-prev', id: prevChapter.id } : {},
        },
        '← Capítulo anterior',
      ),
      el('span', { class: 'pagination__indicator' }, `${pages.length} páginas`),
      el(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          disabled: !nextChapter,
          dataset: nextChapter ? { action: 'reader-next', id: nextChapter.id } : {},
        },
        'Siguiente capítulo →',
      ),
    ),
  );
}

function readerPage(page) {
  const img = el('img', {
    src: page.image_url || FALLBACK_PAGE,
    alt: `Página ${page.page_number}`,
    loading: 'lazy',
    decoding: 'async',
  });
  attachImageFallback(img, FALLBACK_PAGE);

  return el(
    'figure',
    { class: 'reader-page' },
    img,
    el('figcaption', { class: 'reader-page__num' }, `P. ${page.page_number}`),
  );
}

// ---------- Form ----------
export function renderFormView({ manga, tags, mode }) {
  const view = qs('#view-form');
  if (!view) return;
  clear(view);

  const isEdit = mode === 'edit';
  const m = manga || {};
  const selectedTags = new Set(
    (Array.isArray(m.tags) ? m.tags : []).map((t) => t?.slug).filter(Boolean),
  );

  const back = el(
    'a',
    { class: 'detail-back', href: isEdit && m.id ? `#/manga/${m.id}` : '#/' },
    '←',
    isEdit ? 'Volver al detalle' : 'Volver al catálogo',
  );

  const form = el(
    'form',
    {
      class: 'form-card',
      novalidate: true,
      dataset: { action: 'form', mode, id: m.id || '' },
    },
    el(
      'h1',
      { class: 'form-card__title' },
      isEdit ? 'Editar manga' : 'Nuevo manga',
    ),
    el(
      'p',
      { class: 'form-card__subtitle' },
      isEdit
        ? 'Actualizá los campos que quieras cambiar. Los vacíos se mantienen igual.'
        : 'Completá los campos obligatorios para sumar una obra al catálogo.',
    ),

    el(
      'div',
      { class: 'form-grid' },
      formField({
        name: 'title',
        label: 'Título',
        required: true,
        value: m.title || '',
        placeholder: 'One Piece',
        full: true,
      }),
      formField({
        name: 'slug',
        label: 'Slug',
        required: true,
        value: m.slug || '',
        placeholder: 'one-piece',
        hint: 'Solo minúsculas, números y guiones (-).',
        pattern: '^[a-z0-9-]+$',
      }),
      formField({
        name: 'year',
        label: 'Año',
        type: 'number',
        value: m.year ?? '',
        placeholder: '1997',
        min: 1900,
        max: 2100,
      }),
      formSelect({
        name: 'status',
        label: 'Estado',
        required: true,
        value: m.status || 'ongoing',
        options: [
          { value: 'ongoing', label: 'En curso' },
          { value: 'completed', label: 'Completado' },
          { value: 'hiatus', label: 'En pausa' },
        ],
      }),
      coverField({ value: m.cover_url || '' }),
      formField({
        name: 'author',
        label: 'Autor',
        value: m.author || '',
        placeholder: 'Eiichiro Oda',
      }),
      formField({
        name: 'artist',
        label: 'Dibujante',
        value: m.artist || '',
        placeholder: 'Eiichiro Oda',
      }),
      formTextarea({
        name: 'synopsis',
        label: 'Sinopsis',
        value: m.synopsis || '',
        placeholder: 'Resumen breve de la obra…',
        full: true,
      }),
      el(
        'div',
        { class: 'field form-grid__full' },
        el('span', { class: 'field__label' }, 'Tags'),
        tags && tags.length
          ? el(
              'div',
              { class: 'tag-checks' },
              ...tags.map((t) => tagCheckbox(t, selectedTags.has(t.slug))),
            )
          : el('p', { class: 'field__hint' }, 'No hay tags disponibles.'),
      ),
    ),

    el(
      'div',
      { class: 'form-actions' },
      el(
        'button',
        { type: 'button', class: 'btn btn--ghost', dataset: { action: 'form-cancel' } },
        'Cancelar',
      ),
      el(
        'button',
        { type: 'submit', class: 'btn btn--primary' },
        isEdit ? 'Guardar cambios' : 'Crear manga',
      ),
    ),
  );

  view.appendChild(back);
  view.appendChild(form);
}

function formField({
  name,
  label,
  type = 'text',
  required = false,
  value = '',
  placeholder,
  hint,
  pattern,
  min,
  max,
  full = false,
} = {}) {
  return el(
    'label',
    { class: full ? 'field form-grid__full' : 'field', for: `f-${name}` },
    el(
      'span',
      { class: 'field__label' },
      label,
      required ? el('span', { 'aria-hidden': 'true', style: 'color: var(--danger)' }, ' *') : null,
    ),
    el('input', {
      class: 'input',
      id: `f-${name}`,
      name,
      type,
      value,
      placeholder: placeholder || '',
      required,
      pattern,
      min,
      max,
      autocomplete: 'off',
    }),
    hint ? el('span', { class: 'field__hint' }, hint) : null,
  );
}

function formTextarea({ name, label, value = '', placeholder, full = false } = {}) {
  return el(
    'label',
    { class: full ? 'field form-grid__full' : 'field', for: `f-${name}` },
    el('span', { class: 'field__label' }, label),
    el(
      'textarea',
      {
        class: 'textarea',
        id: `f-${name}`,
        name,
        placeholder: placeholder || '',
        rows: 5,
      },
      value,
    ),
  );
}

function formSelect({ name, label, required, value, options } = {}) {
  return el(
    'label',
    { class: 'field', for: `f-${name}` },
    el(
      'span',
      { class: 'field__label' },
      label,
      required ? el('span', { 'aria-hidden': 'true', style: 'color: var(--danger)' }, ' *') : null,
    ),
    el(
      'select',
      { class: 'select', id: `f-${name}`, name, required },
      ...options.map((opt) =>
        el('option', { value: opt.value, selected: opt.value === value }, opt.label),
      ),
    ),
  );
}

function coverField({ value = '' } = {}) {
  const initialUrl = value || '';
  const previewImg = el('img', {
    src: initialUrl || FALLBACK_COVER,
    alt: 'Preview de la portada',
    'data-role': 'cover-preview-img',
  });
  if (initialUrl) attachImageFallback(previewImg, FALLBACK_COVER);

  const preview = el(
    'div',
    { class: 'cover-preview', 'data-role': 'cover-preview' },
    previewImg,
    el('span', { class: 'cover-preview__hint', 'data-role': 'cover-empty-hint', hidden: !!initialUrl }, 'Sin imagen'),
  );

  const fileInput = el('input', {
    id: 'f-cover-file',
    name: 'cover_file',
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    'data-action': 'cover-file',
    hidden: true,
  });

  const fileButton = el(
    'label',
    { class: 'btn btn--ghost btn--sm cover-file-btn', for: 'f-cover-file' },
    el('span', { 'aria-hidden': 'true' }, '⬆'),
    'Subir archivo',
  );

  const fileMeta = el(
    'span',
    { class: 'cover-file-meta', 'data-role': 'cover-file-meta' },
    'Sin archivo · max 1 MB · jpg, png, webp',
  );

  const urlInput = el('input', {
    id: 'f-cover_url',
    name: 'cover_url',
    type: 'url',
    class: 'input',
    value: initialUrl,
    placeholder: 'https://… (opcional si subís archivo)',
    'data-action': 'cover-url',
    autocomplete: 'off',
  });

  const clearBtn = el(
    'button',
    { type: 'button', class: 'btn btn--ghost btn--sm', 'data-action': 'cover-clear' },
    'Quitar imagen',
  );

  return el(
    'div',
    { class: 'field form-grid__full cover-field' },
    el('span', { class: 'field__label' }, 'Portada'),
    el(
      'div',
      { class: 'cover-field__inner' },
      preview,
      el(
        'div',
        { class: 'cover-field__controls' },
        el(
          'div',
          { class: 'cover-field__row' },
          fileInput,
          fileButton,
          fileMeta,
        ),
        el('div', { class: 'cover-field__divider' }, el('span', {}, 'o')),
        el(
          'label',
          { class: 'field', for: 'f-cover_url' },
          el('span', { class: 'field__label' }, 'Pegar URL externa'),
          urlInput,
        ),
        el('div', { class: 'cover-field__actions' }, clearBtn),
      ),
    ),
    el(
      'span',
      { class: 'field__hint' },
      'Si subís archivo, se guarda en el servidor y reemplaza la URL al guardar.',
    ),
  );
}

function tagCheckbox(tag, checked) {
  return el(
    'span',
    { class: 'tag-check' },
    el('input', {
      type: 'checkbox',
      id: `tag-${tag.slug}`,
      name: 'tags',
      value: tag.slug,
      checked,
    }),
    el('label', { class: 'tag-check__label', for: `tag-${tag.slug}` }, tag.name),
  );
}

// =========================================================
// Form helpers used by app.js
// =========================================================
export function readFormPayload(form) {
  const fd = new FormData(form);
  const get = (key) => {
    const v = fd.get(key);
    return v === null ? '' : String(v).trim();
  };

  const tags = fd.getAll('tags').map(String);
  const yearRaw = get('year');
  const year = yearRaw === '' ? undefined : Number.parseInt(yearRaw, 10);

  return {
    title: get('title'),
    slug: get('slug'),
    status: get('status'),
    year,
    cover_url: get('cover_url') || undefined,
    author: get('author') || undefined,
    artist: get('artist') || undefined,
    synopsis: get('synopsis') || undefined,
    tags,
  };
}

export function validateMangaPayload(payload, { partial = false } = {}) {
  const errors = {};
  const slugRegex = /^[a-z0-9-]+$/;
  const statuses = ['ongoing', 'completed', 'hiatus'];

  if (!partial || payload.title !== undefined) {
    if (!payload.title) errors.title = 'El título es obligatorio.';
  }
  if (!partial || payload.slug !== undefined) {
    if (!payload.slug) errors.slug = 'El slug es obligatorio.';
    else if (!slugRegex.test(payload.slug))
      errors.slug = 'Solo minúsculas, números y guiones.';
  }
  if (!partial || payload.status !== undefined) {
    if (!statuses.includes(payload.status))
      errors.status = 'Estado inválido.';
  }
  if (payload.year !== undefined && payload.year !== null && payload.year !== '') {
    const y = Number(payload.year);
    if (!Number.isInteger(y) || y < 1900 || y > 2100)
      errors.year = 'Año debe estar entre 1900 y 2100.';
  }
  if (payload.cover_url) {
    try { new URL(payload.cover_url); } catch { errors.cover_url = 'URL inválida.'; }
  }
  return errors;
}

export function attachFieldErrors(form, errors) {
  qsa('.field__error', form).forEach((n) => n.remove());
  qsa('.input, .textarea, .select', form).forEach((input) => input.classList.remove('input--error'));

  for (const [name, message] of Object.entries(errors)) {
    const input = qs(`[name="${name}"]`, form);
    if (!input) continue;
    const field = input.closest('.field');
    if (!field) continue;
    const errEl = el('span', { class: 'field__error' }, message);
    field.appendChild(errEl);
  }
}

// CSV helpers
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function mangasToCsv(mangas) {
  const headers = ['id', 'slug', 'title', 'author', 'artist', 'status', 'year', 'tags', 'cover_url'];
  const lines = [headers.join(',')];
  for (const m of mangas) {
    const tagSlugs = Array.isArray(m.tags) ? m.tags.map((t) => t?.slug).filter(Boolean).join('|') : '';
    lines.push(
      [
        m.id,
        m.slug,
        m.title,
        m.author,
        m.artist,
        m.status,
        m.year,
        tagSlugs,
        m.cover_url,
      ].map(csvEscape).join(','),
    );
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename, csv) {
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
