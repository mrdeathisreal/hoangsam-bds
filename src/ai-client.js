/**
 * ai-client.js
 * ----------------------------------------------------------------------------
 * Google Gemini API wrapper — free tier (15 RPM / 1500 RPD).
 *
 * Lấy API key miễn phí: https://aistudio.google.com/app/apikey
 * Key lưu localStorage — không gửi đi đâu ngoài Google.
 *
 * Không bundler: ES module tự contained, fetch API native.
 * ----------------------------------------------------------------------------
 */

const STORAGE_KEY = 'hs_gemini_key';
const MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
const IMAGE_ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

export function getApiKey() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; }
  catch { return ''; }
}

export function setApiKey(key) {
  try { localStorage.setItem(STORAGE_KEY, (key || '').trim()); return true; }
  catch { return false; }
}

export function clearApiKey() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}

export function hasApiKey() {
  return getApiKey().length > 10;
}

/**
 * Stream một prompt qua Gemini. Gọi onChunk(text) mỗi khi có token mới.
 * Trả về full text khi xong. Throw nếu lỗi.
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {Function} opts.onChunk  - (deltaText) => void
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.temperature=0.8]
 * @param {number} [opts.maxTokens=4096]
 */
export async function streamPrompt({
  systemPrompt,
  userPrompt,
  attachments = [],
  onChunk,
  signal,
  temperature = 0.8,
  maxTokens = 4096,
}) {
  const key = getApiKey();
  if (!key) throw new Error('NO_API_KEY');

  const userParts = [];
  for (const att of attachments) {
    if (att?.mimeType && att?.data) {
      userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    }
  }
  userParts.push({ text: userPrompt });

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      { role: 'user', parts: userParts },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let res;
  try {
    res = await fetch(ENDPOINT(MODEL, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('NETWORK_ERROR: ' + e.message);
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody?.error?.message || msg;
      if (res.status === 400 && /API key/i.test(msg)) msg = 'INVALID_API_KEY';
      if (res.status === 429) msg = 'RATE_LIMIT';
      if (res.status === 403) msg = 'FORBIDDEN_OR_QUOTA';
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const parts = json?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (typeof p.text === 'string' && p.text.length) {
            full += p.text;
            onChunk && onChunk(p.text);
          }
        }
      } catch { /* skip malformed chunk */ }
    }
  }

  return full;
}

/**
 * Generate ảnh từ prompt. Gemini 2.5 Flash Image (preview) - trả base64 PNG.
 *
 * @param {Object} opts
 * @param {string} opts.prompt - Mô tả ảnh cần tạo (tiếng Việt/Anh đều OK)
 * @param {Array<{mimeType:string, data:string}>} [opts.referenceImages] - Ảnh reference (base64) để edit/extend
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{imageDataUrl: string, mimeType: string, textNote: string}>}
 */
export async function generateImage({ prompt, referenceImages = [], signal }) {
  const key = getApiKey();
  if (!key) throw new Error('NO_API_KEY');

  const parts = [];
  for (const img of referenceImages) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  parts.push({ text: prompt });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 0.9,
    },
  };

  let res;
  try {
    res = await fetch(IMAGE_ENDPOINT(IMAGE_MODEL, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('NETWORK_ERROR: ' + e.message);
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      msg = errBody?.error?.message || msg;
      if (res.status === 400 && /API key/i.test(msg)) msg = 'INVALID_API_KEY';
      if (res.status === 429) msg = 'RATE_LIMIT';
      if (res.status === 403) msg = 'FORBIDDEN_OR_QUOTA';
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const json = await res.json();
  const outParts = json?.candidates?.[0]?.content?.parts || [];

  let imageDataUrl = '';
  let mimeType = 'image/png';
  let textNote = '';

  for (const p of outParts) {
    if (p.inlineData?.data) {
      mimeType = p.inlineData.mimeType || 'image/png';
      imageDataUrl = `data:${mimeType};base64,${p.inlineData.data}`;
    } else if (typeof p.text === 'string') {
      textNote += p.text;
    }
  }

  if (!imageDataUrl) {
    const reason = json?.candidates?.[0]?.finishReason || 'NO_IMAGE';
    throw new Error(`IMAGE_GEN_FAILED: ${reason}. ${textNote || ''}`);
  }

  return { imageDataUrl, mimeType, textNote };
}

/**
 * Helper: đọc File object thành {mimeType, data(base64)} để gửi vào API.
 */
export function fileToPart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) return reject(new Error('INVALID_FILE'));
      resolve({ mimeType: m[1], data: m[2] });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Helper: map internal error code sang message user-friendly 3 ngôn ngữ.
 */
export function describeError(err, lang = 'vi') {
  const code = (err?.message || '').split(':')[0].trim();
  const MSG = {
    vi: {
      NO_API_KEY:         'Chưa có Gemini API key. Bấm "Cài đặt" để thêm.',
      INVALID_API_KEY:    'API key không hợp lệ. Kiểm tra lại tại aistudio.google.com.',
      RATE_LIMIT:         'Đã vượt giới hạn free tier (15 request/phút). Chờ 1 phút rồi thử lại.',
      FORBIDDEN_OR_QUOTA: 'Bị chặn hoặc hết quota. Kiểm tra billing tại Google AI Studio.',
      NETWORK_ERROR:      'Lỗi mạng. Kiểm tra kết nối internet.',
      IMAGE_GEN_FAILED:   'Không tạo được ảnh. Thử lại hoặc sửa prompt (tránh nội dung nhạy cảm).',
    },
    en: {
      NO_API_KEY:         'No Gemini API key. Click "Settings" to add one.',
      INVALID_API_KEY:    'Invalid API key. Check at aistudio.google.com.',
      RATE_LIMIT:         'Free tier limit reached (15 req/min). Wait 1 minute.',
      FORBIDDEN_OR_QUOTA: 'Blocked or out of quota. Check Google AI Studio billing.',
      NETWORK_ERROR:      'Network error. Check your connection.',
      IMAGE_GEN_FAILED:   'Image generation failed. Retry or adjust prompt (avoid sensitive content).',
    },
    zh: {
      NO_API_KEY:         '尚未設定 Gemini API 金鑰。點擊「設定」新增。',
      INVALID_API_KEY:    'API 金鑰無效。請至 aistudio.google.com 確認。',
      RATE_LIMIT:         '已達免費額度上限(每分鐘15次)。請稍候再試。',
      FORBIDDEN_OR_QUOTA: '被封鎖或額度用完。請檢查 Google AI Studio 帳單。',
      NETWORK_ERROR:      '網路錯誤。請檢查連線。',
      IMAGE_GEN_FAILED:   '無法生成圖片。請重試或調整提示詞 (避免敏感內容)。',
    },
  };
  const dict = MSG[lang] || MSG.vi;
  return dict[code] || (err?.message || 'Unknown error');
}
