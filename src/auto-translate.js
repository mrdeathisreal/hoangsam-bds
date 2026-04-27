/**
 * auto-translate.js
 * ----------------------------------------------------------------------------
 * Admin bấm "Tự động dịch" trong form thêm/sửa tin → dùng Gemini translate
 * title (VI) + description (VI) → EN và 繁體中文, fill vào 4 trường i18n.
 * Admin xem + chỉnh trước khi lưu. Không gọi tự động để admin chủ động quota.
 * ----------------------------------------------------------------------------
 */

import { streamPrompt, hasApiKey } from './ai-client.js';

const SYSTEM_PROMPT = `You are a professional Vietnamese real-estate translator for Hoàng Sâm.

TASK: Translate the provided Vietnamese listing (title + description) into BOTH English (professional, concise) AND Traditional Chinese (繁體中文, for Taiwan/HK market).

OUTPUT (STRICT JSON, no Markdown, no preface, no explanation):
{
  "title_en": "...",
  "title_zh": "...",
  "description_en": "...",
  "description_zh": "..."
}

RULES:
- Preserve proper nouns: "Quận 7" → "District 7" / "第7郡", "Vinhomes Central Park" stays as-is in all languages.
- Keep numbers exactly: "9.8 tỷ" → "9.8 billion VND" / "98億越南盾".
- Legal terms: "sổ hồng" → "pink book (so hong)" / "粉紅色房契(Sổ hồng)"; "sổ đỏ" → "red book (so do)" / "紅色土地證(Sổ đỏ)".
- Professional real-estate tone. No emoji. No marketing fluff.
- title_en/zh: same length or shorter than VI original.
- description_en/zh: same structure as VI, don't add info not present.`;

/**
 * Dịch VI → EN + ZH. Throws nếu lỗi.
 * @param {{ title: string, description?: string }} input
 * @returns {Promise<{ title_en: string, title_zh: string, description_en: string, description_zh: string }>}
 */
export async function translateListingVi({ title, description = '' }) {
  if (!hasApiKey()) throw new Error('NO_API_KEY');
  const viContent = `TITLE (VI):\n${title}\n\nDESCRIPTION (VI):\n${description || '(trống)'}`;

  let full = '';
  await streamPrompt({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: viContent,
    temperature: 0.2,
    maxTokens: 2048,
    onChunk: (d) => { full += d; },
  });

  // Extract JSON (tolerant: some models wrap in ```json```)
  const jsonMatch = full.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('TRANSLATE_PARSE_FAIL: no JSON found');
  const json = JSON.parse(jsonMatch[0]);

  return {
    title_en: json.title_en || '',
    title_zh: json.title_zh || '',
    description_en: json.description_en || '',
    description_zh: json.description_zh || '',
  };
}
