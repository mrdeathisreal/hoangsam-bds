/**
 * utils.js — pure helpers, không phụ thuộc Firebase/DOM.
 */

/* ───────────────────────── Price parser ───────────────────────── */

/**
 * parsePrice — nhận chuỗi tiếng Việt hoặc number, trả VND.
 *
 * Chấp nhận:
 *   9800000000           → { value: 9800000000, label: "9.800.000.000 VND" }
 *   "9.800.000.000"      → như trên
 *   "9,8 tỷ"             → { value: 9800000000, label: "9,8 tỷ" }
 *   "980 triệu"          → { value: 980000000, label: "980 triệu" }
 *   "1.2 tỷ"             → { value: 1200000000, label: "1.2 tỷ" }
 *   ""                   → { value: null, label: "" }
 */
export function parsePrice(input) {
  if (input == null || input === '') return { value: null, label: '' };

  if (typeof input === 'number' && Number.isFinite(input)) {
    return { value: input, label: formatPriceLabel(input) };
  }

  if (typeof input !== 'string') return { value: null, label: '' };

  const s = input.trim().toLowerCase();
  const label = input.trim();

  // Đơn vị VN
  const tyMatch     = s.match(/^([\d.,]+)\s*(tỷ|ty|tỉ)/);
  const trieuMatch  = s.match(/^([\d.,]+)\s*(triệu|trieu|tr)/);
  const nghinMatch  = s.match(/^([\d.,]+)\s*(nghìn|nghin|ngàn|ngan|k)/);

  if (tyMatch) {
    const n = parseVNNumber(tyMatch[1]);
    if (n == null) return { value: null, label: '' };
    return { value: Math.round(n * 1_000_000_000), label };
  }
  if (trieuMatch) {
    const n = parseVNNumber(trieuMatch[1]);
    if (n == null) return { value: null, label: '' };
    return { value: Math.round(n * 1_000_000), label };
  }
  if (nghinMatch) {
    const n = parseVNNumber(nghinMatch[1]);
    if (n == null) return { value: null, label: '' };
    return { value: Math.round(n * 1_000), label };
  }

  // Số thuần (có thể có . , làm separator)
  const n = parseVNNumber(s);
  if (n == null) return { value: null, label: '' };
  return { value: Math.round(n), label: label || formatPriceLabel(n) };
}

/**
 * parseVNNumber — "9.800.000.000" / "9,8" / "1,200.50" → number
 *
 * Heuristic:
 *   - Nếu có cả "." và ",": cái nào xuất hiện SAU cùng là decimal separator.
 *   - Chỉ "." hoặc chỉ ",": nếu xuất hiện nhiều lần → thousands separator.
 *     Nếu xuất hiện 1 lần và phần sau có 1-2 chữ số → decimal, ngược lại thousands.
 */
function parseVNNumber(str) {
  if (typeof str !== 'string') return null;
  const s = str.replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  let normalized;
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // "," là decimal → bỏ "." thousands, đổi "," thành "."
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      // "." là decimal → bỏ ","
      normalized = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = s; // decimal
    } else {
      normalized = s.replace(/\./g, ''); // thousands
    }
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = s.replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatPriceLabel(vnd) {
  if (!Number.isFinite(vnd)) return '';
  if (vnd >= 1_000_000_000) {
    const ty = vnd / 1_000_000_000;
    return `${ty.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  }
  if (vnd >= 1_000_000) {
    return `${Math.round(vnd / 1_000_000)} triệu`;
  }
  return vnd.toLocaleString('vi-VN') + ' đ';
}

/* ───────────────────────── Slug ───────────────────────── */

export function generateSlug(text) {
  if (typeof text !== 'string') return '';
  return normalizeVN(text)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * normalizeVN — bỏ dấu tiếng Việt, lowercase. Dùng cho search + slug.
 */
export function normalizeVN(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/* ───────────────────────── DOM-safe ───────────────────────── */

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(str) {
  return escapeHtml(str);
}

/* ───────────────────────── Misc ───────────────────────── */

export function debounce(fn, wait = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ───────────────────────── Image compression ───────────────────────── */

/**
 * compressImage — nén ảnh client-side, GUARANTEED dưới targetBytes.
 *
 * Firestore giới hạn 1 document = 1 MiB → phải nén ảnh thật nhỏ.
 * Thuật toán 2 lớp (always-fit):
 *   1. Thử từng cặp (maxDim × quality), bắt đầu từ cao nhất.
 *   2. Nếu blob vượt targetBytes, giảm quality → rồi giảm dim.
 *   3. Fallback cuối: dim 240 × q 0.3 (thường ≈ 8-15KB) — đảm bảo ảnh nào
 *      cũng xuống được dưới 150KB, kể cả ảnh 4K/8K.
 *
 * @param {File|Blob} file
 * @param {object} [opts]
 * @param {number} [opts.maxDim=1600]   cạnh dài tối đa khi thử lần đầu (px)
 * @param {number} [opts.quality=0.82]  JPEG quality 0..1 lần đầu
 * @param {number} [opts.targetBytes]   dung lượng mục tiêu (bytes)
 * @returns {Promise<{dataUrl:string, width:number, height:number, bytes:number}>}
 */
export async function compressImage(file, opts = {}) {
  const { maxDim = 1600, quality = 0.82, targetBytes = 150 * 1024 } = opts;
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Not an image file');
  }

  // Load image từ File → HTMLImageElement
  const srcUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await _loadImage(srcUrl);
  } finally {
    URL.revokeObjectURL(srcUrl);
  }

  /** Render canvas tại maxDim cho sẵn, encode JPEG với quality q. */
  async function renderAndEncode(dim, q) {
    const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await _canvasToBlob(canvas, 'image/jpeg', q);
    return blob ? { blob, w, h, q, dim } : null;
  }

  // Ladder: (dim, quality). Bắt đầu từ cao nhất rồi bậc thang xuống.
  // Chiến lược: giảm quality trước (rẻ, ít mất detail hơn), rồi giảm dim.
  const dimLadder     = [maxDim, 1280, 1024, 800, 640, 480, 360, 240];
  const qualityLadder = [quality, 0.72, 0.62, 0.52, 0.42, 0.35, 0.3];

  let best = null;

  outer: for (const dim of dimLadder) {
    for (const q of qualityLadder) {
      const attempt = await renderAndEncode(dim, q);
      if (!attempt) continue;

      // Lưu bản nhỏ nhất từng thử để fallback
      if (!best || attempt.blob.size < best.blob.size) best = attempt;

      if (attempt.blob.size <= targetBytes) {
        best = attempt;
        break outer; // vừa đủ — dùng luôn
      }
    }
  }

  if (!best) throw new Error('Compression failed (canvas unavailable?)');

  const dataUrl = await _blobToDataURL(best.blob);
  return { dataUrl, width: best.w, height: best.h, bytes: best.blob.size };
}

function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh'));
    img.src = src;
  });
}

function _canvasToBlob(canvas, type, q) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

function _blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Đọc ảnh lỗi'));
    fr.readAsDataURL(blob);
  });
}

/**
 * formatBytes — "123456" → "121 KB"
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* ───────────────────────── Image URL normalization ───────────────────────── */

/**
 * normalizeImageUrl — chuẩn hoá URL ảnh để giảm dung lượng tải.
 *
 * Hỗ trợ:
 *   - Facebook scontent-*.fbcdn.net: ưu tiên query "s"/"p" size hint.
 *     (Ví dụ: ...?stp=c0.0.600.600a... → giữ nguyên, FB đã cân đối.)
 *   - Dropbox: chuyển "?dl=0" → "?raw=1" để hiển thị trực tiếp.
 *   - Google Drive: uc?export=view...
 *   - Placeholder / unsplash: thêm width param nếu chưa có.
 *
 * data URLs và http(s) khác: giữ nguyên.
 */
export function normalizeImageUrl(url, targetWidth = 900) {
  if (typeof url !== 'string' || !url) return url;
  if (url.startsWith('data:')) return url;

  try {
    const u = new URL(url);

    // Dropbox share link → raw
    if (u.hostname.endsWith('dropbox.com')) {
      u.searchParams.set('raw', '1');
      u.searchParams.delete('dl');
      return u.toString();
    }

    // Unsplash: thêm width
    if (u.hostname.endsWith('unsplash.com') || u.hostname.endsWith('images.unsplash.com')) {
      if (!u.searchParams.has('w')) u.searchParams.set('w', String(targetWidth));
      if (!u.searchParams.has('q')) u.searchParams.set('q', '75');
      if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format,compress');
      return u.toString();
    }

    // Google Drive share → direct view
    if (u.hostname === 'drive.google.com') {
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    }

    // Facebook scontent / fbcdn: giữ nguyên (đã có size params)
    return url;
  } catch {
    return url;
  }
}

/**
 * isDataUrl — check data: prefix.
 */
export function isDataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:');
}

/* ───────────────────────── Perceptual hash (dHash) ───────────────────────── */

/**
 * perceptualHash — difference hash (dHash) 64-bit để phát hiện ảnh trùng.
 *
 * So với aHash (average hash), dHash ít bị false-positive khi 2 ảnh khác nhau
 * nhưng có độ sáng tương đương. dHash so sánh từng pixel với pixel bên phải:
 * bit = 1 nếu trái sáng hơn, 0 ngược lại → 8x8 = 64 bit.
 *
 * 2 ảnh được coi là "giống về visual" nếu hashDistance ≤ 5 (thường test).
 *
 * @param {string} dataUrlOrHttpUrl  - data:image/... hoặc http(s) URL
 * @returns {Promise<string>} 16 ký tự hex (64 bit)
 */
export async function perceptualHash(dataUrlOrHttpUrl) {
  if (typeof dataUrlOrHttpUrl !== 'string' || !dataUrlOrHttpUrl) {
    throw new Error('perceptualHash: input rỗng');
  }
  const img = await _loadImage(dataUrlOrHttpUrl);
  const W = 9, H = 8; // 9x8 → mỗi hàng sinh 8 bit so sánh
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  let bits = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i1 = (y * W + x)     * 4;
      const i2 = (y * W + x + 1) * 4;
      const g1 = data[i1]     * 0.299 + data[i1 + 1] * 0.587 + data[i1 + 2] * 0.114;
      const g2 = data[i2]     * 0.299 + data[i2 + 1] * 0.587 + data[i2 + 2] * 0.114;
      bits += g1 > g2 ? '1' : '0';
    }
  }
  // 64 bit → 16 ký tự hex
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * hashDistance — Hamming distance (số bit khác nhau) giữa 2 hash hex 64-bit.
 * Dùng để so sánh "độ giống visual": distance ≤ 5 → giống, > 10 → khác hẳn.
 */
export function hashDistance(h1, h2) {
  if (typeof h1 !== 'string' || typeof h2 !== 'string' || h1.length !== h2.length) {
    return 64; // "rất khác" nếu input không hợp lệ
  }
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    let x = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
