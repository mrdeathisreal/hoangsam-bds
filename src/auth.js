/**
 * auth.js
 * ----------------------------------------------------------------------------
 * Lớp xác thực admin cho hoangsam.bds.
 *
 * Triết lý:
 *   - KHÔNG auto-bật admin mode. Kể cả user đã login, nếu UID không nằm trong
 *     ADMIN_UIDS thì vẫn bị đối xử như guest ở tầng UI (Firestore rules đã
 *     block ghi ở server, nhưng UI cũng phải ẩn nút để tránh confuse).
 *   - Persistence = local → admin giữ đăng nhập sau khi đóng/mở tab.
 *   - Broadcast auth state qua subscribe() — ui-render chỉ cần lắng nghe,
 *     không cần tự gọi currentUser.
 *   - Error → message tiếng Việt.
 * ----------------------------------------------------------------------------
 */

import { app } from './firebase-config.js';
import {
  getAuth, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/* ───────────────────────── Config ─────────────────────────
 * Danh sách UID admin — PHẢI khớp với danh sách trong firestore.rules.
 * Đây chỉ là lớp UI (gate nút Add/Edit/Delete). Tầng ghi DB đã có
 * Security Rules bảo vệ thật sự.
 */
export const ADMIN_UIDS = [
  'uL3mjYlRkbbWh20ICNjAPFL1Sdh1',
];

export const auth = getAuth(app);

// Bảo đảm session persist qua reload. await ngầm — nếu fail vẫn chạy
// được nhưng user phải login lại mỗi lần mở tab.
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn('[auth] setPersistence failed:', e);
});

/* ───────────────────────── Module state ───────────────────────── */

let _currentUser = null;
let _isAdmin = false;
const _subs = new Set();

/* ───────────────────────── Error mapping ───────────────────────── */

function mapAuthError(err) {
  const code = err?.code || 'unknown';
  const table = {
    'auth/invalid-email':           'Email không hợp lệ.',
    'auth/invalid-credential':      'Email hoặc mật khẩu không đúng.',
    'auth/user-disabled':           'Tài khoản đã bị vô hiệu hoá.',
    'auth/user-not-found':          'Tài khoản không tồn tại.',
    'auth/wrong-password':          'Mật khẩu không đúng.',
    'auth/too-many-requests':       'Quá nhiều lần thử. Thử lại sau ít phút.',
    'auth/network-request-failed':  'Mất kết nối mạng. Kiểm tra wifi và thử lại.',
    'auth/missing-password':        'Vui lòng nhập mật khẩu.',
    'auth/weak-password':           'Mật khẩu quá yếu (tối thiểu 6 ký tự).',
    'auth/email-already-in-use':    'Email này đã có người dùng.',
  };
  return {
    code,
    message: table[code] || 'Đăng nhập thất bại. Vui lòng thử lại.',
    raw: err,
  };
}

/* ───────────────────────── Public API ───────────────────────── */

/**
 * initAuth — bắt đầu lắng nghe auth state. Gọi MỘT lần từ app.js.
 *
 * @returns {() => void} unsubscribe function
 */
export function initAuth() {
  return onAuthStateChanged(auth, (user) => {
    _currentUser = user;
    _isAdmin = !!user && ADMIN_UIDS.includes(user.uid);

    _notify({
      user,
      isSignedIn: !!user,
      isAdmin: _isAdmin,
      uid: user?.uid || null,
      email: user?.email || null,
    });
  });
}

/**
 * subscribe — đăng ký nhận thay đổi auth state.
 *
 * @param {(state: {user, isSignedIn, isAdmin, uid, email}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  _subs.add(fn);
  // Phát state hiện tại ngay để subscriber không phải chờ event đầu tiên
  fn({
    user: _currentUser,
    isSignedIn: !!_currentUser,
    isAdmin: _isAdmin,
    uid: _currentUser?.uid || null,
    email: _currentUser?.email || null,
  });
  return () => _subs.delete(fn);
}

/**
 * signIn — login bằng email + password.
 * @throws {{code, message, raw}} khi fail
 */
export async function signIn(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanEmail) throw { code: 'auth/invalid-email', message: 'Vui lòng nhập email.' };
  if (!cleanPass)  throw { code: 'auth/missing-password', message: 'Vui lòng nhập mật khẩu.' };

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);

    // Nếu login thành công nhưng UID không có trong allowlist → đá ra luôn
    if (!ADMIN_UIDS.includes(cred.user.uid)) {
      await fbSignOut(auth);
      throw {
        code: 'auth/not-admin',
        message: 'Tài khoản này không có quyền quản trị.',
      };
    }

    return {
      uid: cred.user.uid,
      email: cred.user.email,
    };
  } catch (err) {
    if (err.code && err.message && !err.raw) throw err; // đã là mapped error
    throw mapAuthError(err);
  }
}

/** signOut — đăng xuất admin. */
export async function signOut() {
  try {
    await fbSignOut(auth);
  } catch (err) {
    throw mapAuthError(err);
  }
}

/** Getters đồng bộ — dùng cho guard nhanh, KHÔNG thay thế subscribe(). */
export function getCurrentUser() { return _currentUser; }
export function isAdmin()        { return _isAdmin; }
export function isSignedIn()     { return !!_currentUser; }

/* ───────────────────────── Internal ───────────────────────── */

function _notify(state) {
  for (const sub of _subs) {
    try { sub(state); }
    catch (e) { console.error('[auth] subscriber threw:', e); }
  }
}
