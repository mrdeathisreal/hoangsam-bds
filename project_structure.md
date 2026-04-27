# Cấu trúc thư mục — hoangsam.bds (Product Level)

## Cây thư mục khuyến nghị

```
hoangsam-bds/
├── index.html                 # Entry point duy nhất (SPA)
├── app.js                     # Controller — điều phối mọi module
├── styles.css                 # Global styles + design tokens
│
├── src/
│   ├── firebase-config.js     # Khởi tạo app, export {app, db, auth, storage}
│   ├── auth.js                # signIn / signOut / onAuthChange / isAdmin
│   ├── store.js               # CRUD + onSnapshot + client-side filter
│   ├── ui-render.js           # renderCards / renderSkeleton / renderEmpty / toast
│   ├── validator.js           # validateListing / sanitize / rules
│   └── utils.js               # price parser, slug, escapeHtml, debounce
│
├── rules/
│   └── firestore.rules        # Copy-paste vào Firebase Console / deploy CLI
│
├── public/                    # (tuỳ chọn) ảnh tĩnh, favicon, og-image
│   └── placeholder.jpg
│
├── .env.local                 # KHÔNG commit — chứa API keys local
├── .gitignore                 # node_modules, .env*, .DS_Store, .firebase/
├── firebase.json              # Firebase CLI config (hosting + rules)
├── README.md
└── ROADMAP.md
```

## Vì sao chọn cấu trúc này

### 1. `app.js` ở root, không nằm trong `/src`
- Là **entry point** của `<script type="module" src="./app.js">` trong `index.html`.
- Đặt ngang hàng với `index.html` để đường dẫn import rõ ràng: `import { ... } from './src/store.js'`.
- Nếu đẩy `app.js` vào `/src`, bạn sẽ phải viết `../src/store.js` — lộn xộn.

### 2. Mỗi module có **một trách nhiệm duy nhất** (Single Responsibility)

| File | Job | KHÔNG được làm |
|------|-----|----------------|
| `firebase-config.js` | Init app, export singletons | Truy vấn data, render DOM |
| `auth.js` | Login state + hooks | Render form, validate input |
| `store.js` | Firestore I/O + filter | Đụng DOM |
| `ui-render.js` | Vẽ DOM từ data | Fetch data, validate |
| `validator.js` | Pure functions check input | Fetch, render |
| `utils.js` | Helpers dùng chung | Phụ thuộc vào Firebase |
| `app.js` | Wire tất cả lại | Logic nghiệp vụ (gọi sang module) |

Nguyên tắc: **Nếu xoá `ui-render.js`, `store.js` vẫn chạy được** (chỉ là không có UI). Tách sạch như vậy giúp test, refactor, và đổi UI framework sau này cực dễ.

### 3. `rules/firestore.rules` tách riêng
- Khi bạn chạy `firebase deploy --only firestore:rules`, CLI đọc từ đường dẫn khai báo trong `firebase.json`.
- Tách riêng giúp review rules như code, đưa vào PR, không lẫn với logic client.

### 4. Không dùng bundler (Vite/Webpack)
- Đúng scale của bạn (10-20 listings). Bundler thêm độ phức tạp mà chưa cần.
- CDN import trực tiếp Firebase v10 modular SDK — cold start nhanh, cache tốt.
- Khi nào > 100 listings hoặc cần TypeScript/JSX → migrate sang Vite.

## Quy ước import

```javascript
// app.js (root)
import { app, db, auth } from './src/firebase-config.js';
import { signIn, onAuthChange } from './src/auth.js';
import { initStore, addListing, filterListings } from './src/store.js';
import { renderCards, showToast } from './src/ui-render.js';
import { validateListing } from './src/validator.js';
import { parsePrice, generateSlug } from './src/utils.js';
```

```javascript
// src/store.js — import từ cùng thư mục
import { db } from './firebase-config.js';
import { parsePrice } from './utils.js';
```

**Luôn dùng extension `.js` đầy đủ** — browser native ESM KHÔNG tự resolve extension như Node.

## `.gitignore` bắt buộc

```
node_modules/
.env
.env.local
.env.*.local
.DS_Store
.firebase/
firebase-debug.log
dist/
```

## `firebase.json` mẫu

```json
{
  "firestore": {
    "rules": "rules/firestore.rules",
    "indexes": "rules/firestore.indexes.json"
  },
  "storage": {
    "rules": "rules/storage.rules"
  },
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "rules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
