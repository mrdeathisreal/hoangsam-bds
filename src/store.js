/**
 * store.js
 * ----------------------------------------------------------------------------
 * Tầng truy cập dữ liệu cho hoangsam.bds.
 *
 * Nguyên tắc thiết kế:
 *   1. Single source of truth: mọi listener UI subscribe qua `subscribe()`,
 *      không ai tự gọi onSnapshot ngoài module này → tránh memory leak.
 *   2. Cache trong-memory (`_cache`): khi filter ở client, chỉ lọc lại
 *      mảng đã có, không gọi lại Firestore → 0 đọc extra.
 *   3. Lỗi luôn được map sang message Việt hoá trước khi ném ra UI.
 *   4. `serverTimestamp()` có pendingWrite window (giá trị null trước khi
 *      server confirm) → bù bằng `_clientTime` để sort/hiển thị mượt.
 *   5. KHÔNG động DOM ở đây — UI layer tự render từ data store gửi lên.
 * ----------------------------------------------------------------------------
 */

import { db } from './firebase-config.js';
import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { validateListing, validatePatch, validateFilter } from './validator.js';
import { normalizeVN } from './utils.js';

/* ───────────────────────── Module state ───────────────────────── */

const COLLECTION = 'houses';
const housesRef  = collection(db, COLLECTION);

/** Cache listings mới nhất từ snapshot. Subscribers nhận reference này. */
let _cache = [];

/** Subscribers đăng ký qua subscribe(). */
const _subs = new Set();

/** Unsub function của onSnapshot hiện tại — để có thể teardown. */
let _unsub = null;

/** Đã init chưa (tránh double-subscribe Firestore). */
let _initialized = false;

/* ───────────────────────── Error mapping ───────────────────────── */

/**
 * Map Firestore error code → message VI người dùng đọc được.
 * Giữ cả raw code để debug.
 */
function mapError(err) {
  const code = err?.code || 'unknown';
  const table = {
    'permission-denied':    'Bạn không có quyền thực hiện thao tác này.',
    'unauthenticated':      'Vui lòng đăng nhập admin trước khi chỉnh sửa.',
    'unavailable':          'Mất kết nối Firestore. Đang thử lại...',
    'deadline-exceeded':    'Server phản hồi chậm. Vui lòng thử lại.',
    'resource-exhausted':   'Đã vượt hạn mức Firestore. Liên hệ admin.',
    'not-found':            'Không tìm thấy bản ghi. Có thể đã bị xoá.',
    'already-exists':       'Bản ghi đã tồn tại.',
    'failed-precondition':  'Thao tác không hợp lệ với trạng thái hiện tại.',
    'cancelled':            'Thao tác đã bị huỷ.',
    'invalid-argument':     'Dữ liệu gửi lên không hợp lệ.',
  };
  const message = table[code] || 'Lỗi không xác định. Xem console để biết chi tiết.';
  return { code, message, raw: err };
}

/* ───────────────────────── Cache fan-out ───────────────────────── */

function _notify(event) {
  for (const sub of _subs) {
    try { sub(event); }
    catch (e) { console.error('[store] subscriber threw:', e); }
  }
}

/* ───────────────────────── Public API ───────────────────────── */

/**
 * initStore — bắt đầu subscribe Firestore realtime. Gọi một lần từ app.js.
 *
 * @param {object} [opts]
 * @param {(err: {code, message, raw}) => void} [opts.onError] - callback lỗi
 * @returns {() => void} unsubscribe function (gọi khi tắt app / logout)
 */
export function initStore(opts = {}) {
  if (_initialized) {
    console.warn('[store] already initialized — ignoring duplicate init');
    return _unsub || (() => {});
  }

  _initialized = true;

  // Báo loading để UI vẽ skeleton
  _notify({ type: 'loading' });

  const q = query(housesRef, orderBy('updatedAt', 'desc'));

  _unsub = onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        items.push({
          id: docSnap.id,
          // Fill default để UI không crash khi doc thiếu field
          title:        data.title        || '',
          slug:         data.slug         || '',
          location:     data.location     || '',
          area:         data.area         || '',
          propertyType: data.propertyType || 'nha-pho',
          legalStatus:  data.legalStatus  || 'khac',
          priceValue:   typeof data.priceValue === 'number' ? data.priceValue : null,
          priceLabel:   data.priceLabel   || '',
          bedrooms:     data.bedrooms     || 0,
          bathrooms:    data.bathrooms    || 0,
          areaSqm:      data.areaSqm      || null,
          image:        data.image        || '',
          images:       Array.isArray(data.images) && data.images.length
                          ? data.images
                          : (data.image ? [data.image] : []),
          description:  data.description  || '',
          // Bản dịch đa ngôn ngữ — optional, rỗng nếu admin chưa nhập
          title_en:        data.title_en        || '',
          title_zh:        data.title_zh        || '',
          description_en:  data.description_en  || '',
          description_zh:  data.description_zh  || '',
          coordinates:  data.coordinates  || null,
          features:     Array.isArray(data.features) ? data.features : [],
          featured:     !!data.featured,
          status:       typeof data.status === 'string' ? data.status : null,
          // Timestamp có thể null trong pending write — fallback local time
          createdAt:    data.createdAt?.toMillis?.() ?? data._clientTime ?? Date.now(),
          updatedAt:    data.updatedAt?.toMillis?.() ?? data._clientTime ?? Date.now(),
        });
      });

      _cache = items;
      _notify({ type: 'data', items, fromCache: snapshot.metadata.fromCache });
    },
    (err) => {
      console.error('[store] onSnapshot error:', err);
      const mapped = mapError(err);
      _notify({ type: 'error', ...mapped });
      opts.onError?.(mapped);
    }
  );

  return () => {
    try { _unsub?.(); } catch {}
    _unsub = null;
    _initialized = false;
    _cache = [];
    _subs.clear();
  };
}

/**
 * subscribe — đăng ký nhận cập nhật từ store.
 *
 * Event shapes:
 *   { type: 'loading' }
 *   { type: 'data',  items: Listing[], fromCache: boolean }
 *   { type: 'error', code, message, raw }
 *
 * @param {(event) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  _subs.add(fn);
  // Phát lại snapshot gần nhất cho subscriber mới — khỏi chờ thêm 1 round
  if (_cache.length > 0) {
    fn({ type: 'data', items: _cache, fromCache: true });
  }
  return () => _subs.delete(fn);
}

/** getAll — snapshot hiện tại (synchronous, không chạm Firestore). */
export function getAll() {
  return _cache.slice();
}

/** Alias dễ đọc từ AI UI. */
export function getAllListings() {
  return _cache.slice();
}

/**
 * addAppointment — lưu lịch hẹn do khách đặt qua chat/web.
 * Collection: appointments/{autoId}. Không yêu cầu auth — ai vào web đều tạo được.
 */
export async function addAppointment(payload) {
  try {
    const { addDoc, collection, serverTimestamp } = await import(
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
    );
    const ref = collection(db, 'appointments');
    const doc = await addDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      status: 'pending',
    });
    return { id: doc.id };
  } catch (e) {
    console.warn('[store] addAppointment failed:', e);
    throw e;
  }
}

/**
 * addInquiry — lưu tin nhắn tư vấn của khách (không cần auth).
 * Collection: inquiries/{autoId}
 */
export async function addInquiry(payload) {
  try {
    const { addDoc, collection, serverTimestamp } = await import(
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
    );
    const ref = collection(db, 'inquiries');
    const docRef = await addDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      status: 'new',
    });
    return { id: docRef.id };
  } catch (e) {
    console.warn('[store] addInquiry failed:', e);
    throw e;
  }
}

/** getById — tìm listing trong cache. */
export function getById(id) {
  return _cache.find(x => x.id === id) || null;
}

/* ───────────────────────── Mutations ───────────────────────── */

/**
 * addListing — thêm listing mới.
 * @param {object} input - raw form data
 * @returns {Promise<{id: string}>}
 * @throws {{code, message, raw}} nếu validate fail hoặc Firestore lỗi.
 */
export async function addListing(input) {
  const { valid, errors, data } = validateListing(input);
  if (!valid) {
    console.warn('[store] addListing validation failed:', errors);
    throw { code: 'invalid-argument', message: _firstErrorMsg(errors), errors, raw: null };
  }

  try {
    const now = Date.now();
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      _clientTime: now, // fallback hiển thị trong window pending write
    };
    console.log('[store] addListing payload keys:', Object.keys(payload));
    const ref = await addDoc(housesRef, payload);
    return { id: ref.id };
  } catch (err) {
    console.error('[store] addListing Firestore error:', err?.code, err?.message, err);
    throw mapError(err);
  }
}

/**
 * updateListing — patch một vài field. Dùng cho inline edit.
 * @param {string} id
 * @param {object} patch - chỉ field cần đổi
 */
export async function updateListing(id, patch) {
  if (!id) throw { code: 'invalid-argument', message: 'Thiếu ID bản ghi.' };

  const { valid, errors, data } = validatePatch(patch);
  if (!valid) {
    console.warn('[store] updateListing validation failed:', errors);
    throw { code: 'invalid-argument', message: _firstErrorMsg(errors), errors };
  }

  try {
    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
      _clientTime: Date.now(),
    };
    console.log('[store] updateListing', id, 'payload keys:', Object.keys(payload));
    await updateDoc(doc(db, COLLECTION, id), payload);
  } catch (err) {
    console.error('[store] updateListing Firestore error:', err?.code, err?.message, err);
    throw mapError(err);
  }
}

/**
 * deleteListing — xoá một listing.
 * @param {string} id
 */
export async function deleteListing(id) {
  if (!id) throw { code: 'invalid-argument', message: 'Thiếu ID bản ghi.' };
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * setFeatured — admin bật/tắt "nổi bật" cho 1 tin đăng.
 * Chỉ admin mới có quyền ghi (Firestore rules).
 *
 * @param {string} id
 * @param {boolean} value
 */
export async function setFeatured(id, value) {
  if (!id) throw { code: 'invalid-argument', message: 'Thiếu ID bản ghi.' };
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      featured: !!value,
      updatedAt: serverTimestamp(),
      _clientTime: Date.now(),
    });
  } catch (err) {
    throw mapError(err);
  }
}

/* ───────────────────────── Comments subcollection ───────────────────────── */

/**
 * fetchComments — đọc tất cả comments của 1 listing, sắp theo thời gian mới nhất.
 * Không subscribe realtime để tiết kiệm read quota — chỉ load khi mở modal.
 *
 * @param {string} listingId
 * @returns {Promise<Array<{id, name, message, createdAt}>>}
 */
export async function fetchComments(listingId) {
  if (!listingId) return [];
  try {
    const ref = collection(db, COLLECTION, listingId, 'comments');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const out = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      out.push({
        id: d.id,
        name: x.name || '',
        message: x.message || '',
        createdAt: x.createdAt?.toMillis?.() ?? Date.now(),
      });
    });
    return out;
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * addComment — bất kỳ ai (kể cả khách chưa đăng nhập) cũng có thể bình luận.
 * Firestore rules sẽ giới hạn độ dài name/message để tránh spam.
 *
 * @param {string} listingId
 * @param {{name: string, message: string}} input
 */
export async function addComment(listingId, input) {
  if (!listingId) throw { code: 'invalid-argument', message: 'Thiếu ID tin đăng.' };
  const name = String(input.name || '').trim().slice(0, 80);
  const message = String(input.message || '').trim().slice(0, 500);
  if (!name)    throw { code: 'invalid-argument', message: 'Vui lòng nhập tên.' };
  if (!message) throw { code: 'invalid-argument', message: 'Vui lòng nhập nội dung bình luận.' };

  try {
    const ref = collection(db, COLLECTION, listingId, 'comments');
    const docRef = await addDoc(ref, {
      name,
      message,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, name, message, createdAt: Date.now() };
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * deleteComment — admin xoá 1 bình luận của khách.
 * Firestore rules đảm bảo chỉ admin mới có quyền delete.
 */
export async function deleteComment(listingId, commentId) {
  if (!listingId || !commentId) throw { code: 'invalid-argument', message: 'Thiếu ID.' };
  try {
    await deleteDoc(doc(db, COLLECTION, listingId, 'comments', commentId));
    return true;
  } catch (err) {
    throw mapError(err);
  }
}

/* ───────────────────────── Client-side filter ───────────────────────── */

/**
 * filterListings — lọc/sắp xếp mảng listings ở client.
 *
 * Vì sao filter client-side?
 *   Firestore chỉ cho phép 1 range filter per query. Muốn lọc
 *   area + priceMin + priceMax + query text trong cùng 1 query là không
 *   khả thi nếu không tạo đống composite indexes. Với 10-20 listings,
 *   lọc trong JS chỉ tốn < 1ms và tiết kiệm read quota.
 *
 * @param {Listing[]} listings
 * @param {object} rawFilter - { query, area, priceMin, priceMax, sortBy }
 * @returns {Listing[]}
 */
export function filterListings(listings, rawFilter = {}) {
  const { query, area, priceMin, priceMax } = validateFilter(rawFilter);
  const sortBy = rawFilter.sortBy || 'updatedAt-desc';

  let out = listings;

  // 1. Full-text search (normalize bỏ dấu tiếng Việt, index cả bản dịch)
  if (query) {
    const needle = normalizeVN(query);
    out = out.filter(x => {
      const haystack = normalizeVN([
        x.title, x.title_en, x.title_zh,
        x.location, x.area,
        x.description, x.description_en, x.description_zh,
      ].filter(Boolean).join(' '));
      return haystack.includes(needle);
    });
  }

  // 2. Lọc theo khu vực
  if (area) {
    out = out.filter(x => x.area === area);
  }

  // 3. Lọc theo range giá (dựa vào priceValue number, không phải string)
  if (priceMin != null) {
    out = out.filter(x => typeof x.priceValue === 'number' && x.priceValue >= priceMin);
  }
  if (priceMax != null) {
    out = out.filter(x => typeof x.priceValue === 'number' && x.priceValue <= priceMax);
  }

  // 4. Sort
  const [field, dir] = sortBy.split('-');
  const mul = dir === 'asc' ? 1 : -1;
  out = out.slice().sort((a, b) => {
    const av = a[field] ?? 0;
    const bv = b[field] ?? 0;
    if (av < bv) return -1 * mul;
    if (av > bv) return  1 * mul;
    return 0;
  });

  return out;
}

/* ───────────────────────── Internal ───────────────────────── */

function _firstErrorMsg(errors) {
  const first = Object.values(errors)[0];
  return first || 'Dữ liệu không hợp lệ.';
}
