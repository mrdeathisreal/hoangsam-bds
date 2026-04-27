/**
 * firebase-config.js
 * ----------------------------------------------------------------------------
 * Khởi tạo Firebase app + các service singletons. Không import gì từ module
 * khác của dự án → tránh circular dependency.
 *
 * ⚠️ Lấy config ở:
 *    Firebase Console → Project Settings (⚙️) → General
 *    → "Your apps" → biểu tượng </> (Web) → Firebase SDK snippet → Config
 *
 * 🔒 Các khoá này PUBLIC — an toàn để commit. Bảo mật thật nằm ở
 *    Firestore/Storage Security Rules. KHÔNG cần .env cho Firebase Web.
 * ----------------------------------------------------------------------------
 */

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            "AIzaSyDtmR0Hewb88z8NmFYpPqX12K02uNTy-Ls",
  authDomain:        "hoangsam-bds.firebaseapp.com",
  projectId:         "hoangsam-bds",
  storageBucket:     "hoangsam-bds.firebasestorage.app",
  messagingSenderId: "432890928819",
  appId:             "1:432890928819:web:44d84613566122d01d1ac6",
};

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
