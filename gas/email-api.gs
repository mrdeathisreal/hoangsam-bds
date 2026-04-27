// ═══════════════════════════════════════════════════════════════════════════
//  HoàngSâm BDS — Email Notification API  (Google Apps Script)
// ═══════════════════════════════════════════════════════════════════════════
//  DEPLOY INSTRUCTIONS (one-time, ~2 minutes):
//  1. Go to https://script.google.com → New project → paste this file
//  2. Click "Deploy" → "New deployment"
//  3. Type: Web app
//     Execute as: Me
//     Who has access: Anyone
//  4. Click Deploy → Copy the Web App URL
//  5. Paste URL into src/ai-ui.js → const EMAIL_API_URL = '<your-url>'
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'nhhuy130@gmail.com';
const SITE_NAME   = 'HoàngSâm BDS';

/* ─── Router ─── */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = (data.type || '').trim();
    if      (type === 'appointment') sendAppointmentEmail(data);
    else if (type === 'inquiry')     sendInquiryEmail(data);
    else throw new Error('Unknown notification type: ' + type);
    return ok();
  } catch (err) {
    return errResponse(err.message);
  }
}

// Health-check endpoint
function doGet() {
  return json({ status: 'ok', service: SITE_NAME + ' Email API' });
}

/* ─── Appointment email ─── */
function sendAppointmentEmail(d) {
  const subject = '[' + SITE_NAME + '] Lịch hẹn xem nhà — ' + d.name;
  const lines = [
    '════════════════════════════════',
    '  LỊCH HẸN XEM NHÀ MỚI',
    '════════════════════════════════',
    '',
    'Khách:     ' + d.name,
    'SĐT:       ' + d.phone,
    'Thời gian: ' + d.time + ' · ' + d.date,
  ];
  if (d.listingTitle) lines.push('Nhà:       ' + d.listingTitle);
  if (d.note)         lines.push('Ghi chú:   ' + d.note);
  lines.push('', '────────────────────────────────');
  lines.push('(Tự động từ website ' + SITE_NAME + ')');

  GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'));
}

/* ─── Inquiry / Chat email ─── */
function sendInquiryEmail(d) {
  const subject = '[' + SITE_NAME + '] Tin nhắn tư vấn — ' + d.name;
  const lines = [
    '════════════════════════════════',
    '  TIN NHẮN TỪ KHÁCH HÀNG',
    '════════════════════════════════',
    '',
    'Tên:   ' + d.name,
    'SĐT:   ' + d.phone,
    '',
    'Nội dung:',
    d.message,
    '',
    '────────────────────────────────',
    '(Tự động từ website ' + SITE_NAME + ')',
  ];

  GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join('\n'));
}

/* ─── Helpers ─── */
function ok()            { return json({ ok: true }); }
function errResponse(m)  { return json({ ok: false, error: m }); }
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
