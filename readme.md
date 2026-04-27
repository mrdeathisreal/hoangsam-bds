# hoangsam.bds

Site bất động sản cá nhân — modular, realtime, bảo mật. Vanilla JS + Firebase, không bundler.

**Tech stack:** HTML + CSS + ES modules · Firebase Firestore · Firebase Auth (Email/Password) · Firebase Storage · Firebase Hosting (tuỳ chọn).

---

## Bản đồ file

```
hoangsam-bds/
├── index.html               # UI layout — Bento grid + Filter + 2 Modals
├── app.js                   # Controller — wire tất cả module
├── styles.css               # Toàn bộ CSS với CSS Variables
├── firebase.json            # Cấu hình deploy CLI
├── .gitignore
│
├── src/
│   ├── firebase-config.js   # ⚠️  DÁN firebaseConfig thật vào đây
│   ├── auth.js              # ⚠️  DÁN ADMIN_UIDS thật vào đây
│   ├── store.js             # Firestore CRUD + onSnapshot + client filter
│   ├── ui-render.js         # Card, Skeleton, Toast, Modal
│   ├── validator.js         # Validate + sanitize input
│   ├── utils.js             # parsePrice, generateSlug, escapeHtml
│   └── seed.js              # 5 tin mẫu để test nhanh
│
└── rules/
    ├── firestore.rules      # ⚠️  DÁN UID admin vào đây
    ├── storage.rules        # ⚠️  DÁN UID admin vào đây
    └── SETUP_SECURITY.md    # Hướng dẫn deploy rules
```

---

## 3 giá trị anh cần dán vào code

| Chỗ dán | Lấy ở đâu | Thay cho |
|---|---|---|
| `src/firebase-config.js` → block `firebaseConfig` | Firebase Console → Project Settings → Your apps → Web → SDK snippet | 6 placeholder `"AIza...REPLACE_ME..."` etc. |
| `src/auth.js` → mảng `ADMIN_UIDS` | Firebase Console → Authentication → Users → cột User UID | `'YOUR_ADMIN_UID_HERE'` |
| `rules/firestore.rules` + `rules/storage.rules` → hàm `isAdmin()` | Cùng UID ở trên | `'YOUR_ADMIN_UID_HERE'` (có ở 2 file rules) |

Cả 2 chỗ dùng UID phải **khớp nhau** — đổi 1 chỗ thì phải đổi chỗ kia.

---

## Chạy lần đầu (tóm tắt)

Chi tiết ở **[SETUP_MAC.md](./SETUP_MAC.md)**, đây là phiên bản 1 phút:

```bash
# 1. Vào thư mục dự án
cd ~/Projects/hoangsam-bds

# 2. Chạy local server (Python có sẵn trên Mac)
python3 -m http.server 8080

# 3. Mở http://localhost:8080
```

Lần đầu vào với admin đăng nhập → click **Nạp 5 tin mẫu** ở empty state để có data test ngay.

---

## Deploy lên internet

### Với Firebase CLI (khuyến nghị — cùng hệ sinh thái)

```bash
npm install -g firebase-tools
firebase login
firebase init              # chọn Firestore, Storage, Hosting → link project có sẵn
firebase deploy            # deploy cả 3 trong 1 lệnh
```

`firebase.json` đã được cấu hình sẵn trong repo — lần init sau sẽ hỏi có overwrite không, chọn **No** để giữ config này.

### Với Vercel (nhanh hơn nữa)

```bash
npm install -g vercel
vercel
```

Enter qua hết — defaults cho static site là đủ. Xong được URL `.vercel.app`.

---

## Các lệnh hằng ngày

```bash
# Chạy local để phát triển
python3 -m http.server 8080

# Deploy rules riêng (không deploy hosting)
firebase deploy --only firestore:rules,storage

# Deploy hosting riêng
firebase deploy --only hosting

# Xem log hosting
firebase hosting:channel:list
```

---

## Luồng data

```
 Firestore ─onSnapshot─> store._cache ─subscribe─> app.state.listings
                                                        │
                                                        ▼
                                         filterListings(query, area, price)
                                                        │
                                                        ▼
                            renderCards → DOM (+ renderEmpty / renderSkeleton)

 User form ─submit─> validator ─pass─> store.addListing ─> Firestore ─(loop)
                        │fail
                        ▼
                 highlightErrors + toast

 Auth ─onAuthStateChanged─> auth._state ─subscribe─> app ─> updateAdminUI
                                                              │
                                                              ▼
                             data-admin-only elements show/hide
```

---

## Debug nhanh

| Hiện tượng | Thử ngay |
|---|---|
| Grid loading mãi | Console → Network tab → check `firestore.googleapis.com` 200 OK không. Sai config → 400. |
| `permission-denied` | UID trong `auth.js` vs `firestore.rules` không khớp, hoặc rules chưa publish. |
| `auth/invalid-credential` | Sai email/password, hoặc chưa bật Email/Password trong Authentication. |
| MIME type error khi load `.js` | Đang mở `file://` thay vì `http://` — phải qua local server. |
| Toast không hiện | Console có lỗi JS đỏ? Check script `type="module"` đúng chưa. |
| Click card không mở map | Tin chưa có `coordinates` — optional, skip được. |

---

## Roadmap

- [x] Phase 1 — Modular architecture + Firebase
- [x] Phase 2 — Auth admin + Security Rules
- [ ] Phase 3 — Image upload qua Firebase Storage (hiện đang paste URL)
- [ ] Phase 4 — SEO + Astro static generation
- [ ] Phase 5 — Lead generation form + email notify
- [ ] Phase 6 — Multi-agent support

---

## Liên hệ chủ trang

Trang dành riêng cho danh mục BĐS cá nhân. Admin: **Marshall Ng** · nhhuy130@gmail.com
