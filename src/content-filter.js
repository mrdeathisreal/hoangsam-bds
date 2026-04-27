/**
 * content-filter.js
 * ----------------------------------------------------------------------------
 * Client-side gate CHẶN nội dung phản cảm trước khi gửi AI:
 *   - NSFW / tình dục / khỏa thân
 *   - Ma tuý / chất cấm
 *   - Bạo lực / tự sát
 *   - Thù ghét, phân biệt, cực đoan
 *   - Hướng dẫn phạm pháp
 *
 * KHÔNG chặn off-topic thông thường (thời tiết, nấu ăn...) — để AI chào nhẹ.
 *
 * Cách dùng:
 *   import { isContentAllowed } from './content-filter.js';
 *   const { ok, reason } = isContentAllowed(userText);
 * ----------------------------------------------------------------------------
 */

// Regex patterns — word-boundary nhẹ, tolerant với dấu tiếng Việt.
// Tất cả case-insensitive. Cân nhắc false-positive: giữ conservative.
const BLOCKED_PATTERNS = [
  // Sexual explicit
  /\bporn\b|\bsex\b|\bxxx\b|\bnud(e|ity)\b|\bnaked\b/i,
  /khỏa\s*thân|lõa\s*lồ|lõa\s*thể|tình\s*dục\s*(qua|dị|phạm)|làm\s*tình/i,
  /hiếp\s*dâm|cưỡng\s*hiếp|ấu\s*dâm|trẻ\s*em.*(dâm|tình\s*dục|sex)/i,

  // Drugs / chất cấm
  /\b(heroin|cocaine|meth|lsd|mdma|crack)\b/i,
  /ma\s*tu[úý]|thuốc\s*lắc|cần\s*sa|bồ\s*đà|thuốc\s*phiện|đập\s*đá/i,

  // Bạo lực / tự sát cụ thể
  /\b(kill|murder|suicide|self\s*harm)\b/i,
  /giết\s*(người|hại)|tự\s*tử|tự\s*sát|chặt\s*đầu|tra\s*tấn/i,

  // Hướng dẫn phạm pháp
  /cách\s*(lừa\s*đảo|hack|trộm|ăn\s*cắp|làm\s*giả|rửa\s*tiền)/i,
  /how\s*to\s*(hack|scam|steal|launder|make\s*a?\s*bomb)/i,

  // Hate speech (tổng quát — tránh over-block)
  /\b(nazi|kkk)\b/i,
  /phân\s*biệt\s*chủng\s*tộc.*(gây|kích|xúi)/i,
];

/**
 * Check nội dung user có chặn hay không.
 * @param {string} text - user input
 * @returns {{ok: boolean, reason?: string}}
 */
export function isContentAllowed(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: true };

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(s)) {
      return {
        ok: false,
        reason: 'BLOCKED_SENSITIVE',
      };
    }
  }
  return { ok: true };
}

/**
 * User-friendly message hiển thị khi bị chặn, 3 ngôn ngữ.
 */
export function getBlockedMessage(lang = 'vi') {
  const MSG = {
    vi: 'Nội dung nhạy cảm không được hỗ trợ. Em chỉ có thể tư vấn về bất động sản, pháp lý nhà đất, vay ngân hàng, phong thuỷ nhà. Anh/chị vui lòng đặt câu hỏi khác ạ.',
    en: 'Sensitive content is not supported. Our advisor only helps with real estate, property law, mortgages, and feng shui. Please ask a different question.',
    zh: '敏感內容不予支援。本顧問僅協助房地產、不動產法律、貸款與風水相關問題。請改提其他問題。',
  };
  return MSG[lang] || MSG.vi;
}
