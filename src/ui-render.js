/**
 * ui-render.js
 * ----------------------------------------------------------------------------
 * Presentation layer: nhận data → sinh DOM. Không đụng Firestore/Auth.
 *
 * Thay đổi FIX3:
 *   - Icon set chuyên nghiệp (Lucide-style, outline 1.75px).
 *   - Lightbox: bấm ảnh mở viewer full screen, có nav prev/next, thumbnails,
 *     keyboard support (← → Esc), counter.
 *   - Card hiển thị badge "N ảnh" khi có nhiều ảnh.
 *   - Bỏ `onclick="event.stopPropagation()"` trên `.card__admin` — đây chính là
 *     bug khiến nút edit/delete không kích hoạt (click bị nuốt trước khi
 *     bubble tới container delegate).
 *   - Labels property/legal dịch qua i18n.
 * ----------------------------------------------------------------------------
 */

import { escapeHtml, formatPriceLabel, normalizeImageUrl, isDataUrl } from './utils.js';
import { t, onLangChange, getLang, translateArea, pickLocalized } from './i18n.js';

/* ───────────────────────── Icons (Lucide-style, 24px) ───────────────────────── */

const SVG_ATTRS = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`;

const ICONS = {
  home:     `<svg ${SVG_ATTRS}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>`,
  pin:      `<svg ${SVG_ATTRS}><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  bed:      `<svg ${SVG_ATTRS}><path d="M2 18V7"/><path d="M22 18v-5a2 2 0 0 0-2-2H4"/><path d="M2 14h20"/><circle cx="7" cy="11" r="2"/></svg>`,
  bath:     `<svg ${SVG_ATTRS}><path d="M4 12V6a2 2 0 0 1 4 0v.5"/><path d="M2 12h20v4a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><path d="M7 20v2M17 20v2"/></svg>`,
  area:     `<svg ${SVG_ATTRS}><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M3 9h18"/></svg>`,
  edit:     `<svg ${SVG_ATTRS}><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="m18.5 2.5 3 3L11 16l-4 1 1-4 10.5-10.5z"/></svg>`,
  trash:    `<svg ${SVG_ATTRS}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`,
  check:    `<svg ${SVG_ATTRS}><path d="m5 12 5 5L20 7"/></svg>`,
  error:    `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  info:     `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  close:    `<svg ${SVG_ATTRS}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  chevL:    `<svg ${SVG_ATTRS}><path d="m15 18-6-6 6-6"/></svg>`,
  chevR:    `<svg ${SVG_ATTRS}><path d="m9 6 6 6-6 6"/></svg>`,
  phone:    `<svg ${SVG_ATTRS}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5 12.8 12.8 0 0 0 2.8.7A2 2 0 0 1 22 16.9z"/></svg>`,
  globe:    `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.45 2.9h-2.33V22c4.78-.78 8.43-4.93 8.43-9.93z"/></svg>`,
  images:   `<svg ${SVG_ATTRS}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`,
  plus:     `<svg ${SVG_ATTRS}><path d="M12 5v14M5 12h14"/></svg>`,
  search:   `<svg ${SVG_ATTRS}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  sort:     `<svg ${SVG_ATTRS}><path d="M3 6h13M3 12h9M3 18h5M17 8l4-4-4-4M21 4v12a4 4 0 0 1-4 4h-1"/></svg>`,
  // Ngôi sao: dùng cho admin (feature listing) VÀ khách (lưu yêu thích).
  // Biến thể outline + filled cho trạng thái on/off.
  starOutline: `<svg ${SVG_ATTRS}><path d="m12 3 2.9 6.1 6.6.9-4.8 4.5 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 10l6.6-.9z"/></svg>`,
  starFilled:  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="m12 3 2.9 6.1 6.6.9-4.8 4.5 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 10l6.6-.9z"/></svg>`,
  send:     `<svg ${SVG_ATTRS}><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></svg>`,
  user:     `<svg ${SVG_ATTRS}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  comment:  `<svg ${SVG_ATTRS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  // Logo Zalo app thật (xanh #0068FF + chữ "Zalo" trắng)
  zalo:     `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#0068FF"/><text x="24" y="31" text-anchor="middle" font-family="system-ui,-apple-system,'SF Pro Text','Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="16" letter-spacing="-0.3" fill="#fff">Zalo</text></svg>`,
};

export { ICONS };

const PLACEHOLDER_IMG = 'https://placehold.co/800x520/eef2f7/64748b?text=hoangsam.bds';

/* ───────────────────────── Label maps (i18n) ───────────────────────── */

function propertyLabel(k) { return t('property.' + (k || 'nha-pho')); }
function legalLabel(k)    { return k ? t('legal.' + k) : ''; }

/* ───────────────────────── Card renderer ───────────────────────── */

/**
 * renderCards — render listings vào container.
 *
 * @param {HTMLElement} container
 * @param {Listing[]} listings
 * @param {object} opts
 * @param {boolean} opts.isAdmin - show/hide admin buttons
 * @param {(id: string) => void} [opts.onEdit]
 * @param {(id: string) => void} [opts.onDelete]
 * @param {(id: string) => void} [opts.onCardClick]
 * @param {(id: string) => void} [opts.onImageClick]  - bấm ảnh mở lightbox
 */
export function renderCards(container, listings, opts = {}) {
  if (!container) return;

  if (!listings || listings.length === 0) {
    renderEmpty(container);
    return;
  }

  const { isAdmin = false, favorites = new Set() } = opts;
  // LCP: 2 card đầu tải high-priority, còn lại lazy.
  container.innerHTML = listings.map((x, i) =>
    _cardHTML(x, isAdmin, i < 2, favorites.has ? favorites.has(x.id) : false)
  ).join('');

  // Delegation: 1 listener cho toàn grid, không leak khi re-render.
  container.onclick = (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    const id = action.dataset.id;
    if (!id) return;

    switch (action.dataset.action) {
      case 'edit':
        e.stopPropagation();
        e.preventDefault();
        opts.onEdit?.(id);
        break;
      case 'delete':
        e.stopPropagation();
        e.preventDefault();
        opts.onDelete?.(id);
        break;
      case 'star':
        // Khách: lưu vào favorites (localStorage). Admin: bật/tắt featured.
        e.stopPropagation();
        e.preventDefault();
        opts.onStarClick?.(id);
        break;
      case 'image':
        e.stopPropagation();
        opts.onImageClick?.(id);
        break;
      case 'open':
        opts.onCardClick?.(id);
        break;
    }
  };
}

function _cardHTML(x, isAdmin, isAboveFold = false, isFavorite = false) {
  // Title: ưu tiên bản dịch theo ngôn ngữ khách; fallback VI
  const titleLocal  = pickLocalized({ vi: x.title, en: x.title_en, zh: x.title_zh });
  const title       = escapeHtml(titleLocal || '');
  // Description excerpt: cùng quy tắc fallback
  const descLocal   = pickLocalized({
    vi: x.description, en: x.description_en, zh: x.description_zh,
  });
  const descExcerpt = descLocal ? escapeHtml(descLocal) : '';
  const location    = escapeHtml(x.location || '');
  // Area (quận/huyện) dịch theo ngôn ngữ hiện tại
  const area        = escapeHtml(translateArea(x.area || ''));
  const priceLabel  = escapeHtml(x.priceLabel || (x.priceValue ? formatPriceLabel(x.priceValue) : t('spec.contact')));
  const images      = Array.isArray(x.images) && x.images.length ? x.images : (x.image ? [x.image] : []);
  const coverRaw    = images[0] || PLACEHOLDER_IMG;
  // Chuẩn hoá URL để giảm dung lượng tải (unsplash/dropbox/GDrive)
  const cover       = isDataUrl(coverRaw) ? coverRaw : normalizeImageUrl(coverRaw, 900);
  const propType    = propertyLabel(x.propertyType);
  const legalStatus = legalLabel(x.legalStatus);
  const bedrooms    = Number(x.bedrooms) || 0;
  const bathrooms   = Number(x.bathrooms) || 0;
  const areaSqm     = Number(x.areaSqm) || 0;
  const safeId      = escapeHtml(x.id);
  const safeImage   = escapeHtml(cover);
  const photoCount  = images.length;
  const isFeatured  = !!x.featured;

  // LCP: 2 ảnh đầu → eager + fetchpriority=high ; còn lại lazy
  const loadingAttrs = isAboveFold
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" fetchpriority="low" decoding="async"';

  const mediaAria = escapeHtml(t('lightbox.open_image') || 'Xem ảnh');

  // ─── Ngôi sao: admin = nổi bật (Firestore) · khách = lưu yêu thích (localStorage)
  const starOn    = isAdmin ? isFeatured : isFavorite;
  const starLabel = isAdmin
    ? (starOn ? t('card.unfeature') : t('card.feature'))
    : (starOn ? t('card.unfavorite') : t('card.favorite'));
  const starIcon  = starOn ? ICONS.starFilled : ICONS.starOutline;

  return `
    <article class="card ${isFeatured ? 'card--featured' : ''} ${x.status ? 'card--status-' + escapeHtml(x.status) : ''}" data-id="${safeId}" data-action="open">
      <div class="card__media" data-action="image" data-id="${safeId}" role="button" tabindex="0" aria-label="${mediaAria}">
        <img src="${safeImage}" alt="${title}" ${loadingAttrs}
             width="800" height="600"
             onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'" />
        <span class="card__badge card__badge--type">${escapeHtml(propType)}</span>
        ${area ? `<span class="card__badge card__badge--area">${ICONS.pin}<span>${area}</span></span>` : ''}
        ${photoCount > 1 ? `<span class="card__badge card__badge--count">${ICONS.images}<span>${photoCount}</span></span>` : ''}
        ${isFeatured && !x.status ? `<span class="card__badge card__badge--featured">${ICONS.starFilled}<span>${escapeHtml(t('card.featured_badge'))}</span></span>` : ''}

        ${x.status
          ? `<span class="card__status card__status--${escapeHtml(x.status)}">${escapeHtml(t('status.' + x.status))}</span>`
          : `<button class="card__star ${starOn ? 'is-on' : ''}"
                data-action="star" data-id="${safeId}" type="button"
                aria-pressed="${starOn ? 'true' : 'false'}" aria-label="${escapeHtml(starLabel)}"
                title="${escapeHtml(starLabel)}">
          ${starIcon}
        </button>`}
      </div>

      <div class="card__body">
        <h3 class="card__title">${title}</h3>
        <p class="card__location">${ICONS.pin}<span>${location}</span></p>
        ${descExcerpt ? `<p class="card__desc">${descExcerpt}</p>` : ''}

        <div class="card__specs">
          ${areaSqm   ? `<span class="spec">${ICONS.area}<strong>${areaSqm}</strong> ${escapeHtml(t('spec.sqm'))}</span>` : ''}
          ${bedrooms  ? `<span class="spec">${ICONS.bed}<strong>${bedrooms}</strong> ${escapeHtml(t('spec.bed'))}</span>` : ''}
          ${bathrooms ? `<span class="spec">${ICONS.bath}<strong>${bathrooms}</strong> ${escapeHtml(t('spec.bath'))}</span>` : ''}
        </div>

        <div class="card__footer">
          <span class="card__price">${priceLabel}</span>
          ${legalStatus ? `<span class="card__legal">${escapeHtml(legalStatus)}</span>` : ''}
        </div>

        ${isAdmin ? `
          <div class="card__admin">
            <button class="icon-btn" data-action="edit" data-id="${safeId}" type="button" aria-label="Edit">
              ${ICONS.edit}
            </button>
            <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${safeId}" type="button" aria-label="Delete">
              ${ICONS.trash}
            </button>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

/* ───────────────────────── Skeleton ───────────────────────── */

export function renderSkeleton(container, count = 6) {
  if (!container) return;
  const skel = `
    <article class="card card--skeleton" aria-hidden="true">
      <div class="skel skel--media"></div>
      <div class="card__body">
        <div class="skel skel--line skel--line-lg"></div>
        <div class="skel skel--line skel--line-md"></div>
        <div class="skel skel--row">
          <div class="skel skel--chip"></div>
          <div class="skel skel--chip"></div>
          <div class="skel skel--chip"></div>
        </div>
        <div class="skel skel--line skel--line-sm"></div>
      </div>
    </article>
  `;
  container.innerHTML = skel.repeat(count);
  container.onclick = null;
}

/* ───────────────────────── Empty state ───────────────────────── */

export function renderEmpty(container, opts = {}) {
  const {
    title = t('empty.title'),
    message = t('empty.msg'),
    actionLabel = '',
    onAction = null,
  } = opts;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">${ICONS.home}</div>
      <h3 class="empty-state__title">${escapeHtml(title)}</h3>
      <p class="empty-state__msg">${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="btn btn--primary" id="empty-action">${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;
  if (actionLabel && onAction) {
    container.querySelector('#empty-action')?.addEventListener('click', onAction);
  }
}

/* ───────────────────────── Error state ───────────────────────── */

export function renderError(container, message = 'Đã có lỗi xảy ra') {
  container.innerHTML = `
    <div class="empty-state empty-state--error">
      <div class="empty-state__icon">${ICONS.error}</div>
      <h3 class="empty-state__title">${escapeHtml(t('empty.err_title'))}</h3>
      <p class="empty-state__msg">${escapeHtml(message)}</p>
      <button class="btn btn--primary" onclick="location.reload()">${escapeHtml(t('empty.retry'))}</button>
    </div>
  `;
}

/* ───────────────────────── Toast ───────────────────────── */

let _toastRoot = null;
let _toastId = 0;

function _ensureToastRoot() {
  if (_toastRoot && document.body.contains(_toastRoot)) return _toastRoot;
  _toastRoot = document.createElement('div');
  _toastRoot.className = 'toast-stack';
  _toastRoot.setAttribute('aria-live', 'polite');
  _toastRoot.setAttribute('aria-atomic', 'true');
  document.body.appendChild(_toastRoot);
  return _toastRoot;
}

export function toast(message, type = 'success', duration = 3200) {
  const root = _ensureToastRoot();
  const id = ++_toastId;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.dataset.id = String(id);

  const icon = type === 'success' ? ICONS.check
             : type === 'error'   ? ICONS.error
             : ICONS.info;

  el.innerHTML = `
    <span class="toast__icon">${icon}</span>
    <span class="toast__msg">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Close">${ICONS.close}</button>
  `;

  el.querySelector('.toast__close').addEventListener('click', () => _dismiss(el));
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));

  const timer = setTimeout(() => _dismiss(el), duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  return id;
}

function _dismiss(el) {
  if (!el || !el.parentNode) return;
  el.classList.remove('toast--in');
  el.classList.add('toast--out');
  setTimeout(() => el.remove(), 240);
}

/* ───────────────────────── Admin chrome ───────────────────────── */

export function updateAdminUI(state) {
  const isAdmin = !!state?.isAdmin;
  const isSignedIn = !!state?.isSignedIn;
  document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = !isAdmin; });
  document.querySelectorAll('[data-when="signed-in"]').forEach(el => { el.hidden = !isSignedIn; });
  document.querySelectorAll('[data-when="signed-out"]').forEach(el => { el.hidden = isSignedIn; });

  // Nút auth toggle — cùng 1 nút, đổi text theo trạng thái
  const authBtn = document.getElementById('btn-auth');
  if (authBtn) {
    const key = isSignedIn ? 'nav.logout' : 'nav.login';
    authBtn.dataset.i18n = key;
    authBtn.textContent = t(key);
    authBtn.dataset.authState = isSignedIn ? 'in' : 'out';
    authBtn.classList.toggle('btn--logout', isSignedIn);
  }

  document.documentElement.dataset.adminMode = isAdmin ? 'on' : 'off';
}

/* ───────────────────────── Modal ───────────────────────── */

export function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.classList.add('modal--open');
  document.body.style.overflow = 'hidden';
  const first = modalEl.querySelector('input, textarea, select, button');
  first?.focus();
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.classList.remove('modal--open');
  document.body.style.overflow = '';
}

/* ───────────────────────── Form helpers ───────────────────────── */

export function highlightErrors(form, errors = {}) {
  if (!form) return;
  form.querySelectorAll('.field--error').forEach(el => el.classList.remove('field--error'));
  form.querySelectorAll('.field__error').forEach(el => el.textContent = '');
  for (const [field, msg] of Object.entries(errors)) {
    const input = form.querySelector(`[name="${field}"]`);
    if (!input) continue;
    const wrap = input.closest('.field') || input.parentElement;
    wrap?.classList.add('field--error');
    const errSlot = wrap?.querySelector('.field__error');
    if (errSlot) errSlot.textContent = msg;
  }
}

export function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('.field--error').forEach(el => el.classList.remove('field--error'));
  form.querySelectorAll('.field__error').forEach(el => el.textContent = '');
}

/* ───────────────────────── Lightbox ───────────────────────── */

let _lightboxEl = null;
let _lightboxState = { images: [], idx: 0 };

function _ensureLightbox() {
  if (_lightboxEl && document.body.contains(_lightboxEl)) return _lightboxEl;

  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <button class="lightbox__close" data-lb-close type="button" aria-label="Close">${ICONS.close}</button>
    <button class="lightbox__nav lightbox__nav--prev" data-lb-prev type="button" aria-label="Prev">${ICONS.chevL}</button>
    <button class="lightbox__nav lightbox__nav--next" data-lb-next type="button" aria-label="Next">${ICONS.chevR}</button>

    <figure class="lightbox__stage">
      <img class="lightbox__img" alt="" />
      <figcaption class="lightbox__counter"></figcaption>
    </figure>

    <div class="lightbox__thumbs" data-lb-thumbs></div>
  `;
  document.body.appendChild(el);

  // Events
  el.addEventListener('click', (e) => {
    if (e.target === el) closeLightbox();
    if (e.target.closest('[data-lb-close]')) closeLightbox();
    if (e.target.closest('[data-lb-prev]'))  lightboxPrev();
    if (e.target.closest('[data-lb-next]'))  lightboxNext();
    const thumb = e.target.closest('[data-lb-thumb]');
    if (thumb) _lightboxGoto(Number(thumb.dataset.lbThumb));
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (el.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') { closeLightbox(); }
    else if (e.key === 'ArrowLeft')  { lightboxPrev(); }
    else if (e.key === 'ArrowRight') { lightboxNext(); }
  });

  _lightboxEl = el;
  return el;
}

export function openLightbox(images, startIndex = 0) {
  if (!images || images.length === 0) return;
  const el = _ensureLightbox();
  _lightboxState.images = images.slice();
  _lightboxState.idx = Math.max(0, Math.min(startIndex, images.length - 1));
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('lightbox--open');
  document.body.style.overflow = 'hidden';
  _lightboxRender();
}

export function closeLightbox() {
  if (!_lightboxEl) return;
  _lightboxEl.setAttribute('aria-hidden', 'true');
  _lightboxEl.classList.remove('lightbox--open');
  document.body.style.overflow = '';
}

function lightboxNext() { _lightboxGoto(_lightboxState.idx + 1); }
function lightboxPrev() { _lightboxGoto(_lightboxState.idx - 1); }

function _lightboxGoto(i) {
  const n = _lightboxState.images.length;
  if (n === 0) return;
  _lightboxState.idx = ((i % n) + n) % n;
  _lightboxRender();
}

function _lightboxRender() {
  if (!_lightboxEl) return;
  const { images, idx } = _lightboxState;
  const img = _lightboxEl.querySelector('.lightbox__img');
  const counter = _lightboxEl.querySelector('.lightbox__counter');
  const thumbs = _lightboxEl.querySelector('[data-lb-thumbs]');
  const prev = _lightboxEl.querySelector('[data-lb-prev]');
  const next = _lightboxEl.querySelector('[data-lb-next]');

  img.src = images[idx];
  img.alt = `Image ${idx + 1} / ${images.length}`;
  counter.textContent = t('lightbox.counter', { i: idx + 1, n: images.length });

  // Hide prev/next if only 1 image
  const single = images.length <= 1;
  prev.hidden = single;
  next.hidden = single;

  // Thumbnails
  if (single) {
    thumbs.innerHTML = '';
    thumbs.hidden = true;
  } else {
    thumbs.hidden = false;
    thumbs.innerHTML = images.map((src, i) => `
      <button class="lightbox__thumb ${i === idx ? 'is-active' : ''}"
              data-lb-thumb="${i}" type="button" aria-label="Photo ${i + 1}">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" />
      </button>
    `).join('');
  }
}

/* ───────────────────────── Detail modal (Facebook-post-style) ───────────────────────── */

/**
 * renderDetail — vẽ nội dung chi tiết 1 tin đăng vào container.
 *
 * Hiển thị kiểu 1 bài post Facebook:
 *   - Ảnh (carousel có thể mở lightbox)
 *   - Tiêu đề, địa điểm, diện tích, giá
 *   - Mô tả đầy đủ (preserve line break)
 *   - Thông số phụ (pháp lý, PN, WC)
 *   - Hành động: Gọi · Zalo · Lưu tin ⭐
 *   - Khu vực bình luận (danh sách + form)
 *
 * @param {HTMLElement} container - thường là #detail-modal-body
 * @param {object} item - listing full
 * @param {object} ctx - { phoneTel, phoneDisplay, zaloHref, isAdmin,
 *                         isFavorite, isFeatured, comments, onImageClick }
 */
export function renderDetail(container, item, ctx = {}) {
  if (!container || !item) return;

  const titleLocal = pickLocalized({ vi: item.title, en: item.title_en, zh: item.title_zh });
  const descLocal  = pickLocalized({ vi: item.description, en: item.description_en, zh: item.description_zh });
  const title      = escapeHtml(titleLocal || '');
  const desc       = descLocal || '';
  const location   = escapeHtml(item.location || '');
  const area       = escapeHtml(translateArea(item.area || ''));
  const priceLabel = escapeHtml(item.priceLabel || (item.priceValue ? formatPriceLabel(item.priceValue) : t('spec.contact')));
  const propType   = escapeHtml(propertyLabel(item.propertyType));
  const legal      = legalLabel(item.legalStatus);
  const areaSqm    = Number(item.areaSqm) || 0;
  const bedrooms   = Number(item.bedrooms) || 0;
  const bathrooms  = Number(item.bathrooms) || 0;

  const images = Array.isArray(item.images) && item.images.length
                   ? item.images
                   : (item.image ? [item.image] : []);
  const cover  = images[0] || PLACEHOLDER_IMG;

  const {
    phoneTel = '+84901181881',
    phoneDisplay = '0901 181 881',
    zaloHref = 'https://zalo.me/0909326188',
    isAdmin = false,
    isFavorite = false,
    isFeatured = !!item.featured,
    comments = [],
  } = ctx;

  const starOn = isAdmin ? isFeatured : isFavorite;
  const starLabel = isAdmin
    ? (starOn ? t('card.unfeature') : t('card.feature'))
    : (starOn ? t('card.unfavorite') : t('card.favorite'));

  // Ảnh bìa + thumbnails
  const coverSafe = escapeHtml(cover);
  const gallery = images.length > 1
    ? `<div class="detail__thumbs">${images.map((src, i) => `
        <button class="detail__thumb" type="button" data-detail-thumb="${i}" aria-label="Photo ${i + 1}">
          <img src="${escapeHtml(src)}" alt="" loading="lazy" />
        </button>
      `).join('')}</div>`
    : '';

  container.innerHTML = `
    <article class="detail__post">

      <div class="detail__hero" data-detail-img="0" role="button" tabindex="0" aria-label="${escapeHtml(t('lightbox.open_image'))}">
        <img src="${coverSafe}" alt="${title}" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'" />
        ${images.length > 1 ? `<span class="detail__img-count">${ICONS.images}<span>${images.length}</span></span>` : ''}
        ${isFeatured ? `<span class="detail__featured">${ICONS.starFilled}<span>${escapeHtml(t('card.featured_badge'))}</span></span>` : ''}
      </div>
      ${gallery}

      <header class="detail__header">
        <h3 class="detail__title">${title}</h3>
        <p class="detail__loc">${ICONS.pin}<span>${location}${area ? ` · <em>${area}</em>` : ''}</span></p>
      </header>

      <!-- Các mục chính: Diện tích · Giá · Loại BĐS -->
      <dl class="detail__keyvals">
        ${areaSqm ? `
          <div><dt>${escapeHtml(t('form.area_sqm'))}</dt><dd>${areaSqm} ${escapeHtml(t('spec.sqm'))}</dd></div>
        ` : ''}
        <div><dt>${escapeHtml(t('form.price'))}</dt><dd class="detail__price">${priceLabel}</dd></div>
        <div><dt>${escapeHtml(t('form.property'))}</dt><dd>${propType}</dd></div>
        ${legal ? `<div><dt>${escapeHtml(t('form.legal'))}</dt><dd>${escapeHtml(legal)}</dd></div>` : ''}
        ${bedrooms ? `<div><dt>${escapeHtml(t('form.bedrooms'))}</dt><dd>${bedrooms}</dd></div>` : ''}
        ${bathrooms ? `<div><dt>${escapeHtml(t('form.bathrooms'))}</dt><dd>${bathrooms}</dd></div>` : ''}
      </dl>

      ${desc ? `<section class="detail__desc">${_escapeAndBreak(desc)}</section>` : ''}

      <div class="detail__actions">
        <a class="btn btn--primary" href="tel:${escapeHtml(phoneTel)}">
          ${ICONS.phone}<span>${escapeHtml(phoneDisplay)}</span>
        </a>
        <button class="btn btn--ghost detail__star ${starOn ? 'is-on' : ''}"
                type="button" data-detail-star
                aria-pressed="${starOn ? 'true' : 'false'}">
          ${starOn ? ICONS.starFilled : ICONS.starOutline}
          <span>${escapeHtml(starLabel)}</span>
        </button>
      </div>

      <!-- Bình luận -->
      <section class="detail__comments">
        <h4 class="detail__comments-title">${ICONS.comment}<span>${escapeHtml(t('comments.title'))}</span> <em class="detail__comments-count" data-comments-count>${comments.length}</em></h4>

        <div class="detail__comments-list" data-comments-list>
          ${comments.length
            ? comments.map(_commentHTML).join('')
            : `<p class="detail__comments-empty">${escapeHtml(t('comments.empty'))}</p>`}
        </div>

        <form class="detail__comment-form" data-comment-form autocomplete="off" novalidate>
          <!-- Honeypot: ẩn với user thật, bot điền vào sẽ bị reject -->
          <input type="text" name="website" tabindex="-1" autocomplete="off"
                 class="hp-trap" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;" />
          <div class="detail__comment-row">
            <input type="text" name="name" maxlength="80" required
                   placeholder="${escapeHtml(t('comments.name_ph'))}" class="detail__comment-name" />
          </div>
          <div class="detail__comment-row">
            <textarea name="message" rows="2" maxlength="500" required
                      placeholder="${escapeHtml(t('comments.message_ph'))}" class="detail__comment-text"></textarea>
            <button type="submit" class="icon-btn detail__comment-send" aria-label="${escapeHtml(t('comments.send'))}" title="${escapeHtml(t('comments.send'))}">
              ${ICONS.send}
            </button>
          </div>
          <p class="detail__comment-hint">${escapeHtml(t('comments.hint'))}</p>
        </form>
      </section>

    </article>
  `;
}

/** renderDetailComments — re-render list comments thôi (dùng sau khi thêm). */
export function renderDetailComments(container, comments = []) {
  if (!container) return;
  const listEl = container.querySelector('[data-comments-list]');
  const countEl = container.querySelector('[data-comments-count]');
  if (countEl) countEl.textContent = String(comments.length);
  if (!listEl) return;
  listEl.innerHTML = comments.length
    ? comments.map(_commentHTML).join('')
    : `<p class="detail__comments-empty">${escapeHtml(t('comments.empty'))}</p>`;
}

function _commentHTML(c) {
  const name    = escapeHtml(c.name || t('comments.anonymous'));
  const message = _escapeAndBreak(c.message || '');
  const when    = c.createdAt ? _relativeTime(c.createdAt) : '';
  const initial = escapeHtml((c.name || '?').trim().charAt(0).toUpperCase() || '?');
  const adminDeleteBtn = `
      <button class="comment__delete" type="button"
              data-comment-delete data-comment-id="${escapeHtml(c.id || '')}"
              data-admin-only hidden
              aria-label="${escapeHtml(t('comments.delete'))}"
              title="${escapeHtml(t('comments.delete'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>`;
  return `
    <div class="comment" data-comment-id="${escapeHtml(c.id || '')}">
      <div class="comment__avatar" aria-hidden="true">${initial}</div>
      <div class="comment__body">
        <div class="comment__head">
          <strong class="comment__name">${name}</strong>
          ${when ? `<span class="comment__time">${escapeHtml(when)}</span>` : ''}
          ${adminDeleteBtn}
        </div>
        <div class="comment__msg">${message}</div>
      </div>
    </div>
  `;
}

function _relativeTime(ms) {
  const now = Date.now();
  const diff = Math.max(0, now - ms);
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)       return sec + 's';
  const min = Math.floor(sec / 60);
  if (min < 60)       return min + 'p';
  const hr  = Math.floor(min / 60);
  if (hr < 24)        return hr + 'h';
  const d   = Math.floor(hr / 24);
  if (d < 7)          return d + 'd';
  // fallback → date
  try { return new Date(ms).toLocaleDateString(); } catch { return ''; }
}

// Escape HTML + giữ nguyên xuống dòng (kiểu Facebook post)
function _escapeAndBreak(raw) {
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

/* ───────────────────────── Re-render cards on lang change ───────────────────────── */

// Listen to language changes; consumers decide when/how to re-render.
// For safety we fire applyI18n-equivalent via CustomEvent so app.js can re-render cards.
onLangChange(() => {
  document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: getLang() } }));
});
