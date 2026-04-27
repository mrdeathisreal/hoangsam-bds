/**
 * validator.js
 * ----------------------------------------------------------------------------
 * Pure input validation for hoangsam.bds listings.
 *
 * Triết lý:
 *   - KHÔNG đụng DOM, KHÔNG đụng Firestore — chỉ nhận data, trả verdict.
 *   - Trả về `{ valid, errors, data }` thay vì throw.
 *     + `errors`: map field -> message (i18n VI, dễ đổi sau).
 *     + `data`: bản đã sanitize (trim, cast, fill default) — dùng để ghi DB.
 *   - Tất cả rules gom trong `RULES` để đổi giới hạn không phải sửa logic.
 *
 * Contract: validateListing(input) -> { valid, errors, data }
 * ----------------------------------------------------------------------------
 */

import { parsePrice, generateSlug } from './utils.js';

/* ───────────────────────── Rules ───────────────────────── */

export const RULES = {
  title:        { min: 5,   max: 120 },
  titleTrans:   { max: 160 },   // bản dịch có thể dài hơn 1 chút
  location:     { min: 3,   max: 200 },
  description:  { min: 0,   max: 2000 },
  descTrans:    { max: 2200 },  // bản dịch tiếng Anh thường dài hơn
  priceValue:   { min: 0,   max: 1_000_000_000_000 }, // ≤ 1000 tỷ VND
  bedrooms:     { min: 0,   max: 50 },
  bathrooms:    { min: 0,   max: 50 },
  areaSqm:      { min: 1,   max: 100_000 },            // m²
  imageUrl:     { maxLengthHttp: 2048, maxLengthData: 320_000 },   // 2KB cho URL, ~240KB binary cho data URL
  imagesTotal:  { maxBytes: 900_000 },                              // < 1 MiB limit của Firestore
  slug:         { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }
};

export const ALLOWED_AREAS = [
  'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8',
  'Quận 10', 'Quận 11', 'Quận 12', 'Bình Tân', 'Bình Thạnh', 'Gò Vấp',
  'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức', 'Bình Chánh',
  'Hóc Môn', 'Nhà Bè', 'Củ Chi', 'Cần Giờ', 'Khác'
];

export const ALLOWED_PROPERTY_TYPES = [
  'nha-pho', 'can-ho', 'biet-thu', 'dat-nen', 'shophouse', 'kho-xuong', 'khac'
];

export const ALLOWED_LEGAL_STATUS = [
  'so-hong', 'so-do', 'hop-dong-mua-ban', 'giay-tay', 'dang-cho', 'khac'
];

/** Hiện trạng listing — admin set để thay thế star trên card. */
export const ALLOWED_LISTING_STATUS = [
  'new', 'deposit', 'sold', 'repair', 'renting'
];

/* ───────────────────────── Primitive helpers ───────────────────────── */

const isString = (v) => typeof v === 'string';
const isNumber = (v) => typeof v === 'number' && !Number.isNaN(v);

const trim = (v) => (isString(v) ? v.trim() : v);

/**
 * Loại ký tự zero-width, control char, và các khoảng trắng nhân tạo.
 * KHÔNG strip HTML — XSS escape do layer render lo (escapeHtml trong utils).
 */
function sanitizeText(v) {
  if (!isString(v)) return '';
  return v
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidHttpUrl(v) {
  if (!isString(v) || v.length === 0) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ───────────────────────── Field validators ───────────────────────── */

function checkTitle(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) { errors.title = 'Tiêu đề không được để trống.'; return ''; }
  if (v.length < RULES.title.min) {
    errors.title = `Tiêu đề quá ngắn (tối thiểu ${RULES.title.min} ký tự).`;
  } else if (v.length > RULES.title.max) {
    errors.title = `Tiêu đề quá dài (tối đa ${RULES.title.max} ký tự).`;
  }
  return v;
}

function checkLocation(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) { errors.location = 'Địa chỉ không được để trống.'; return ''; }
  if (v.length < RULES.location.min) {
    errors.location = `Địa chỉ quá ngắn (tối thiểu ${RULES.location.min} ký tự).`;
  } else if (v.length > RULES.location.max) {
    errors.location = `Địa chỉ quá dài (tối đa ${RULES.location.max} ký tự).`;
  }
  return v;
}

function checkArea(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) return ''; // optional nhưng nếu có phải thuộc whitelist
  if (!ALLOWED_AREAS.includes(v)) {
    errors.area = `Khu vực không hợp lệ. Chọn trong danh sách được phép.`;
    return '';
  }
  return v;
}

function checkPropertyType(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) return 'nha-pho'; // default
  if (!ALLOWED_PROPERTY_TYPES.includes(v)) {
    errors.propertyType = 'Loại BĐS không hợp lệ.';
    return '';
  }
  return v;
}

function checkLegalStatus(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) return 'khac';
  if (!ALLOWED_LEGAL_STATUS.includes(v)) {
    errors.legalStatus = 'Pháp lý không hợp lệ.';
    return '';
  }
  return v;
}

function checkPrice(raw, errors) {
  // Chấp nhận cả number và string ("9,8 tỷ", "9.800.000.000", "9800000000")
  const parsed = parsePrice(raw);
  if (parsed.value == null) {
    errors.price = 'Giá không hợp lệ. Ví dụ: "9.8 tỷ", "980 triệu", "9800000000".';
    return { priceValue: null, priceLabel: '' };
  }
  if (parsed.value < RULES.priceValue.min || parsed.value > RULES.priceValue.max) {
    errors.price = `Giá phải trong khoảng ${RULES.priceValue.min.toLocaleString('vi-VN')} - ${RULES.priceValue.max.toLocaleString('vi-VN')} VND.`;
    return { priceValue: null, priceLabel: '' };
  }
  return {
    priceValue: parsed.value,
    priceLabel: parsed.label || (isString(raw) ? sanitizeText(raw) : String(parsed.value))
  };
}

function checkBedrooms(raw, errors) {
  if (raw === '' || raw == null) return 0;
  const n = Number(raw);
  if (!isNumber(n) || !Number.isInteger(n)) {
    errors.bedrooms = 'Số phòng ngủ phải là số nguyên.';
    return 0;
  }
  if (n < RULES.bedrooms.min || n > RULES.bedrooms.max) {
    errors.bedrooms = `Số phòng ngủ phải từ ${RULES.bedrooms.min} đến ${RULES.bedrooms.max}.`;
    return 0;
  }
  return n;
}

function checkBathrooms(raw, errors) {
  if (raw === '' || raw == null) return 0;
  const n = Number(raw);
  if (!isNumber(n) || !Number.isInteger(n)) {
    errors.bathrooms = 'Số phòng tắm phải là số nguyên.';
    return 0;
  }
  if (n < RULES.bathrooms.min || n > RULES.bathrooms.max) {
    errors.bathrooms = `Số phòng tắm phải từ ${RULES.bathrooms.min} đến ${RULES.bathrooms.max}.`;
    return 0;
  }
  return n;
}

function checkAreaSqm(raw, errors) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  if (!isNumber(n)) {
    errors.areaSqm = 'Diện tích phải là số.';
    return null;
  }
  if (n < RULES.areaSqm.min || n > RULES.areaSqm.max) {
    errors.areaSqm = `Diện tích phải từ ${RULES.areaSqm.min} đến ${RULES.areaSqm.max} m².`;
    return null;
  }
  return n;
}

function checkImage(raw, errors) {
  const v = sanitizeText(raw);
  if (!v) return ''; // optional — render layer sẽ fallback placeholder
  const isData = v.startsWith('data:image/');
  const maxLen = isData ? RULES.imageUrl.maxLengthData : RULES.imageUrl.maxLengthHttp;
  if (v.length > maxLen) {
    errors.image = isData
      ? `Ảnh quá lớn sau khi nén. Thử ảnh nhỏ hơn.`
      : `URL ảnh quá dài (tối đa ${maxLen} ký tự).`;
    return '';
  }
  // Cho phép cả Firebase Storage URL (https) lẫn data:image (base64 sau khi compress)
  if (!isData && !isValidHttpUrl(v)) {
    errors.image = 'URL ảnh không hợp lệ (phải là http(s) hoặc data:image).';
    return '';
  }
  return v;
}

/**
 * checkImages — nhận chuỗi nhiều dòng (textarea) HOẶC array, trả array URL hợp lệ.
 * Max 5 ảnh. Bỏ qua dòng trống. Invalid URL → lỗi.
 */
function checkImages(raw, errors) {
  if (raw == null || raw === '') return [];
  let lines;
  if (Array.isArray(raw)) {
    lines = raw;
  } else if (typeof raw === 'string') {
    lines = raw.split(/\r?\n/);
  } else {
    return [];
  }

  const out = [];
  let totalBytes = 0;
  for (const line of lines) {
    const v = sanitizeText(line);
    if (!v) continue;
    const isData = v.startsWith('data:image/');
    const maxLen = isData ? RULES.imageUrl.maxLengthData : RULES.imageUrl.maxLengthHttp;
    if (v.length > maxLen) {
      errors.images = isData
        ? `Một ảnh quá lớn sau khi nén — thử chọn ảnh nhỏ hơn.`
        : `URL ảnh quá dài (tối đa ${maxLen} ký tự).`;
      continue;
    }
    if (!isData && !isValidHttpUrl(v)) {
      errors.images = 'Có URL ảnh không hợp lệ. Mỗi dòng 1 URL (http/https).';
      continue;
    }
    totalBytes += v.length;
    if (totalBytes > RULES.imagesTotal.maxBytes) {
      errors.images = `Tổng dung lượng ảnh vượt ~${Math.round(RULES.imagesTotal.maxBytes / 1024)}KB. Bớt lại vài ảnh hoặc nén ảnh nhỏ hơn.`;
      break;
    }
    out.push(v);
    if (out.length >= 10) break; // Hard cap: 10 ảnh / tin (v6)
  }
  return out;
}

function checkDescription(raw, errors) {
  const v = sanitizeText(raw);
  if (v.length > RULES.description.max) {
    errors.description = `Mô tả quá dài (tối đa ${RULES.description.max} ký tự).`;
    return v.slice(0, RULES.description.max);
  }
  return v;
}

/**
 * checkTitleTrans — bản dịch tiêu đề (optional). Nếu quá dài → clip & cảnh báo.
 * Không bắt buộc min-length, để admin có thể để trống.
 */
function checkTitleTrans(raw, fieldName, errors) {
  const v = sanitizeText(raw);
  if (!v) return '';
  if (v.length > RULES.titleTrans.max) {
    errors[fieldName] = `Bản dịch quá dài (tối đa ${RULES.titleTrans.max} ký tự).`;
    return v.slice(0, RULES.titleTrans.max);
  }
  return v;
}

/**
 * checkDescTrans — bản dịch mô tả (optional).
 * Không phải văn bản bắt buộc — cho phép để trống.
 */
function checkDescTrans(raw, fieldName, errors) {
  const v = sanitizeText(raw);
  if (!v) return '';
  if (v.length > RULES.descTrans.max) {
    errors[fieldName] = `Bản dịch quá dài (tối đa ${RULES.descTrans.max} ký tự).`;
    return v.slice(0, RULES.descTrans.max);
  }
  return v;
}

function checkCoordinates(raw, errors) {
  if (!raw || typeof raw !== 'object') return null;
  const { lat, lng } = raw;
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!isNumber(latN) || !isNumber(lngN)) return null; // optional
  if (latN < -90 || latN > 90) {
    errors.coordinates = 'Vĩ độ (lat) phải từ -90 đến 90.';
    return null;
  }
  if (lngN < -180 || lngN > 180) {
    errors.coordinates = 'Kinh độ (lng) phải từ -180 đến 180.';
    return null;
  }
  return { lat: latN, lng: lngN };
}

function checkFeatures(raw, errors) {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map(sanitizeText)
    .filter(Boolean)
    .slice(0, 20); // chặn spam
  if (cleaned.some(f => f.length > 80)) {
    errors.features = 'Mỗi tiện ích không quá 80 ký tự.';
  }
  return cleaned;
}

/* ───────────────────────── Main API ───────────────────────── */

/**
 * validateListing — check + sanitize một listing.
 *
 * @param {object} input - Raw data từ form.
 * @returns {{ valid: boolean, errors: Record<string,string>, data: object }}
 *
 * `data` chỉ đáng tin cậy khi `valid === true`. Khi invalid, `data` chứa
 * bản partial đã sanitize (để re-fill form, không mất dữ liệu user đã gõ).
 */
export function validateListing(input = {}) {
  const errors = {};

  const title         = checkTitle(input.title, errors);
  const location      = checkLocation(input.location, errors);
  const area          = checkArea(input.area, errors);
  const propertyType  = checkPropertyType(input.propertyType, errors);
  const legalStatus   = checkLegalStatus(input.legalStatus, errors);
  const { priceValue, priceLabel } = checkPrice(input.price ?? input.priceValue, errors);
  const bedrooms      = checkBedrooms(input.bedrooms, errors);
  const bathrooms     = checkBathrooms(input.bathrooms, errors);
  const areaSqm       = checkAreaSqm(input.areaSqm, errors);
  const image         = checkImage(input.image ?? input.imageUrl, errors);
  const images        = checkImages(input.images, errors);
  const description   = checkDescription(input.description, errors);
  // Bản dịch tuỳ chọn — khách nước ngoài cần để hiểu sản phẩm
  const title_en      = checkTitleTrans(input.title_en,      'title_en',      errors);
  const title_zh      = checkTitleTrans(input.title_zh,      'title_zh',      errors);
  const description_en = checkDescTrans(input.description_en, 'description_en', errors);
  const description_zh = checkDescTrans(input.description_zh, 'description_zh', errors);
  const coordinates   = checkCoordinates(input.coordinates, errors);
  const features      = checkFeatures(input.features, errors);

  // Slug sinh từ title — KHÔNG cho user tự gõ để tránh collision / XSS via URL
  const slug = title ? generateSlug(title) : '';
  if (slug && !RULES.slug.pattern.test(slug)) {
    errors.slug = 'Slug sinh ra không hợp lệ. Kiểm tra lại tiêu đề.';
  }

  // Required fields — luôn có
  const data = {
    title,
    slug,
    location,
    propertyType,
    legalStatus,
    priceValue,
    priceLabel,
    bedrooms,
    bathrooms,
    features,
  };

  // Optional fields — CHỈ thêm khi có giá trị thật.
  // Gửi null/'' lên Firestore sẽ fail rule "d.X is number/map/..." vì null không
  // match type check. Rule cho phép "không có field" — nên bỏ qua luôn là sạch nhất.
  if (area)             data.area        = area;
  // Nếu user nhập nhiều ảnh: ảnh đầu làm cover (image), cả mảng lưu vào images.
  // Nếu chỉ có single image (legacy): vẫn lưu thành images [image].
  if (images.length > 0) {
    data.image  = images[0];
    data.images = images;
  } else if (image) {
    data.image  = image;
    data.images = [image];
  }
  if (description)      data.description = description;
  if (title_en)         data.title_en        = title_en;
  if (title_zh)         data.title_zh        = title_zh;
  if (description_en)   data.description_en  = description_en;
  if (description_zh)   data.description_zh  = description_zh;
  if (areaSqm != null)  data.areaSqm     = areaSqm;
  if (coordinates)      data.coordinates = coordinates;
  // Hiện trạng listing (thay thế star khi set)
  if (typeof input.status === 'string' && ALLOWED_LISTING_STATUS.includes(input.status.trim())) {
    data.status = input.status.trim();
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

/**
 * validatePatch — dùng cho update partial (inline edit).
 * Chỉ validate các field có trong `patch`, không bắt buộc toàn bộ.
 */
export function validatePatch(patch = {}) {
  const errors = {};
  const data = {};

  if ('title' in patch)        data.title        = checkTitle(patch.title, errors);
  if ('location' in patch)     data.location     = checkLocation(patch.location, errors);
  if ('propertyType' in patch) data.propertyType = checkPropertyType(patch.propertyType, errors);
  if ('legalStatus' in patch)  data.legalStatus  = checkLegalStatus(patch.legalStatus, errors);
  if ('bedrooms' in patch)     data.bedrooms     = checkBedrooms(patch.bedrooms, errors);
  if ('bathrooms' in patch)    data.bathrooms    = checkBathrooms(patch.bathrooms, errors);
  if ('features' in patch)     data.features     = checkFeatures(patch.features, errors);
  if ('status' in patch) {
    const v = (patch.status || '').toString().trim();
    if (v === '' || ALLOWED_LISTING_STATUS.includes(v)) {
      // '' = xoá status (admin bỏ chọn)
      data.status = v === '' ? null : v;
    } else {
      errors.status = 'Hiện trạng không hợp lệ.';
    }
  }

  // Optional fields — chỉ đưa vào patch khi có giá trị hợp lệ (tránh ghi null)
  if ('area' in patch) {
    const v = checkArea(patch.area, errors);
    if (v) data.area = v;
  }
  if ('areaSqm' in patch) {
    const v = checkAreaSqm(patch.areaSqm, errors);
    if (v != null) data.areaSqm = v;
  }
  if ('image' in patch) {
    const v = checkImage(patch.image, errors);
    if (v) data.image = v;
  }
  if ('images' in patch) {
    const v = checkImages(patch.images, errors);
    if (v.length > 0) {
      data.images = v;
      data.image  = v[0]; // giữ cover đồng bộ
    }
  }
  if ('description' in patch) {
    const v = checkDescription(patch.description, errors);
    if (v) data.description = v;
  }
  // Bản dịch: patch-in nếu có, để trống xoá field cũ? → ta chỉ ghi khi có value,
  // nếu admin muốn xoá bản dịch phải dùng delete API (chưa cần thiết).
  if ('title_en' in patch) {
    const v = checkTitleTrans(patch.title_en, 'title_en', errors);
    if (v) data.title_en = v;
  }
  if ('title_zh' in patch) {
    const v = checkTitleTrans(patch.title_zh, 'title_zh', errors);
    if (v) data.title_zh = v;
  }
  if ('description_en' in patch) {
    const v = checkDescTrans(patch.description_en, 'description_en', errors);
    if (v) data.description_en = v;
  }
  if ('description_zh' in patch) {
    const v = checkDescTrans(patch.description_zh, 'description_zh', errors);
    if (v) data.description_zh = v;
  }
  if ('coordinates' in patch) {
    const v = checkCoordinates(patch.coordinates, errors);
    if (v) data.coordinates = v;
  }

  if ('price' in patch || 'priceValue' in patch) {
    const { priceValue, priceLabel } = checkPrice(patch.price ?? patch.priceValue, errors);
    data.priceValue = priceValue;
    data.priceLabel = priceLabel;
  }

  // Featured: boolean flag cho admin bật "Nổi bật" — không cần sanitize phức tạp
  if ('featured' in patch) {
    data.featured = !!patch.featured;
  }

  // Nếu title đổi → slug phải đổi theo
  if ('title' in patch && data.title) {
    data.slug = generateSlug(data.title);
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

/**
 * validateFilter — check input của filter form (area, price range, query).
 * Không reject — chỉ sanitize + clamp.
 */
export function validateFilter(input = {}) {
  const query = sanitizeText(input.query).toLowerCase().slice(0, 100);
  const area  = ALLOWED_AREAS.includes(input.area) ? input.area : '';

  // Giữ null cho "không filter". Chỉ convert sang number khi có giá trị thật.
  // Trước đây dùng Number(null) → 0 → filter "price <= 0" → loại hết tin.
  let priceMin = null;
  let priceMax = null;

  if (input.priceMin != null && input.priceMin !== '') {
    const n = Number(input.priceMin);
    if (Number.isFinite(n) && n >= 0) priceMin = n;
  }
  if (input.priceMax != null && input.priceMax !== '') {
    const n = Number(input.priceMax);
    if (Number.isFinite(n) && n >= 0) priceMax = n;
  }

  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  return { query, area, priceMin, priceMax };
}
