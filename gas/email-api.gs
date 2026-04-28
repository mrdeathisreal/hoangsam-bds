// ═══════════════════════════════════════════════════════════════════════════
//  HoàngSâm BDS — Email + AI Chat API  (Google Apps Script)
// ═══════════════════════════════════════════════════════════════════════════
//  SETUP (one-time):
//  1. Deploy as Web App → Anyone → copy URL → paste into src/ai-ui.js
//  2. Set Gemini key: Project Settings → Script Properties → Add:
//       Key: GEMINI_KEY   Value: AIzaSy...
//  3. Re-deploy (new version) after setting the key
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'nhhuy130@gmail.com';
const SITE_NAME   = 'HoangSam BDS';
const GEMINI_MODEL = 'gemini-2.5-flash';

/* ─── Router ─── */
function doPost(e) {
  try {
    // CORS preflight (không cần với no-cors nhưng để an toàn)
    const data = JSON.parse(e.postData.contents);
    const type = (data.type || '').trim();

    if      (type === 'chat')        return handleChat(data);
    else if (type === 'appointment') { sendAppointmentEmail(data); return ok(); }
    else if (type === 'inquiry')     { sendInquiryEmail(data);     return ok(); }
    else throw new Error('Unknown type: ' + type);
  } catch (err) {
    return errResponse(err.message);
  }
}

function doGet(e) {
  const params = e?.parameter || {};
  if ((params.type || '').trim() === 'chat') {
    return handleChat(params);
  }
  return json({ status: 'ok', service: SITE_NAME + ' API' });
}

/* ─── AI Chat (Gemini proxy) ─── */
function handleChat(d) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!key) return errResponse('GEMINI_KEY not set in Script Properties');

  const systemPrompt = d.systemPrompt || 'Ban la tu van vien bat dong san chuyen nghiep cua HoangSam BDS tai TP.HCM. Tra loi ngan gon, chinh xac, than thien.';
  const userPrompt   = d.userPrompt   || '';
  const listings     = d.listings     || '';
  const history      = Array.isArray(d.history) ? d.history : null;

  const fullSystem = systemPrompt +
    (listings ? '\n\n=== TIN DANG HIEN CO ===\n' + listings : '');

  // Build contents: prefer history (multi-turn) → fallback userPrompt (single-turn)
  let contents;
  if (history && history.length) {
    contents = history.map(function(m) {
      return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] };
    });
  } else {
    contents = [{ role: 'user', parts: [{ text: userPrompt }] }];
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              GEMINI_MODEL + ':generateContent?key=' + key;

  const payload = {
    systemInstruction: { parts: [{ text: fullSystem }] },
    contents: contents,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 2048,
      topP: 0.95,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  try {
    const resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const result = JSON.parse(resp.getContentText());

    if (result.error) {
      return errResponse('Gemini error: ' + result.error.message);
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json({ ok: true, text });

  } catch (err) {
    return errResponse('Fetch failed: ' + err.message);
  }
}

/* ─── Appointment email ─── */
function sendAppointmentEmail(d) {
  const subject = '[' + SITE_NAME + '] Lich hen xem nha - ' + d.name;
  const lines = [
    'LICH HEN XEM NHA MOI',
    '',
    'Khach:     ' + d.name,
    'SDT:       ' + d.phone,
    'Thoi gian: ' + d.time + ' - ' + d.date,
  ];
  if (d.listingTitle) lines.push('Nha:       ' + d.listingTitle);
  if (d.note)         lines.push('Ghi chu:   ' + d.note);
  lines.push('', '(Tu dong tu website ' + SITE_NAME + ')');
  GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'));
}

/* ─── Inquiry email ─── */
function sendInquiryEmail(d) {
  const subject = '[' + SITE_NAME + '] Tin nhan tu van - ' + d.name;
  const lines = [
    'TIN NHAN TU KHACH HANG',
    '',
    'Ten:   ' + d.name,
    'SDT:   ' + d.phone,
    '',
    'Noi dung:',
    d.message,
    '',
    '(Tu dong tu website ' + SITE_NAME + ')',
  ];
  GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'));
}

/* ─── Helpers ─── */
function ok()           { return json({ ok: true }); }
function errResponse(m) { return json({ ok: false, error: m }); }
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
