# Chạy hoangsam.bds trên Mac — Từ 0 tới live

Tài liệu này đưa anh từ "mới download file" → "site chạy thật trên browser" trong khoảng 20 phút. Không cần kiến thức backend, chỉ cần Terminal.

---

## Checklist cây file

Trước khi bắt đầu, kiểm tra thư mục dự án có đủ:

```
hoangsam-bds/
├── index.html
├── app.js
├── styles.css
├── src/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── store.js
│   ├── ui-render.js
│   ├── validator.js
│   └── utils.js
└── rules/
    ├── firestore.rules
    ├── storage.rules
    └── SETUP_SECURITY.md
```

Nếu thiếu file nào → copy lại từ thư mục này.

---

## Bước 1 — Copy dự án về máy

Mở **Terminal** (`⌘ + Space` → gõ "Terminal"):

```bash
# Tạo thư mục Projects nếu chưa có
mkdir -p ~/Projects
cd ~/Projects

# Copy toàn bộ từ folder Cowork outputs sang
cp -R "/đường/dẫn/tới/outputs" ./hoangsam-bds
cd hoangsam-bds

# Xoá rác Mac tạo ra
find . -name ".DS_Store" -delete

# Kiểm tra
ls -la
```

Phải thấy `index.html`, `app.js`, `styles.css`, `src/`, `rules/`.

---

## Bước 2 — Tạo Firebase project

1. Mở https://console.firebase.google.com → **Add project**.
2. Tên: `hoangsam-bds` (hoặc gì tuỳ anh). Bỏ Google Analytics cho đơn giản → **Create**.
3. Sau khi tạo xong, **Project settings** (⚙️ góc trái) → tab **General** → cuộn xuống **Your apps** → bấm icon **`</>`** (Web).
4. App nickname: `hoangsam-bds-web` → **Register app**. Bỏ qua tick "Firebase Hosting" bước này, mình cài CLI sau.
5. Màn hình tiếp theo hiện khối code `const firebaseConfig = {...}`. **Copy nguyên khối này**, chốc nữa sẽ dán.

Bật các service cần dùng:

- **Build → Firestore Database** → **Create database** → chọn **production mode** → chọn region `asia-southeast1` (Singapore, gần VN nhất).
- **Build → Authentication** → **Get started** → tab **Sign-in method** → bật **Email/Password**.
- **Build → Authentication** → tab **Users** → **Add user** → tạo tài khoản admin (vd: `admin@hoangsam.bds` / password bất kỳ ≥ 6 ký tự). Copy **User UID** của account này — sẽ cần ở Bước 4.

---

## Bước 3 — Dán config vào code

Mở `src/firebase-config.js` trong editor bất kỳ (VS Code, Sublime, hoặc `open -a TextEdit src/firebase-config.js` trong Terminal), thay block `firebaseConfig` bằng block anh copy từ Firebase Console:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",   // ← giá trị thật từ Firebase
  authDomain:        "hoangsam-bds.firebaseapp.com",
  projectId:         "hoangsam-bds",
  storageBucket:     "hoangsam-bds.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:1234:web:abcdef1234567890",
};
```

Save file.

> 💡 Các khoá này PUBLIC — an toàn để commit lên Git. Bảo mật thật nằm ở Security Rules.

---

## Bước 4 — Dán UID admin vào code + rules

Copy **User UID** anh lấy ở Bước 2.

### 4.1 — `src/auth.js`

Tìm:
```javascript
export const ADMIN_UIDS = [
  'YOUR_ADMIN_UID_HERE',
];
```

Thay thành UID thật:
```javascript
export const ADMIN_UIDS = [
  'X7k3pQm9n2fD4jT8abc...',  // UID của anh
];
```

### 4.2 — `rules/firestore.rules` + `rules/storage.rules`

Tìm `YOUR_ADMIN_UID_HERE` trong cả hai file, thay bằng cùng UID đó.

---

## Bước 5 — Deploy Security Rules

**Cách nhanh nhất (dán vào Console):**

1. Firebase Console → **Firestore Database** → tab **Rules** → xoá sạch, dán nội dung `rules/firestore.rules` → **Publish**.
2. Firebase Console → **Storage** → tab **Get started** (nếu chưa bật) → chọn production mode, region `asia-southeast1` → bật xong vào tab **Rules** → dán `rules/storage.rules` → **Publish**.

Test nhanh: vào tab **Rules** → **Rules playground** → simulate `create` trên `/houses/test` với `Authenticated: OFF` → phải **Deny**. ✅

---

## Bước 6 — Chạy local server

**QUAN TRỌNG:** Mở file `index.html` bằng cách double-click (file://...) sẽ KHÔNG chạy được vì ES modules + Firebase cần origin `http://` hoặc `https://`. Bắt buộc chạy qua HTTP server.

Mac có sẵn Python 3. Trong terminal, tại thư mục dự án:

```bash
cd ~/Projects/hoangsam-bds
python3 -m http.server 8080
```

Mở browser: **http://localhost:8080**

Dừng server: `Ctrl + C`.

### Tuỳ chọn khác (nếu có Node.js)

```bash
npx serve -p 8080
```

Hoặc cài VS Code extension **Live Server** → right-click `index.html` → "Open with Live Server" (port mặc định 5500).

---

## Bước 7 — Test end-to-end

Mở **http://localhost:8080**:

1. **Guest view**: thấy hero, filter bar, nhưng grid rỗng (chưa có tin). Nút "Thêm tin" bị ẩn. ✅
2. Bấm **Đăng nhập** → nhập email/password admin → xuất hiện chip "Admin" ở header + nút "Thêm tin". ✅
3. Bấm **Thêm tin** → điền form (tối thiểu: Tiêu đề, Địa chỉ, Giá "9.8 tỷ") → **Đăng tin** → toast xanh "Đã đăng tin mới thành công." + card hiện ngay trong grid. ✅
4. **F12 → Console** → không có lỗi đỏ. (Nếu có `permission-denied` → kiểm tra lại UID trong rules đã khớp.)
5. Mở tab Chrome thứ 2 cùng URL → thử thêm tin ở tab 1, tab 2 tự hiện ngay (onSnapshot realtime). ✅
6. Thử **Đăng xuất** → nút admin biến mất, card mất nút Edit/Delete. Cố gọi xoá qua DevTools → Firestore từ chối ở server. ✅
7. Gõ vào **search bar** — sau 250ms mới lọc (debounce). ✅

---

## Bước 8 — Deploy lên internet

### Cách A: Firebase Hosting (khuyến nghị — cùng hệ sinh thái)

```bash
# Cài Firebase CLI một lần
npm install -g firebase-tools

# Login
firebase login

# Trong thư mục dự án
firebase init hosting
# Chọn:
#  - Use existing project → chọn project vừa tạo
#  - Public directory: .       (CHÚ Ý: dấu chấm, không phải "public")
#  - Single-page app: No
#  - Set up automatic builds with GitHub: No

# Deploy
firebase deploy --only hosting
```

Output sẽ in URL kiểu `https://hoangsam-bds.web.app`. Đó là site live.

### Cách B: Vercel (đơn giản hơn nữa)

```bash
npm install -g vercel
cd ~/Projects/hoangsam-bds
vercel
# Nhấn Enter qua các câu hỏi — default settings đều ok cho static site
```

Xong → có URL `https://hoangsam-bds-xxxx.vercel.app`.

---

## Gặp lỗi? Debug checklist

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Grid hiển thị skeleton mãi không tải | Sai `firebaseConfig` → mở Console tab Network, check request `firestore.googleapis.com` có 200 OK không |
| `permission-denied` khi thêm tin | UID admin chưa sync giữa `auth.js` và `firestore.rules`, hoặc rules chưa publish |
| `auth/invalid-credential` | Sai email hoặc password, hoặc chưa bật Email/Password ở Authentication |
| File .js tải về nhưng báo "MIME type" | Anh đang mở `file://` thay vì `http://localhost` — phải chạy python server |
| CORS error với `gstatic.com` | Wifi trường học/công ty chặn Google CDN → thử hotspot điện thoại |
| Toast không hiện | Kiểm tra Console xem có JS error chặn script chạy không |
| Click Google Maps không mở | Tin đăng chưa có `coordinates` — field optional, skip được |

---

## Git (optional, khuyên dùng)

```bash
cd ~/Projects/hoangsam-bds
git init
cat > .gitignore <<EOF
.DS_Store
node_modules/
.firebase/
firebase-debug.log
.env.local
EOF

git add .
git commit -m "Initial commit — hoangsam.bds modular architecture"

# Push lên GitHub (tạo repo trống trước trên github.com)
git remote add origin https://github.com/YOUR_USER/hoangsam-bds.git
git branch -M main
git push -u origin main
```

---

## Tóm tắt lệnh chạy hằng ngày

```bash
cd ~/Projects/hoangsam-bds
python3 -m http.server 8080
# mở http://localhost:8080
```

Đóng terminal = tắt server. Code edit → reload browser → thấy thay đổi ngay, không cần build.
