/**
 * ai-ui.js — Controller tư vấn viên + formatter + đặt lịch
 * ----------------------------------------------------------------------------
 * Luồng:
 *   - Header có switch: OFF = Khách · ON = Cộng tác viên (lưu localStorage hs_role)
 *   - Khách: 2 CTA (Chat tư vấn viên | Đặt lịch xem nhà). Chat không tiết lộ AI.
 *   - CTV: thêm card "Content Polisher" (SEO formatter).
 *   - Admin login: thêm card "Cài đặt Gemini API key" (chỉ admin thấy).
 * ----------------------------------------------------------------------------
 */

import { getAgent, getSystemPromptForRole } from './ai-agents.js';
import { streamPrompt, hasApiKey, getApiKey, setApiKey, describeError } from './ai-client.js';
import { getAllListings, addAppointment, addInquiry } from './store.js';
import { isAdmin, subscribe as subscribeAuth } from './auth.js';
import { t, getLang, onLangChange } from './i18n.js';
import { isContentAllowed, getBlockedMessage } from './content-filter.js';

const ROLE_KEY = 'hs_role'; // 'ctv' | 'client'
const ADMIN_ZALO = '0909326188';
const ADMIN_ZALO_URL = `https://zalo.me/${ADMIN_ZALO}`;

// ── Email API (Google Apps Script) ──────────────────────────────────────────
// Sau khi deploy gas/email-api.gs, paste URL vào đây:
const EMAIL_API_URL = 'https://script.google.com/macros/s/AKfycby_hUxdfdeLqFFE5ToOxWSz-JngTaMrWK2KedssOdXzsC1oiy6wHdrK6wMZuCduu5v-/exec';

async function sendEmailNotification(payload) {
  if (!EMAIL_API_URL.includes('PASTE_YOUR')) {
    try {
      await fetch(EMAIL_API_URL, {
        method: 'POST',
        mode: 'no-cors', // GAS không cần CORS preflight
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('[email] notification failed (non-critical):', e);
    }
  }
}

/** Đọc region từ sessionStorage (app.js detectCallRegion() đã set) */
function getRegion() {
  try { return sessionStorage.getItem('hs_region') || 'VN'; }
  catch { return 'VN'; }
}

/** Minimal mascot avatar — rounded square with 2 eyes + smile.
 *  color: 'blue' (chat) | 'amber' (book/apt) */
function _mascotSVG(color) {
  const c = color === 'amber' ? '#f59e0b' : '#3b82f6';
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="40" height="40" rx="12" fill="${c}"/>
    <circle cx="18" cy="22" r="2.8" fill="#fff"/>
    <circle cx="30" cy="22" r="2.8" fill="#fff"/>
    <path d="M18 32 Q24 35 30 32" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/** Anti-spam token bucket + auto-ban (same logic as app.js). */
function _antiSpamOk(key) {
  const NOW = Date.now();
  const BK = `hs_bucket_${key}`;
  const LK = `hs_lockout_${key}`;
  try {
    const lockUntil = Number(localStorage.getItem(LK) || 0);
    if (lockUntil > NOW) {
      const mins = Math.ceil((lockUntil - NOW)/60000);
      const msg = `Bạn đã thao tác quá nhiều. Thử lại sau ${mins > 60 ? Math.ceil(mins/60)+' giờ' : mins+' phút'}.`;
      _showAptError(msg);
      return false;
    }
    let arr = JSON.parse(localStorage.getItem(BK) || '[]');
    if (!Array.isArray(arr)) arr = [];
    arr = arr.filter(ts => NOW - ts < 24*60*60*1000);
    const short = arr.filter(ts => NOW - ts < 10*60*1000);
    if (short.length >= 5) {
      localStorage.setItem(LK, String(NOW + 30*60*1000));
      _showAptError('Bạn đã thao tác quá nhiều. Thử lại sau 30 phút.');
      return false;
    }
    if (arr.length >= 10) {
      localStorage.setItem(LK, String(NOW + 24*60*60*1000));
      _showAptError('Bạn đã thao tác quá nhiều. Thử lại sau 24 giờ.');
      return false;
    }
    arr.push(NOW);
    localStorage.setItem(BK, JSON.stringify(arr));
    return true;
  } catch { return true; }
}
function _showAptError(msg) {
  const s = $('apt-status');
  if (s) { s.textContent = msg; s.className = 'apt-status apt-status--err'; }
}

/**
 * Tính earliest valid datetime cho region VN: now + 1h, làm tròn lên hour kế.
 * Trả về Date object.
 */
function getEarliestApptVN() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1h
  if (d.getMinutes() > 0 || d.getSeconds() > 0 || d.getMilliseconds() > 0) {
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
  }
  return d;
}
function _fmtHM(d) {
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function _fmtDMY(d) {
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

let currentAgent = null;
let currentAbort = null;

const $ = (id) => document.getElementById(id);

/* ───────────────────────── Public init ───────────────────────── */

export function initAiUi() {
  wireRoleToggle();
  wireAgentTriggers();
  wireAgentModal();
  wireAppointment();
  wireInquiry();
  wireSettings();
  applyRoleVisibility();

  // Admin status can change async after Firebase auth resolves
  try {
    subscribeAuth(() => applyAdminVisibility());
  } catch { /* noop */ }
  applyAdminVisibility();

  // Khi user đổi ngôn ngữ → update toggle label + agent modal (nếu đang mở)
  try {
    onLangChange(() => {
      updateToggleLabel();
      if ($('ai-modal')?.getAttribute('aria-hidden') === 'false' && currentAgent) {
        $('ai-agent-name').textContent = t(`team.${currentAgent.id}_name`) || currentAgent.name;
        $('ai-agent-role').textContent = t(`team.${currentAgent.id}_role`) || currentAgent.role;
      }
    });
  } catch { /* noop */ }
}

/* ───────────────────────── Role toggle ───────────────────────── */

function getRole() {
  try { return localStorage.getItem(ROLE_KEY) || 'client'; }
  catch { return 'client'; }
}
function setRole(role) {
  try { localStorage.setItem(ROLE_KEY, role); } catch {}
  applyRoleVisibility();
}

function wireRoleToggle() {
  const toggle = $('role-toggle-input');
  if (!toggle) return;

  // Init từ localStorage
  toggle.checked = getRole() === 'ctv';
  updateToggleLabel();

  toggle.addEventListener('change', () => {
    setRole(toggle.checked ? 'ctv' : 'client');
    updateToggleLabel();
  });
}

function updateToggleLabel() {
  const label = $('role-toggle-label');
  const isCtv = getRole() === 'ctv';
  if (!label) return;
  // i18n: đổi label theo UI lang hiện tại
  label.textContent = isCtv ? t('role.ctv_label') : t('role.client_label');
  label.classList.toggle('role-toggle__label--ctv', isCtv);
  // Tooltip trên parent <label class="role-toggle">
  const tooltip = label.closest('.role-toggle');
  if (tooltip) tooltip.title = t('role.toggle_title');
}

function applyRoleVisibility() {
  const isCtv = getRole() === 'ctv';
  document.querySelectorAll('[data-role-view="ctv"]').forEach(el => el.hidden = !isCtv);
  document.querySelectorAll('[data-role-view="client"]').forEach(el => el.hidden = isCtv);
  applyAdminVisibility();
}

function applyAdminVisibility() {
  const isAdm = !!isAdmin();
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.hidden = !isAdm;
  });
}

/* ───────────────────────── Wire triggers ───────────────────────── */

function wireAgentTriggers() {
  document.querySelectorAll('[data-agent]').forEach((card) => {
    const id = card.getAttribute('data-agent');
    const trigger = card.querySelector('.team-card__cta') || card;
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAgentModal(id);
    });
  });

  // Khách action buttons
  $('client-chat-btn')?.addEventListener('click', () => openAgentModal('chat'));
  $('client-book-btn')?.addEventListener('click', () => openAppointment());
}

/* ───────────────────────── Agent modal ───────────────────────── */

function wireAgentModal() {
  $('ai-modal-close')?.addEventListener('click', closeAgentModal);
  $('ai-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAgentModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('ai-modal')?.getAttribute('aria-hidden') === 'false') {
      closeAgentModal();
    }
  });

  $('ai-run-btn')?.addEventListener('click', handleRun);
  $('ai-stop-btn')?.addEventListener('click', () => currentAbort?.abort());
  $('ai-copy-btn')?.addEventListener('click', handleCopy);
  $('ai-book-from-chat')?.addEventListener('click', () => {
    closeAgentModal();
    openAppointment();
  });
  // Enter = Gửi (Shift+Enter = xuống dòng)
  $('ai-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
  });

  // Live content-check: disable nút Gửi + hiện banner nếu text vi phạm
  $('ai-input')?.addEventListener('input', () => {
    const text = $('ai-input').value;
    const check = isContentAllowed(text);
    const runBtn = $('ai-run-btn');
    const blockedBanner = document.getElementById('ai-content-blocked');
    if (!check.ok) {
      runBtn.disabled = true;
      runBtn.setAttribute('aria-disabled', 'true');
      if (!blockedBanner) {
        const div = document.createElement('div');
        div.id = 'ai-content-blocked';
        div.className = 'content-blocked';
        div.textContent = getBlockedMessage(getLang());
        runBtn.parentElement.parentElement.insertBefore(div, runBtn.parentElement);
      }
    } else {
      runBtn.disabled = false;
      runBtn.removeAttribute('aria-disabled');
      blockedBanner?.remove();
    }
  });
}

function openAgentModal(agentId) {
  const agent = getAgent(agentId);
  if (!agent) return;
  currentAgent = agent;

  // Mascot minimal — blue cho chat, amber cho formatter
  const color = agentId === 'chat' ? 'blue' : 'amber';
  $('ai-agent-emoji').innerHTML = _mascotSVG(color);
  // Name + role theo UI ngôn ngữ khách chọn
  $('ai-agent-name').textContent = t(`team.${agentId}_name`) || agent.name;
  $('ai-agent-role').textContent = t(`team.${agentId}_role`) || agent.role;

  const isCtv = getRole() === 'ctv';
  const isAdm = !!isAdmin();

  // Templates: chỉ CTV + có templates mới hiện
  const showTemplates = isCtv && agent.templates?.length > 0;
  $('ai-templates-section').hidden = !showTemplates;
  if (showTemplates) {
    const tplWrap = $('ai-templates');
    tplWrap.innerHTML = '';
    agent.templates.forEach((tpl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-template';
      btn.textContent = tpl.label;
      btn.title = tpl.text;
      btn.addEventListener('click', () => {
        $('ai-input').value = tpl.text;
        $('ai-input').focus();
      });
      tplWrap.appendChild(btn);
    });
  }

  // System prompt details: chỉ ADMIN mới thấy (không phải CTV)
  $('ai-system-details').hidden = !isAdm;
  if (isAdm) {
    const sp = agentId === 'chat'
      ? getSystemPromptForRole('chat', getRole())
      : agent.systemPrompt;
    $('ai-system-prompt').textContent = sp;
  }

  // Nút đặt lịch chỉ hiện khi đang ở agent chat
  $('ai-book-from-chat').hidden = agentId !== 'chat';

  // Reset input/output
  $('ai-input').value = '';
  $('ai-input').placeholder = agent.exampleInput || 'Nhập nội dung...';
  $('ai-output').textContent = '';
  $('ai-output').classList.add('ai-output--empty');
  $('ai-output').setAttribute('data-placeholder',
    agentId === 'chat' ? 'Phản hồi sẽ hiện ở đây.' : 'Nội dung đã biên tập sẽ hiện ở đây.');

  setRunningState(false);

  // Banner thiếu key: chỉ ADMIN thấy (khách/CTV không cần biết)
  $('ai-no-key').hidden = hasApiKey() || !isAdm;

  // Luôn hiện AI chat (GAS proxy cho guest, local key cho admin)
  $('ai-chat-section').hidden        = false;
  $('ai-chat-output-section').hidden = false;
  $('ai-inquiry-section').hidden     = true;

  $('ai-modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('ai-input').focus());
}

function closeAgentModal() {
  currentAbort?.abort();
  $('ai-modal')?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  currentAgent = null;
}

async function handleRun() {
  if (!currentAgent) return;
  const userPrompt = $('ai-input').value.trim();
  if (!userPrompt) { $('ai-input').focus(); return; }

  // Content filter — chặn phản cảm trước khi gửi
  const check = isContentAllowed(userPrompt);
  if (!check.ok) {
    const lang = getLang();
    const out = $('ai-output');
    out.textContent = getBlockedMessage(lang);
    out.classList.remove('ai-output--empty');
    setRunningState(false);
    return;
  }

  // Chọn system prompt theo role (với agent chat)
  let systemPrompt = currentAgent.id === 'chat'
    ? getSystemPromptForRole('chat', getRole())
    : currentAgent.systemPrompt;

  // BẮT BUỘC trả lời bằng ngôn ngữ UI khách đã chọn
  const uiLang = getLang();
  const LANG_NAMES = { vi: 'Vietnamese', en: 'English', zh: 'Traditional Chinese (繁體中文)' };
  systemPrompt += `\n\n=== OUTPUT LANGUAGE (STRICT) ===\nRespond in ${LANG_NAMES[uiLang] || 'Vietnamese'} regardless of the user's input language.`;

  // Agent chat: inject listings
  const listingsCtx = currentAgent.id === 'chat' ? formatListingsForContext() : '';
  if (listingsCtx) systemPrompt += '\n\n=== TIN ĐĂNG HIỆN CÓ ===\n' + listingsCtx;

  const out = $('ai-output');
  out.textContent = '';
  out.classList.remove('ai-output--empty');
  setRunningState(true);

  // --- Nếu có local Gemini key → stream trực tiếp (admin/CTV) ---
  if (hasApiKey()) {
    currentAbort = new AbortController();
    try {
      await streamPrompt({
        systemPrompt, userPrompt,
        signal: currentAbort.signal,
        onChunk: (delta) => { out.textContent += delta; out.scrollTop = out.scrollHeight; },
      });
    } catch (err) {
      if (err.name === 'AbortError') out.textContent += '\n\n[Đã dừng]';
      else out.textContent = isAdmin() ? describeError(err, uiLang) : 'Lỗi kết nối. Vui lòng thử lại.';
    } finally { currentAbort = null; setRunningState(false); }
    return;
  }

  // --- Không có key → gọi GAS proxy (tất cả khách) ---
  if (isAdmin()) { openKeyDialog(); setRunningState(false); return; }

  out.textContent = '⏳ Đang kết nối tư vấn viên AI...';
  try {
    // GAS POST gặp CORS redirect → dùng GET với URLSearchParams
    const params = new URLSearchParams({
      type: 'chat',
      systemPrompt,
      userPrompt,
      listings: listingsCtx,
    });
    const resp = await fetch(EMAIL_API_URL + '?' + params.toString());
    const data = await resp.json();
    if (data.ok && data.text) {
      out.textContent = data.text;
    } else {
      out.textContent = 'Tư vấn viên tạm thời bận. Vui lòng đặt lịch để được hỗ trợ trực tiếp.';
    }
  } catch (err) {
    out.textContent = 'Không kết nối được. Vui lòng thử lại sau.';
  } finally {
    setRunningState(false);
  }
}

function formatListingsForContext() {
  try {
    const listings = getAllListings() || [];
    if (!listings.length) return '(chưa có tin đăng nào trong hệ thống)';
    return listings.slice(0, 30).map((L, i) =>
      `${i + 1}. ${L.title || '(không tiêu đề)'}
   Giá: ${L.priceLabel || (L.priceValue ? formatPrice(L.priceValue) : 'thương lượng')} | DT: ${L.areaSqm || '?'}m² | ${L.bedrooms ?? '?'}PN${L.bathrooms ? '/' + L.bathrooms + 'WC' : ''}
   Khu: ${L.area || '?'} | Loại: ${L.propertyType || '?'} | Pháp lý: ${L.legalStatus || '?'}
   Địa chỉ: ${L.location || '?'}
   Mô tả ngắn: ${(L.description || '').slice(0, 200)}`
    ).join('\n\n');
  } catch (e) {
    console.warn('[ai-ui] formatListings', e);
    return '(lỗi tải danh sách tin đăng)';
  }
}

function formatPrice(p) {
  const n = Number(p);
  if (!n) return String(p);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' triệu';
  return n.toLocaleString('vi-VN');
}

function setRunningState(running) {
  $('ai-run-btn').hidden = running;
  $('ai-stop-btn').hidden = !running;
  $('ai-input').disabled = running;
}

async function handleCopy() {
  const text = $('ai-output').textContent || '';
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    flash($('ai-copy-btn'), 'Đã copy');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('ai-output'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function flash(btn, msg) {
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

/* ───────────────────────── Inquiry (guest chat) ───────────────────────── */

function wireInquiry() {
  $('inq-submit')?.addEventListener('click', submitInquiry);
  ['inq-name','inq-phone'].forEach(id => {
    $(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitInquiry(); }
    });
  });
}

async function submitInquiry() {
  const name    = ($('inq-name')?.value    || '').trim();
  const phone   = ($('inq-phone')?.value   || '').trim();
  const message = ($('inq-message')?.value || '').trim();
  const status  = $('inq-status');
  const btn     = $('inq-submit');

  if (!name || !phone || !message) {
    if (status) { status.textContent = 'Vui lòng điền đầy đủ thông tin.'; status.className = 'apt-status apt-status--err'; }
    return;
  }
  if (!/^[0-9+\s\-()]{7,15}$/.test(phone)) {
    if (status) { status.textContent = 'Số điện thoại không hợp lệ.'; status.className = 'apt-status apt-status--err'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

  const payload = { name, phone, message, status: 'new' };

  // 1. Save to Firestore (best-effort)
  try { await addInquiry(payload); } catch (e) { console.warn('[inquiry] Firestore save failed:', e); }

  // 2. Send email notification
  await sendEmailNotification({ type: 'inquiry', ...payload });

  if (status) {
    status.textContent = '✓ Đã gửi! Chúng tôi sẽ liên hệ bạn trong vòng 30 phút.';
    status.className = 'apt-status apt-status--ok';
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Đã gửi'; }
}

/* ───────────────────────── Appointment ───────────────────────── */

function wireAppointment() {
  $('apt-close')?.addEventListener('click', closeAppointment);
  $('apt-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAppointment();
  });
  $('apt-cancel')?.addEventListener('click', closeAppointment);
  $('apt-submit')?.addEventListener('click', submitAppointment);

  // Enter trong input apt-form = submit (trừ textarea note — Enter = newline, Cmd/Ctrl+Enter = submit)
  ['apt-name','apt-phone','apt-date','apt-time','apt-listing'].forEach(id => {
    $(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitAppointment(); }
    });
  });
  $('apt-note')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitAppointment(); }
  });

  // Min date = today (prevent past selection)
  const dateIn = $('apt-date');
  if (dateIn) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateIn.min = `${yyyy}-${mm}-${dd}`;
    dateIn.value = `${yyyy}-${mm}-${dd}`;
  }
}

function openAppointment() {
  // Render minimal mascot amber vào modal header
  const emoji = $('apt-modal')?.querySelector('.ai-modal__emoji');
  if (emoji) emoji.innerHTML = _mascotSVG('amber');

  // VN: set min cho input date = hôm nay, và nếu earliest > 20:00 thì set date = ngày mai
  if (getRegion() === 'VN') {
    const earliest = getEarliestApptVN();
    const lastSlotHour = 20; // option lớn nhất trong apt-time
    let minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    if (earliest.getHours() > lastSlotHour) {
      // Đẩy sang ngày mai 08:00
      minDate.setDate(minDate.getDate() + 1);
    }
    const y = minDate.getFullYear();
    const m = String(minDate.getMonth()+1).padStart(2,'0');
    const d = String(minDate.getDate()).padStart(2,'0');
    const iso = `${y}-${m}-${d}`;
    const dateIn = $('apt-date');
    if (dateIn) {
      dateIn.min = iso;
      dateIn.value = iso;
    }
  }

  const select = $('apt-listing');
  if (select) {
    select.innerHTML = '<option value="">-- Chưa chọn cụ thể --</option>';
    try {
      (getAllListings() || []).slice(0, 50).forEach(L => {
        const opt = document.createElement('option');
        opt.value = L.id || '';
        const price = L.priceLabel || (L.priceValue ? formatPrice(L.priceValue) : '');
        opt.textContent = `${L.title} — ${price} — ${L.area || ''}`;
        select.appendChild(opt);
      });
    } catch {}
  }

  $('apt-name').value = '';
  $('apt-phone').value = '';
  $('apt-note').value = '';
  $('apt-time').value = '10:00';
  $('apt-status').textContent = '';
  $('apt-status').className = 'apt-status';
  $('apt-submit').disabled = false;
  $('apt-submit').textContent = 'Xác nhận & gửi Zalo';

  $('apt-modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('apt-name').focus());
}

function closeAppointment() {
  $('apt-modal')?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/** Pre-validate: dùng chung, trả false nếu không hợp lệ. */
function _preValidateAppt() {
  const status = $('apt-status');
  status.className = 'apt-status apt-status--err';

  // Bot trap: honeypot — silent reject
  const hp = ($('apt-hp')?.value || '').trim();
  if (hp) {
    console.warn('[apt] honeypot triggered — silent reject');
    status.textContent = '';
    return false;
  }
  // Rate-limit
  try {
    const last = Number(localStorage.getItem('hs_last_apt') || 0);
    if (Date.now() - last < 60_000) {
      status.textContent = 'Vui lòng đợi 1 phút giữa 2 lần đặt lịch.';
      return false;
    }
  } catch {}

  const name = $('apt-name').value.trim();
  const phone = $('apt-phone').value.trim();
  const date = $('apt-date').value;
  const time = $('apt-time').value;
  if (!name)  { status.textContent = 'Vui lòng nhập họ tên'; return false; }
  if (!/^[0-9+\s.-]{8,15}$/.test(phone)) { status.textContent = 'Số điện thoại không hợp lệ'; return false; }
  if (!date || !time) { status.textContent = 'Vui lòng chọn ngày giờ'; return false; }

  const when = new Date(`${date}T${time}:00`);

  // VN rule: phải đặt trước giờ hiện tại + 1h (làm tròn lên)
  if (getRegion() === 'VN') {
    const earliest = getEarliestApptVN();
    if (when.getTime() < earliest.getTime()) {
      status.textContent = `Đặt lịch sớm nhất: ${_fmtHM(earliest)} ngày ${_fmtDMY(earliest)} (trước 1 tiếng so với hiện tại).`;
      return false;
    }
  } else {
    // TW: chỉ kiểm tra không phải quá khứ
    if (when.getTime() < Date.now() - 60000) {
      status.textContent = 'Không thể đặt lịch thời điểm đã qua';
      return false;
    }
  }

  status.textContent = '';
  status.className = 'apt-status';
  return true;
}

async function submitAppointment() {
  // Pre-validate mọi lần
  if (!_preValidateAppt()) return;
  // Token-bucket anti-spam (A) + auto-ban
  if (!_antiSpamOk('apt')) return;

  const status = $('apt-status');
  const name = $('apt-name').value.trim();
  const phone = $('apt-phone').value.trim();
  const date = $('apt-date').value;
  const time = $('apt-time').value;
  const listingId = $('apt-listing').value;
  const listingText = $('apt-listing').options[$('apt-listing').selectedIndex]?.text || '';
  const note = $('apt-note').value.trim();

  const payload = {
    name, phone, date, time,
    listingId: listingId || null,
    listingTitle: listingId ? listingText : null,
    note: note || null,
    status: 'pending',
  };

  $('apt-submit').disabled = true;
  $('apt-submit').textContent = 'Đang gửi...';

  // 1. Save to Firestore (best-effort)
  try {
    await addAppointment(payload);
    try { localStorage.setItem('hs_last_apt', String(Date.now())); } catch {}
  } catch (e) {
    console.warn('[apt] Firestore save failed, continuing:', e);
  }

  // 2. Send email notification (primary — reliable)
  await sendEmailNotification({ type: 'appointment', ...payload });

  // 3. Zalo backup — copy message + open app
  const message = buildZaloMessage(payload);
  try { await navigator.clipboard.writeText(message); } catch {}
  window.open(ADMIN_ZALO_URL, '_blank', 'noopener,noreferrer');

  status.innerHTML = '✓ Đã ghi nhận lịch hẹn! Bạn sẽ nhận xác nhận qua điện thoại trong vòng 30 phút.';
  status.className = 'apt-status apt-status--ok';

  $('apt-submit').disabled = false;
  $('apt-submit').textContent = 'Xác nhận & gửi Zalo';
}

function buildZaloMessage(p) {
  const lines = [
    'HOANGSAM.BDS — LỊCH HẸN XEM NHÀ MỚI',
    '',
    `Khách: ${p.name}`,
    `SĐT: ${p.phone}`,
    `Thời gian: ${p.time} · ngày ${formatDateVi(p.date)}`,
  ];
  if (p.listingTitle) lines.push(`Nhà: ${p.listingTitle}`);
  if (p.note) lines.push(`Ghi chú: ${p.note}`);
  lines.push('', '(Tự động từ website Hoàng Sâm)');
  return lines.join('\n');
}

function formatDateVi(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-');
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dt = new Date(`${yyyymmdd}T00:00:00`);
  return `${days[dt.getDay()]}, ${d}/${m}/${y}`;
}

/* ───────────────────────── Admin-only API key settings ───────────────────────── */

function wireSettings() {
  $('ai-settings-btn')?.addEventListener('click', openKeyDialog);
  $('ai-key-save')?.addEventListener('click', handleSaveKey);
  $('ai-key-cancel')?.addEventListener('click', closeKeyDialog);
}

function openKeyDialog() {
  if (!isAdmin()) return;
  $('ai-key-input').value = getApiKey();
  $('ai-key-dialog').hidden = false;
  requestAnimationFrame(() => $('ai-key-input').focus());
}
function closeKeyDialog() { $('ai-key-dialog').hidden = true; }
function handleSaveKey() {
  if (!isAdmin()) { closeKeyDialog(); return; }
  const key = $('ai-key-input').value.trim();
  if (!key) { $('ai-key-input').focus(); return; }
  setApiKey(key);
  closeKeyDialog();
  $('ai-no-key').hidden = true;
  flash($('ai-key-save'), 'Đã lưu');
}
