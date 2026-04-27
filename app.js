/**
 * app.js — Entry point & Controller (FIX9)
 * ----------------------------------------------------------------------------
 * Thay đổi FIX9 so với FIX8:
 *   - Image picker: báo rõ per-file error, chặn vượt ~900KB từ sớm, target
 *     compression 150KB để vừa được 5-6 ảnh / 1 tin.
 *   - Submit form: log lỗi ra console + toast kèm tên field bị lỗi để admin
 *     biết chính xác vì sao "Đăng tin" không thành công.
 *   - Robust DOM refs: nếu listingForm null sẽ log cảnh báo rõ ràng.
 * ----------------------------------------------------------------------------
 */

import { initStore, subscribe as subscribeStore,
         addListing, updateListing, deleteListing,
         filterListings, getById,
         setFeatured, fetchComments, addComment, deleteComment } from './src/store.js';
import { initAuth, subscribe as subscribeAuth,
         signIn, signOut, isAdmin } from './src/auth.js';
import { renderCards, renderSkeleton, renderEmpty, renderError,
         toast, updateAdminUI,
         openModal, closeModal,
         highlightErrors, clearFormErrors,
         openLightbox, closeLightbox, ICONS,
         renderDetail, renderDetailComments } from './src/ui-render.js';
import { debounce, parsePrice, formatPriceLabel, compressImage, formatBytes } from './src/utils.js';
import { seedSampleData } from './src/seed.js';
import { initI18n, setLang, getLang, onLangChange, t } from './src/i18n.js';
import { initAiUi } from './src/ai-ui.js';

/* ───────────────────────── Phone numbers ───────────────────────── */

const PHONES = {
  VN: { display: '0901 181 881', tel: '+84901181881', flag: '🇻🇳' },
  TW: { display: '0971 718 343', tel: '+886971718343', flag: '🇹🇼' },
};

/* ───────────────────────── App state ───────────────────────── */

const state = {
  listings: [],
  filter: { query: '', area: '', sortBy: null },
  editingId: null,
  isReady: false,
  phoneRegion: 'VN',
  // Tin yêu thích của khách — lưu localStorage, key = listing.id
  favorites: _loadFavorites(),
  // ID tin đang mở trong detail modal (để re-render được khi store cập nhật)
  detailOpenId: null,
};

/* ───────────────────────── Favorites (localStorage) ───────────────────────── */

const FAV_KEY = 'hoangsam_bds_favorites';

function _loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function _saveFavorites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites]));
  } catch (err) {
    console.warn('[favorites] save failed:', err);
  }
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    _saveFavorites();
    return false;
  }
  state.favorites.add(id);
  _saveFavorites();
  return true;
}

/* ───────────────────────── DOM refs ───────────────────────── */

const $ = (sel) => document.querySelector(sel);

const el = {
  grid:          $('#listings-grid'),
  searchInput:   $('#filter-search'),
  areaSelect:    $('#filter-area'),
  resetBtn:      $('#filter-reset'),
  countLabel:    $('#listings-count'),

  addBtn:        $('#btn-add'),
  authBtn:       $('#btn-auth'),
  callBtn:       $('#btn-call'),

  brand:         $('#brand'),
  langSwitch:    $('#lang-switch'),

  listingModal:  $('#listing-modal'),
  listingForm:   $('#listing-form'),
  modalTitle:    $('#listing-modal-title'),
  modalClose:    $('#listing-modal-close'),
  modalCancel:   $('#listing-modal-cancel'),
  modalSubmit:   $('#listing-modal-submit'),

  imageFile:     $('#image-file'),
  imagePickBtn:  $('#btn-pick-images'),
  imageClearBtn: $('#btn-clear-images'),
  imageStatus:   $('#image-picker-status'),

  previewModal:  $('#preview-modal'),
  previewGrid:   $('#preview-grid'),
  previewSummary:$('#preview-summary'),
  previewApply:  $('#preview-apply'),
  previewCancel: $('#preview-cancel'),
  previewClose:  $('#preview-close'),

  loginModal:    $('#login-modal'),
  loginForm:     $('#login-form'),
  loginClose:    $('#login-modal-close'),

  // Detail modal — mở khi bấm card (Facebook-post style)
  detailModal:   $('#detail-modal'),
  detailBody:    $('#detail-modal-body'),
  detailClose:   $('#detail-modal-close'),
};

/* ───────────────────────── Bootstrap ───────────────────────── */

function main() {
  if (!el.grid) {
    console.error('[app] #listings-grid not found');
    return;
  }

  // i18n trước tiên để text render đúng ngôn ngữ người dùng
  initI18n();
  _renderLangSwitch();

  subscribeStore(onStoreEvent);
  initStore({ onError: (err) => toast(err.message, 'error', 5000) });

  subscribeAuth(onAuthChange);
  initAuth();

  wireFilterEvents();
  wireAdminEvents();
  wireModalEvents();
  wireListingFormEvents();
  wireLoginFormEvents();
  wireKeyboardShortcuts();
  wireBrandHash();
  wireLangEvents();
  wireImagePicker();
  wireDetailModal();

  // AI agents team (7 Gemini-powered staff)
  initAiUi();

  // Geo detect → set nút gọi
  detectCallRegion();

  // Re-render cards khi đổi lang (labels property/legal có trong card)
  document.addEventListener('i18n:changed', () => {
    if (state.isReady) renderCurrentView();
  });
}

/* ───────────────────────── Store ───────────────────────── */

function onStoreEvent(event) {
  switch (event.type) {
    case 'loading':
      renderSkeleton(el.grid, 6);
      updateCountLabel(t('listings.loading'));
      break;
    case 'data':
      state.listings = event.items;
      state.isReady = true;
      renderCurrentView();
      // Nếu detail modal đang mở và tin đó vừa đổi (vd admin toggle featured
      // từ tab khác, hoặc update title) → cập nhật nút star + badge.
      if (state.detailOpenId) {
        refreshDetailModal(state.detailOpenId, { reloadComments: false });
      }
      break;
    case 'error':
      renderError(el.grid, event.message);
      updateCountLabel(t('empty.err_title'));
      break;
  }
}

/* ───────────────────────── Auth ───────────────────────── */

function onAuthChange(authState) {
  updateAdminUI(authState);
  if (state.isReady) renderCurrentView();
  // Detail modal: admin/khách có ngữ nghĩa ngôi sao khác nhau → reload toàn bộ
  if (state.detailOpenId) {
    refreshDetailModal(state.detailOpenId, { reloadComments: true });
  }
}

/* ───────────────────────── Render ───────────────────────── */

function renderCurrentView() {
  const filtered = filterListings(state.listings, state.filter);

  if (filtered.length === 0) {
    _renderEmptyFor();
  } else {
    renderCards(el.grid, filtered, {
      isAdmin:      isAdmin(),
      favorites:    state.favorites,
      onEdit:       handleEditClick,
      onDelete:     handleDeleteClick,
      onImageClick: handleImageClick,
      onCardClick:  handleCardClick,
      onStarClick:  handleStarClick,
    });
  }

  updateCountLabel(
    filtered.length === state.listings.length
      ? t('listings.count', { n: filtered.length })
      : t('listings.count_filtered', { n: filtered.length, total: state.listings.length })
  );
}

function _renderEmptyFor() {
  const f = state.filter;
  const hasFilters = !!(f.query || f.area);

  if (state.listings.length === 0 && isAdmin()) {
    renderEmpty(el.grid, {
      title: t('empty.admin_title'),
      message: t('empty.admin_msg'),
      actionLabel: t('empty.seed'),
      onAction: handleSeedClick,
    });
  } else if (hasFilters) {
    renderEmpty(el.grid, {
      title: t('empty.nomatch_title'),
      message: t('empty.nomatch_msg'),
      actionLabel: t('empty.clear_filter'),
      onAction: () => el.resetBtn?.click(),
    });
  } else {
    renderEmpty(el.grid);
  }
}

async function handleSeedClick() {
  if (!isAdmin()) return;
  if (!confirm(t('empty.admin_msg'))) return;

  toast(t('toast.seeding'), 'info', 2000);
  try {
    const results = await seedSampleData();
    if (results.failed === 0) {
      toast(t('toast.seed_ok', { n: results.success }), 'success');
    } else {
      toast(`${results.success} OK / ${results.failed} err`, 'info', 5000);
    }
  } catch (err) {
    toast(err.message || t('toast.generic_err'), 'error');
  }
}

function updateCountLabel(text) {
  if (el.countLabel) el.countLabel.textContent = text;
}

/* ───────────────────────── Filter ───────────────────────── */

function wireFilterEvents() {
  const debouncedSearch = debounce((value) => {
    state.filter.query = value;
    renderCurrentView();
  }, 250);

  el.searchInput?.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  el.areaSelect?.addEventListener('change', (e) => {
    state.filter.area = e.target.value;
    renderCurrentView();
  });

  el.resetBtn?.addEventListener('click', () => {
    state.filter = { query: '', area: '', sortBy: null };
    if (el.searchInput) el.searchInput.value = '';
    if (el.areaSelect)  el.areaSelect.value = '';
    renderCurrentView();
  });
}

/* ───────────────────────── Admin actions ───────────────────────── */

function wireAdminEvents() {
  // Bấm "Thêm tin": nếu chưa admin → mở login modal; đã login → mở form thêm tin.
  el.addBtn?.addEventListener('click', () => {
    if (!isAdmin()) {
      _openLoginModal();
      return;
    }
    openListingModal(null);
  });

  // 1 nút duy nhất: signed-out → mở login · signed-in → đăng xuất
  el.authBtn?.addEventListener('click', async () => {
    if (isAdmin()) {
      if (!confirm(t('toast.logout_confirm'))) return;
      try {
        await signOut();
        toast(t('toast.logout'), 'info');
      } catch (err) {
        toast(err.message || t('toast.generic_err'), 'error');
      }
    } else {
      _openLoginModal();
    }
  });
}

function _openLoginModal() {
  el.loginForm?.reset();
  clearFormErrors(el.loginForm);
  openModal(el.loginModal);
}

function handleEditClick(id) {
  if (!isAdmin()) return;
  openListingModal(id);
}

async function handleDeleteClick(id) {
  if (!isAdmin()) return;
  const item = getById(id);
  const title = item?.title || '—';
  if (!confirm(t('toast.delete_confirm', { title }))) return;

  try {
    await deleteListing(id);
    toast(t('toast.deleted'), 'success');
  } catch (err) {
    toast(err.message || t('toast.generic_err'), 'error');
  }
}

/** handleImageClick — bấm ảnh trên card → mở lightbox luôn. */
function handleImageClick(id) {
  const item = getById(id);
  if (!item) return;
  const images = Array.isArray(item.images) && item.images.length
                   ? item.images
                   : (item.image ? [item.image] : []);
  if (images.length === 0) return;
  openLightbox(images, 0);
}

/**
 * handleCardClick — bấm vào thân card → mở detail modal kiểu FB post.
 * (Bấm riêng vào ảnh vẫn mở lightbox cho trải nghiệm nhanh.)
 */
function handleCardClick(id) {
  openDetailModal(id);
}

/**
 * handleStarClick — toggle "favorite" (khách) hoặc "featured" (admin).
 *   - Khách: lưu vào localStorage (favorites), re-render để cập nhật UI.
 *   - Admin: ghi `featured` vào Firestore; snapshot listener sẽ tự re-render.
 */
async function handleStarClick(id) {
  if (!id) return;

  if (isAdmin()) {
    const item = getById(id);
    if (!item) return;
    const next = !item.featured;
    try {
      await setFeatured(id, next);
      toast(next ? t('toast.feat_on') : t('toast.feat_off'), 'success');
    } catch (err) {
      toast(err.message || t('toast.generic_err'), 'error');
    }
    return;
  }

  // Khách — lưu/bỏ favorite
  const nowOn = toggleFavorite(id);
  toast(nowOn ? t('toast.fav_added') : t('toast.fav_removed'), 'info', 1800);
  renderCurrentView();
  // Nếu detail modal đang mở cho tin này, cập nhật nút sao bên trong
  if (state.detailOpenId === id) {
    await refreshDetailModal(id, { reloadComments: false });
  }
}

/* ───────────────────────── Detail modal (Facebook-post style) ───────────────────────── */

/**
 * openDetailModal — hiển thị chi tiết 1 tin đăng + bình luận.
 * Khách bấm card → mở modal này (không phải lightbox nữa).
 */
async function openDetailModal(id) {
  const item = getById(id);
  if (!item) { toast(t('toast.generic_err'), 'error'); return; }

  state.detailOpenId = id;

  // Render sườn trước với comments = [] để khách thấy modal mở ngay
  _renderDetailFor(item, []);
  openModal(el.detailModal);

  // Load comments bất đồng bộ
  try {
    const comments = await fetchComments(id);
    // Nếu trong thời gian đợi, khách đã đóng / mở tin khác → bỏ qua kết quả cũ
    if (state.detailOpenId !== id) return;
    renderDetailComments(el.detailBody, comments);
  } catch (err) {
    console.warn('[detail] fetchComments failed:', err);
  }
}

function _renderDetailFor(item, comments = []) {
  if (!item || !el.detailBody) return;

  const p = PHONES[state.phoneRegion] || PHONES.VN;
  // Zalo: dùng số VN cho link wa-style; TW thì vẫn mở chat VN (Marshall chung 1 tài khoản)
  const zaloHref = 'https://zalo.me/' + PHONES.VN.tel.replace('+', '');

  renderDetail(el.detailBody, item, {
    phoneTel:     p.tel,
    phoneDisplay: p.display,
    zaloHref,
    isAdmin:      isAdmin(),
    isFavorite:   state.favorites.has(item.id),
    isFeatured:   !!item.featured,
    comments,
  });
}

/**
 * refreshDetailModal — vẽ lại nội dung detail modal khi store/favorites đổi.
 * Nếu reloadComments=true, gọi lại fetchComments; false giữ số hiện có.
 */
async function refreshDetailModal(id, { reloadComments = false } = {}) {
  if (state.detailOpenId !== id) return;
  const item = getById(id);
  if (!item) return;

  // Lấy list comment hiện đang hiển thị trong DOM để giữ nguyên
  let existingCount = 0;
  const countEl = el.detailBody?.querySelector('[data-comments-count]');
  if (countEl) existingCount = Number(countEl.textContent) || 0;

  // Vẽ lại toàn bộ; phải reload comments nếu được yêu cầu
  if (reloadComments) {
    let comments = [];
    try { comments = await fetchComments(id); } catch {}
    _renderDetailFor(item, comments);
  } else {
    // Không reload → render lại hero/actions nhưng sẽ mất DOM comments.
    // Giải pháp: chỉ cập nhật nút star + badge featured bằng class swap,
    // tránh blow-away toàn bộ panel.
    _updateDetailStarUI(item);
    _updateDetailFeaturedUI(item);
    // Giữ nguyên số lượng comment
    if (countEl) countEl.textContent = String(existingCount);
  }
}

function _updateDetailStarUI(item) {
  const btn = el.detailBody?.querySelector('[data-detail-star]');
  if (!btn) return;
  const on = isAdmin() ? !!item.featured : state.favorites.has(item.id);
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const starSvg = on ? ICONS.starFilled : ICONS.starOutline;
  const label = isAdmin()
    ? (on ? t('card.unfeature') : t('card.feature'))
    : (on ? t('card.unfavorite') : t('card.favorite'));
  btn.innerHTML = `${starSvg}<span>${label}</span>`;
}

function _updateDetailFeaturedUI(item) {
  const hero = el.detailBody?.querySelector('.detail__hero');
  if (!hero) return;
  const existing = hero.querySelector('.detail__featured');
  if (item.featured && !existing) {
    const span = document.createElement('span');
    span.className = 'detail__featured';
    span.innerHTML = `${ICONS.starFilled}<span>${t('card.featured_badge')}</span>`;
    hero.appendChild(span);
  } else if (!item.featured && existing) {
    existing.remove();
  }
}

function wireDetailModal() {
  if (!el.detailModal || !el.detailBody) return;

  // Nút đóng
  el.detailClose?.addEventListener('click', () => {
    closeModal(el.detailModal);
    state.detailOpenId = null;
  });

  // Click vào nền xám để đóng
  el.detailModal.addEventListener('click', (e) => {
    if (e.target === el.detailModal) {
      closeModal(el.detailModal);
      state.detailOpenId = null;
    }
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.detailModal.classList.contains('modal--open')) {
      closeModal(el.detailModal);
      state.detailOpenId = null;
    }
  });

  // Event delegation bên trong detailBody
  el.detailBody.addEventListener('click', (e) => {
    // Ảnh hero → mở lightbox từ index 0
    const heroEl = e.target.closest('[data-detail-img]');
    if (heroEl) {
      const id = state.detailOpenId;
      const item = id ? getById(id) : null;
      if (!item) return;
      const images = Array.isArray(item.images) && item.images.length
                       ? item.images
                       : (item.image ? [item.image] : []);
      if (images.length) openLightbox(images, Number(heroEl.dataset.detailImg) || 0);
      return;
    }

    // Thumbnail → mở lightbox tại index đó
    const thumbEl = e.target.closest('[data-detail-thumb]');
    if (thumbEl) {
      const id = state.detailOpenId;
      const item = id ? getById(id) : null;
      if (!item) return;
      const images = Array.isArray(item.images) && item.images.length
                       ? item.images
                       : (item.image ? [item.image] : []);
      if (images.length) openLightbox(images, Number(thumbEl.dataset.detailThumb) || 0);
      return;
    }

    // Nút ⭐ trong detail → reuse handler chung
    const starBtn = e.target.closest('[data-detail-star]');
    if (starBtn) {
      const id = state.detailOpenId;
      if (id) handleStarClick(id);
      return;
    }

    // Admin xoá bình luận
    const delBtn = e.target.closest('[data-comment-delete]');
    if (delBtn) {
      if (!isAdmin()) return;
      const commentId = delBtn.dataset.commentId;
      const listingId = state.detailOpenId;
      if (!commentId || !listingId) return;
      if (!confirm(t('comments.delete_confirm'))) return;
      (async () => {
        try {
          await deleteComment(listingId, commentId);
          // Remove từ DOM ngay
          delBtn.closest('.comment')?.remove();
          toast(t('comments.deleted'), 'success');
        } catch (err) {
          toast(err.message || t('toast.generic_err'), 'error');
        }
      })();
      return;
    }
  });

  // Submit form bình luận
  el.detailBody.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-comment-form]');
    if (!form) return;
    e.preventDefault();

    const id = state.detailOpenId;
    if (!id) return;

    const fd = new FormData(form);
    const name    = String(fd.get('name') || '').trim();
    const message = String(fd.get('message') || '').trim();
    const honeypot = String(fd.get('website') || '').trim();
    // Bot trap: nếu honeypot có giá trị → bot. Silent reject (không báo để bot ko biết).
    if (honeypot) {
      console.warn('[comment] honeypot triggered — silent reject');
      form.reset();
      return;
    }
    // Rate-limit: 1 comment / 60s / device
    if (!_rateLimitOk('hs_last_comment', 60_000)) {
      toast(t('comments.rate_limit'), 'warn');
      return;
    }
    // Anti-spam auto-ban: 5 lần trong 10 phút → lockout 30m, 10 lần / 24h → 24h
    const spamCheck = _antiSpam('comment');
    if (!spamCheck.ok) {
      toast(t('spam.too_many', { wait: _formatWait(spamCheck.wait) }), 'error');
      return;
    }
    if (!name || !message) {
      toast(t('comments.err'), 'error');
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await addComment(id, { name, message });
      _rateLimitMark('hs_last_comment');
      form.reset();
      toast(t('comments.sent'), 'success');
      // Reload comments để thấy tin mới (và server timestamp)
      const comments = await fetchComments(id);
      if (state.detailOpenId === id) {
        renderDetailComments(el.detailBody, comments);
      }
    } catch (err) {
      toast(err.message || t('comments.err'), 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/* ───────────────────────── Listing modal (add/edit) ───────────────────────── */

function openListingModal(id) {
  state.editingId = id;
  clearFormErrors(el.listingForm);
  el.listingForm?.reset();
  // Hard-reset picker state — prevents stale staged images / thumbnails /
  // disabled buttons carrying over from a previous modal session.
  resetImagePickerState({ alsoClearTextarea: false });

  if (id) {
    const item = getById(id);
    if (!item) { toast(t('toast.generic_err'), 'error'); return; }
    el.modalTitle.textContent = t('form.edit_title');
    el.modalSubmit.textContent = t('form.submit_update');
    _fillForm(el.listingForm, item);
  } else {
    el.modalTitle.textContent = t('form.add_title');
    el.modalSubmit.textContent = t('form.submit_add');
  }

  openModal(el.listingModal);
}

function _fillForm(form, item) {
  if (!form) return;
  const fields = [
    'title','location','area','propertyType','legalStatus',
    'bedrooms','bathrooms','areaSqm','description',
    // Bản dịch đa ngôn ngữ (optional)
    'title_en','title_zh','description_en','description_zh',
  ];
  for (const name of fields) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && item[name] != null) input.value = item[name];
  }
  // Nếu có bản dịch → tự mở collapsible group để admin nhìn thấy ngay
  const hasTranslations = !!(
    item.title_en || item.title_zh || item.description_en || item.description_zh
  );
  const details = form.querySelector('.i18n-group');
  if (details) details.open = hasTranslations;
  // Price dùng priceLabel cho user dễ đọc
  const priceInput = form.querySelector('[name="price"]');
  if (priceInput) priceInput.value = item.priceLabel || (item.priceValue ? formatPriceLabel(item.priceValue) : '');

  // Images: ưu tiên array, fallback single
  const imagesTA = form.querySelector('[name="images"]');
  if (imagesTA) {
    const imgs = Array.isArray(item.images) && item.images.length
                   ? item.images
                   : (item.image ? [item.image] : []);
    imagesTA.value = imgs.join('\n');
  }
}

function wireModalEvents() {
  [el.modalClose, el.modalCancel].forEach(btn =>
    btn?.addEventListener('click', () => closeModal(el.listingModal))
  );
  el.loginClose?.addEventListener('click', () => closeModal(el.loginModal));

  [el.listingModal, el.loginModal].forEach(m => {
    m?.addEventListener('click', (e) => {
      if (e.target === m) closeModal(m);
    });
  });
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (el.listingModal?.classList.contains('modal--open')) closeModal(el.listingModal);
      if (el.loginModal?.classList.contains('modal--open'))   closeModal(el.loginModal);
    }
  });
}

/* ───────────────────────── Listing form submit ───────────────────────── */

function wireListingFormEvents() {
  if (!el.listingForm) {
    console.error('[app] #listing-form not found — submit handler chưa gắn.');
    return;
  }

  // Nút auto-translate VI → EN + ZH
  document.getElementById('btn-auto-translate')?.addEventListener('click', handleAutoTranslate);

  el.listingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin()) { toast(t('toast.need_admin'), 'error'); return; }

    clearFormErrors(el.listingForm);
    _setSubmitLoading(true);

    const formData = new FormData(el.listingForm);
    const input = Object.fromEntries(formData.entries());

    // Coerce số: chỉ convert khi có giá trị NON-EMPTY, tránh "0" bị bỏ qua
    // bởi truthy check như ở FIX8.
    if (input.bedrooms  !== undefined && input.bedrooms  !== '') input.bedrooms  = Number(input.bedrooms);
    if (input.bathrooms !== undefined && input.bathrooms !== '') input.bathrooms = Number(input.bathrooms);
    if (input.areaSqm   !== undefined && input.areaSqm   !== '') input.areaSqm   = Number(input.areaSqm);
    // Keep input.images as newline string — validator handles split

    // AUTO-TRANSLATE: nếu admin chỉ nhập tiêu đề/mô tả tiếng Việt + 2 trường EN/ZH trống
    // → tự động dịch qua Gemini trước khi lưu (không chặn nếu dịch fail)
    const needTrans = input.title && (!input.title_en?.trim() || !input.title_zh?.trim());
    if (needTrans) {
      try {
        const { hasApiKey } = await import('./src/ai-client.js');
        if (hasApiKey()) {
          toast(t('form.auto_translating'), 'info', 3000);
          const { translateListingVi } = await import('./src/auto-translate.js');
          const tr = await translateListingVi({
            title: input.title,
            description: input.description || '',
          });
          if (!input.title_en?.trim())       input.title_en       = tr.title_en;
          if (!input.title_zh?.trim())       input.title_zh       = tr.title_zh;
          if (!input.description_en?.trim()) input.description_en = tr.description_en;
          if (!input.description_zh?.trim()) input.description_zh = tr.description_zh;
        }
      } catch (e) {
        console.warn('[auto-translate] skipped:', e?.message || e);
      }
    }

    try {
      if (state.editingId) {
        await updateListing(state.editingId, input);
        toast(t('toast.updated'), 'success');
      } else {
        await addListing(input);
        toast(t('toast.added'), 'success');
      }
      closeModal(el.listingModal);
      state.editingId = null;
      el.listingForm.reset();
      resetImagePickerState({ alsoClearTextarea: false });
    } catch (err) {
      // Log chi tiết ra console — mở DevTools (F12) → Console để coi stack trace
      console.error('[listing] submit failed:', err);

      if (err.errors && Object.keys(err.errors).length > 0) {
        highlightErrors(el.listingForm, err.errors);
        // Hiển thị field lỗi đầu tiên lên toast để admin biết sửa gì
        const firstField = Object.keys(err.errors)[0];
        const firstMsg = err.errors[firstField];
        toast(`${firstField}: ${firstMsg}`, 'error', 6000);
      } else {
        // Lỗi Firestore (permission-denied v.v.) — hiển thị message + code
        const msg = err.message || t('toast.generic_err');
        const code = err.code ? ` [${err.code}]` : '';
        toast(msg + code, 'error', 6000);
      }
    } finally {
      _setSubmitLoading(false);
    }
  });
}

function _setSubmitLoading(isLoading) {
  if (!el.modalSubmit) return;
  el.modalSubmit.disabled = isLoading;
  el.modalSubmit.classList.toggle('btn--loading', isLoading);
}

/* ───────────────────────── Login form ───────────────────────── */

function wireLoginFormEvents() {
  el.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(el.loginForm);

    const btn = el.loginForm.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.classList.add('btn--loading'); }

    const formData = new FormData(el.loginForm);
    try {
      await signIn(formData.get('email'), formData.get('password'));
      closeModal(el.loginModal);
      toast(t('toast.login_ok'), 'success');
      el.loginForm.reset();
      // Clear hash nếu có
      if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
    } catch (err) {
      toast(err.message || t('toast.generic_err'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('btn--loading'); }
    }
  });
}

/* ───────────────────────── Hash route for admin login ───────────────────────── */

function wireBrandHash() {
  // #admin → mở login modal
  const checkHash = () => {
    if (location.hash === '#admin' && !isAdmin()) {
      _openLoginModal();
    }
  };
  checkHash();
  window.addEventListener('hashchange', checkHash);

  // Triple-click on brand → mở login (UX backup)
  let clicks = 0;
  let timer = null;
  el.brand?.addEventListener('click', (e) => {
    if (isAdmin()) return;
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, 800);
    if (clicks >= 3) {
      e.preventDefault();
      clicks = 0;
      _openLoginModal();
    }
  });
}

/* ───────────────────────── Language switcher ───────────────────────── */

function _renderLangSwitch() {
  if (!el.langSwitch) return;
  const current = getLang();
  const langs = [
    { code: 'vi', label: 'VI' },
    { code: 'en', label: 'EN' },
    { code: 'zh', label: '繁中' },
  ];
  el.langSwitch.innerHTML = langs.map(l => `
    <button class="lang-btn ${l.code === current ? 'is-active' : ''}"
            data-lang="${l.code}" type="button">${l.label}</button>
  `).join('');
}

function wireLangEvents() {
  el.langSwitch?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    const lang = btn.dataset.lang;
    setLang(lang);
  });

  onLangChange(() => {
    _renderLangSwitch();
    // update dynamic UI text
    if (state.isReady) {
      // Force re-render to update listings count label + card labels
      renderCurrentView();
    }
  });
}

/* ───────────────────────── Image picker (upload + compress + preview) ───────────────────────── */

// Hard cap: 10 images / listing (business rule, updated v6).
const MAX_IMAGES_PER_LISTING = 10;
// Firestore doc cap ~ 1 MiB. 10 images × 85KB = 850KB leaves headroom for other fields.
// Compression ladder trong utils.js tự động xuống tầng cực thấp (240×240 × q=0.3)
// với ảnh 8K để luôn đạt target — không fail vì kích thước.
const MAX_TOTAL_IMAGE_BYTES = 900_000;
const PER_IMAGE_TARGET_BYTES = 85 * 1024;

// Staging area: compressed images waiting for user confirmation in the preview modal.
// Cleared any time the listing modal re-opens (see openListingModal → resetImagePickerState).
/** @type {Array<{dataUrl:string, bytes:number, name:string}>} */
let _stagedImages = [];
let _pickerBusy = false;

function wireImagePicker() {
  if (!el.imagePickBtn || !el.imageFile) {
    console.warn('[picker] #btn-pick-images or #image-file not found.');
    return;
  }

  el.imagePickBtn.addEventListener('click', () => {
    if (_pickerBusy) return;
    // Reset file input so re-picking same file still triggers change.
    el.imageFile.value = '';
    el.imageFile.click();
  });

  el.imageFile.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    console.log('[picker] received', files.length, 'file(s):',
      files.map(f => `${f.name}(${f.type},${f.size}B)`).join(', '));
    // Clear the input immediately so a 2nd attempt with same files still fires.
    el.imageFile.value = '';
    if (files.length === 0) return;
    await _handleImageFiles(files);
  });

  // Clear-all button — wipes everything: textarea, staged preview, status, file input.
  if (el.imageClearBtn) {
    el.imageClearBtn.addEventListener('click', () => {
      if (_pickerBusy) return;
      resetImagePickerState({ alsoClearTextarea: true });
      _setPickerStatus('All images cleared.', 'ok');
    });
  }

  // Preview modal wiring
  el.previewApply?.addEventListener('click', _applyStagedImages);
  el.previewCancel?.addEventListener('click', _cancelPreview);
  el.previewClose?.addEventListener('click', _cancelPreview);
  el.previewModal?.addEventListener('click', (e) => {
    if (e.target === el.previewModal) _cancelPreview();
  });
}

/**
 * resetImagePickerState — nuke ALL picker state. Called on modal open, after
 * successful submit, and when user hits "Clear all". Guarantees no stale bytes
 * or thumbnails carry over to the next upload.
 */
function resetImagePickerState({ alsoClearTextarea = false } = {}) {
  _stagedImages = [];
  _pickerBusy = false;
  if (el.imageFile) el.imageFile.value = '';
  if (el.imagePickBtn) el.imagePickBtn.disabled = false;
  if (el.imageClearBtn) el.imageClearBtn.disabled = false;
  if (el.previewGrid) el.previewGrid.innerHTML = '';
  if (el.previewSummary) el.previewSummary.textContent = '';
  if (el.previewModal?.classList.contains('modal--open')) {
    closeModal(el.previewModal);
  }
  if (alsoClearTextarea) {
    const ta = el.listingForm?.querySelector('[name="images"]');
    if (ta) ta.value = '';
  }
  _setPickerStatus('', null);
}

/**
 * _handleImageFiles — compress picked files and open preview modal.
 *
 * Contract:
 *   - Compress each file (always-fit ladder → guaranteed ≤ 150KB).
 *   - Exact-byte dedupe only (re-picking identical file in same batch is skipped).
 *     NO visual/perceptual dedupe — that was over-matching different photos.
 *   - Cap at 5. Further files beyond 5 are dropped with a console warning.
 *   - On success → open preview modal. The textarea is NOT touched until the
 *     user clicks "Apply" in the preview modal.
 *   - On total failure → status bar shows error, textarea untouched.
 */
async function _handleImageFiles(files) {
  const ta = el.listingForm?.querySelector('[name="images"]');
  if (!ta) {
    console.error('[picker] textarea [name="images"] not found.');
    _setPickerStatus('Error: images textarea not found.', 'error');
    return;
  }

  // 1. Filter to images by MIME
  const imageFiles = files.filter(f => f.type?.startsWith('image/'));
  if (imageFiles.length === 0) {
    _setPickerStatus('No valid image files selected.', 'error');
    return;
  }
  if (imageFiles.length < files.length) {
    console.warn('[picker] skipped', files.length - imageFiles.length, 'non-image file(s)');
  }

  // 2. Hard-cap 5 images
  const picked = imageFiles.slice(0, MAX_IMAGES_PER_LISTING);
  if (imageFiles.length > MAX_IMAGES_PER_LISTING) {
    console.warn(`[picker] only first ${MAX_IMAGES_PER_LISTING} images accepted, dropped ${imageFiles.length - MAX_IMAGES_PER_LISTING}.`);
  }

  _pickerBusy = true;
  el.imagePickBtn.disabled = true;
  if (el.imageClearBtn) el.imageClearBtn.disabled = true;

  /** @type {Array<{dataUrl:string, bytes:number, name:string}>} */
  const results = [];
  const failures = [];
  const seenUrls = new Set(); // exact-match dedupe only
  let totalBytes = 0;

  try {
    for (let i = 0; i < picked.length; i++) {
      _setPickerStatus(`Compressing ${i + 1}/${picked.length}...`, 'busy');

      let dataUrl, bytes;
      try {
        ({ dataUrl, bytes } = await compressImage(picked[i], {
          maxDim: 1600,
          quality: 0.82,
          targetBytes: PER_IMAGE_TARGET_BYTES,
        }));
      } catch (err) {
        console.warn('[picker] compression failed:', picked[i].name, err);
        failures.push({ name: picked[i].name, reason: err?.message || 'compression failed' });
        continue;
      }

      // Exact-match dedupe (same file re-picked in this batch)
      if (seenUrls.has(dataUrl)) {
        console.log(`[picker] ⊘ ${picked[i].name} — exact duplicate of earlier file, skipped`);
        continue;
      }
      seenUrls.add(dataUrl);

      if (totalBytes + dataUrl.length > MAX_TOTAL_IMAGE_BYTES) {
        failures.push({ name: picked[i].name, reason: 'total size cap reached' });
        console.warn('[picker] stop — total would exceed 900KB');
        break;
      }

      results.push({ dataUrl, bytes, name: picked[i].name });
      totalBytes += dataUrl.length;
      console.log(`[picker] ✓ ${picked[i].name} → ${formatBytes(bytes)}`);
    }
  } finally {
    _pickerBusy = false;
    el.imagePickBtn.disabled = false;
    if (el.imageClearBtn) el.imageClearBtn.disabled = false;
  }

  // 3. Total failure → keep textarea untouched
  if (results.length === 0) {
    const detail = failures.map(f => `${f.name}: ${f.reason}`).join('; ');
    _setPickerStatus(`Upload failed. ${detail || ''}`, 'error');
    return;
  }

  // 4. Stage results and open preview modal (textarea NOT touched yet)
  _stagedImages = results;
  _renderPreview(totalBytes, failures);
  openModal(el.previewModal);
  _setPickerStatus(`Ready to review ${results.length} image${results.length === 1 ? '' : 's'} (~${formatBytes(totalBytes)}).`, 'busy');
}

/**
 * _renderPreview — fill preview modal with thumbnails. Each has a ✕ button to
 * remove that image from the staged set before Apply.
 */
function _renderPreview(totalBytes, failures) {
  if (!el.previewGrid || !el.previewSummary) return;

  const skipMsg = failures.length ? ` · skipped ${failures.length} (see Console)` : '';
  el.previewSummary.textContent =
    `${_stagedImages.length} image${_stagedImages.length === 1 ? '' : 's'} ready (~${formatBytes(totalBytes)})${skipMsg}. ` +
    'Remove any you don\'t want, then click Apply.';

  el.previewGrid.innerHTML = _stagedImages.map((r, idx) => `
    <div class="preview-thumb" data-idx="${idx}" style="position:relative;border:1px solid #ddd;border-radius:8px;overflow:hidden;aspect-ratio:1;background:#f3f3f3">
      <img src="${r.dataUrl}" alt="${idx + 1}" style="width:100%;height:100%;object-fit:cover;display:block" />
      <button type="button" data-preview-remove="${idx}" title="Remove this image"
              style="position:absolute;top:6px;right:6px;width:26px;height:26px;border:none;border-radius:50%;background:rgba(0,0,0,0.75);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">&times;</button>
      <span style="position:absolute;bottom:4px;left:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 6px;border-radius:3px">${idx + 1} · ${formatBytes(r.bytes)}</span>
    </div>
  `).join('');

  // Wire remove buttons (delegated)
  el.previewGrid.querySelectorAll('[data-preview-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-preview-remove'));
      if (Number.isFinite(idx) && idx >= 0 && idx < _stagedImages.length) {
        _stagedImages.splice(idx, 1);
        if (_stagedImages.length === 0) {
          _cancelPreview();
          _setPickerStatus('No images left in preview — cancelled.', 'busy');
          return;
        }
        const newTotal = _stagedImages.reduce((s, r) => s + r.bytes, 0);
        _renderPreview(newTotal, []);
      }
    });
  });
}

function _applyStagedImages() {
  const ta = el.listingForm?.querySelector('[name="images"]');
  if (!ta) return;

  if (_stagedImages.length === 0) {
    _cancelPreview();
    return;
  }

  const previousCount = ta.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;

  // REPLACE — wipe old, install new
  ta.value = _stagedImages.map(r => r.dataUrl).join('\n');

  const total = _stagedImages.reduce((s, r) => s + r.bytes, 0);
  const parts = [
    `Applied ${_stagedImages.length} image${_stagedImages.length === 1 ? '' : 's'} (~${formatBytes(total)})`,
  ];
  if (previousCount > 0) {
    parts.push(`replaced ${previousCount} old image${previousCount === 1 ? '' : 's'}`);
  }
  _setPickerStatus(parts.join(' · '), 'ok');

  ta.scrollTop = ta.scrollHeight;
  _stagedImages = [];
  closeModal(el.previewModal);
}

function _cancelPreview() {
  _stagedImages = [];
  if (el.previewGrid) el.previewGrid.innerHTML = '';
  if (el.previewSummary) el.previewSummary.textContent = '';
  closeModal(el.previewModal);
  _setPickerStatus('Upload cancelled — existing images kept.', 'busy');
}

function _setPickerStatus(msg, kind) {
  if (!el.imageStatus) return;
  el.imageStatus.textContent = msg || '';
  el.imageStatus.className = 'image-picker__status'
    + (kind === 'busy' ? ' is-busy' : '')
    + (kind === 'error' ? ' is-error' : '');
}

/* ───────────────────────── Call button (geo detect) ───────────────────────── */

async function detectCallRegion() {
  // Cached in sessionStorage — tránh gọi API nhiều lần trong session
  let region = 'VN';
  try {
    const cached = sessionStorage.getItem('hs_region');
    if (cached && PHONES[cached]) {
      region = cached;
    } else {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j.country_code && PHONES[j.country_code]) region = j.country_code;
      }
      sessionStorage.setItem('hs_region', region);
    }
  } catch (err) {
    console.warn('[geo] detect failed, falling back to VN:', err);
  }
  state.phoneRegion = region;
  _renderCallBtn();
}

function _renderCallBtn() {
  if (!el.callBtn) return;
  const p = PHONES[state.phoneRegion] || PHONES.VN;
  const isTW = state.phoneRegion === 'TW';

  // TW: mask 4 SỐ cuối bằng CSS blur (pro hơn ••• / ***). VN: hiện full.
  let displayNumber;
  if (isTW) {
    displayNumber = _maskLastDigits(p.display, 4);
  } else {
    displayNumber = p.display;
  }
  const href = isTW
    ? 'https://line.me/ti/p/nM8GnauZ8I'   // TW dùng LINE phổ biến hơn Zalo
    : 'tel:' + p.tel;

  el.callBtn.href = href;
  if (isTW) {
    el.callBtn.target = '_blank';
    el.callBtn.rel = 'noopener noreferrer';
    el.callBtn.title = 'Please contact via LINE (preferred) — phone hidden to prevent international spam';
  } else {
    el.callBtn.removeAttribute('target');
    el.callBtn.removeAttribute('rel');
    el.callBtn.removeAttribute('title');
  }

  el.callBtn.innerHTML = `
    <span class="btn__icon">${ICONS.phone}</span>
    <span class="btn__label">
      <span class="btn__label-main">${displayNumber}</span>
    </span>
  `;
  el.callBtn.setAttribute('aria-label', t('nav.call') + ' ' + displayNumber);
}

/* ───────────────────────── Anti-spam helpers ───────────────────────── */

function _rateLimitOk(key, windowMs) {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    return (Date.now() - last) >= windowMs;
  } catch { return true; }
}
function _rateLimitMark(key) {
  try { localStorage.setItem(key, String(Date.now())); } catch {}
}

/**
 * Mask N số cuối của display phone bằng span.phone-masked (CSS blur).
 * VD: "0971 718 343" + n=4 → "0971 71<span class='phone-masked'>8 343</span>"
 */
function _maskLastDigits(display, n) {
  const positions = [];
  for (let i = 0; i < display.length; i++) if (/\d/.test(display[i])) positions.push(i);
  if (positions.length < n) return display;
  const startPos = positions[positions.length - n];
  return display.slice(0, startPos) +
    `<span class="phone-masked" aria-hidden="true">${display.slice(startPos)}</span>`;
}

/**
 * Anti-spam token bucket + auto-ban.
 * Key 'comment' hoặc 'apt'. Giới hạn: 5 attempts/10min + 10/24h → lockout 30m/24h.
 * Trả { ok: true } hoặc { ok: false, wait: msRemaining, reason }
 */
function _antiSpam(key) {
  const NOW = Date.now();
  const BUCKET_KEY = `hs_bucket_${key}`;
  const LOCKOUT_KEY = `hs_lockout_${key}`;
  try {
    // Check existing lockout
    const lockoutUntil = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
    if (lockoutUntil > NOW) {
      return { ok: false, wait: lockoutUntil - NOW, reason: 'LOCKED' };
    }
    // Load bucket — array of timestamps (recent attempts)
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(BUCKET_KEY) || '[]'); } catch {}
    if (!Array.isArray(arr)) arr = [];
    // Keep chỉ timestamps trong 24h
    arr = arr.filter(ts => NOW - ts < 24*60*60*1000);
    // Short window: 10 phút
    const last10min = arr.filter(ts => NOW - ts < 10*60*1000);
    // Thresholds
    if (last10min.length >= 5) {
      // 5 trong 10min → lockout 30 phút
      const lock = NOW + 30*60*1000;
      localStorage.setItem(LOCKOUT_KEY, String(lock));
      return { ok: false, wait: 30*60*1000, reason: 'BURST' };
    }
    if (arr.length >= 10) {
      // 10 trong 24h → lockout 24h
      const lock = NOW + 24*60*60*1000;
      localStorage.setItem(LOCKOUT_KEY, String(lock));
      return { ok: false, wait: 24*60*60*1000, reason: 'DAILY' };
    }
    // Cho phép. Mark attempt.
    arr.push(NOW);
    localStorage.setItem(BUCKET_KEY, JSON.stringify(arr));
    return { ok: true };
  } catch { return { ok: true }; } // Nếu localStorage lỗi (private mode) → cho qua
}

function _formatWait(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} phút`;
  const h = Math.ceil(m / 60);
  return `${h} giờ`;
}

/* ───────────────────────── Auto-translate handler ───────────────────────── */

async function handleAutoTranslate() {
  const form = el.listingForm;
  if (!form) return;
  const titleVi = form.elements['title']?.value?.trim() || '';
  const descVi  = form.elements['description']?.value?.trim() || '';
  const status = document.getElementById('auto-translate-status');
  const btn = document.getElementById('btn-auto-translate');

  if (!titleVi) {
    if (status) status.textContent = 'Nhập tiêu đề (VI) trước khi dịch.';
    return;
  }

  // Lazy import để không load auto-translate.js nếu admin không dùng
  const { translateListingVi } = await import('./src/auto-translate.js');

  if (btn) { btn.disabled = true; }
  if (status) status.textContent = 'Đang dịch, vui lòng đợi…';

  try {
    const out = await translateListingVi({ title: titleVi, description: descVi });
    form.elements['title_en'].value       = out.title_en;
    form.elements['title_zh'].value       = out.title_zh;
    form.elements['description_en'].value = out.description_en;
    form.elements['description_zh'].value = out.description_zh;
    // Tự mở phần dịch để admin xem kết quả
    const details = document.querySelector('.i18n-group');
    if (details) details.open = true;
    if (status) status.textContent = 'Đã dịch xong. Bạn có thể chỉnh lại trước khi lưu.';
  } catch (err) {
    console.error('[auto-translate]', err);
    const msg = (err?.message || '').includes('NO_API_KEY')
      ? 'Chưa có Gemini API key. Admin paste ở mục "Cài đặt API key" trong section đội ngũ tư vấn.'
      : 'Dịch thất bại: ' + (err?.message || 'unknown');
    if (status) status.textContent = msg;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ───────────────────────── Scroll reveal (client CTAs) ───────────────────────── */

function _initScrollReveal() {
  const targets = document.querySelectorAll('.client-actions .btn--xl');
  if (!targets.length || !('IntersectionObserver' in window)) {
    // Fallback: hiện luôn nếu browser cổ
    targets.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
  targets.forEach(el => io.observe(el));
}

/* ───────────────────────── Start ───────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { main(); _initScrollReveal(); });
} else {
  main();
  _initScrollReveal();
}
