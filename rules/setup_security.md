# Hướng dẫn thiết lập Firebase Security Rules

Mục tiêu: **chỉ admin được ghi dữ liệu**, guest chỉ đọc được listings. Dưới đây là flow 6 bước, đi từ "chưa có gì" đến "rules đang chạy trên production".

---

## Bước 1 — Bật Firebase Authentication (nếu chưa)

1. Vào [Firebase Console](https://console.firebase.google.com/) → chọn project.
2. Menu trái → **Authentication** → **Get started**.
3. Tab **Sign-in method** → bật **một trong hai** (hoặc cả hai):
   - **Email/Password** — đơn giản nhất, không cần domain verify.
   - **Google** — login 1-click, tự động verify email.
4. Tab **Users** → **Add user** (nếu dùng Email/Password) → tạo account admin cho chính bạn (vd: `admin@hoangsam.bds`).

---

## Bước 2 — Lấy UID của admin

Mỗi user sau khi đăng nhập sẽ có một UID duy nhất (vd: `X7k3pQm9n2fD4jT8...`).

**Cách 1: từ Console**
- Authentication → Users → copy cột **User UID** của account admin.

**Cách 2: từ code (khi đã login)**
```javascript
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
console.log(getAuth().currentUser?.uid);
```

---

## Bước 3 — Nhét UID vào rules

Mở `rules/firestore.rules` và `rules/storage.rules`, thay:

```javascript
function isAdmin() {
  return request.auth != null
      && request.auth.uid in [
           'YOUR_ADMIN_UID_HERE'   // ← dán UID thật vào đây
         ];
}
```

Nếu có nhiều admin (vd: bạn + vợ/chồng):
```javascript
&& request.auth.uid in [
     'X7k3pQm9n2fD4jT8abc...',
     'a8Bd2cN7pQ9mRxT3xyz...'
   ];
```

> ⚠️ **KHÔNG dùng email làm danh tính admin** — email trong `request.auth.token.email` có thể thay đổi/unverified. UID là immutable.

---

## Bước 4 — Deploy rules

### Cách A: Dán vào Firebase Console (nhanh, phù hợp lần đầu)

**Firestore Rules**
1. Console → **Firestore Database** → tab **Rules**.
2. Xoá hết nội dung cũ, dán toàn bộ `firestore.rules`.
3. Bấm **Publish**.

**Storage Rules**
1. Console → **Storage** → tab **Rules**.
2. Dán `storage.rules` → **Publish**.

### Cách B: Dùng Firebase CLI (chuẩn production, version-controlled)

```bash
# Cài một lần
npm install -g firebase-tools
firebase login

# Trong thư mục project
firebase init firestore          # chọn project sẵn có, rules file = rules/firestore.rules
firebase init storage            # rules file = rules/storage.rules

# Deploy
firebase deploy --only firestore:rules,storage
```

Nội dung `firebase.json` sẽ trông như:
```json
{
  "firestore": { "rules": "rules/firestore.rules" },
  "storage":   { "rules": "rules/storage.rules" }
}
```

---

## Bước 5 — Test rules bằng Rules Playground

Firestore Console → tab **Rules** → bấm **Rules Playground** (góc phải):

### Test 1 — Guest đọc được listings
- Location: `/databases/(default)/documents/houses/test123`
- Simulation type: **get**
- Authenticated: **OFF**
- → phải **Allow**. ✅

### Test 2 — Guest KHÔNG tạo được
- Simulation type: **create**
- Authenticated: **OFF**
- Document data (JSON):
  ```json
  { "title": "Hack", "location": "ABC", "priceValue": 1000000000, "priceLabel": "1 tỷ", "slug": "hack" }
  ```
- → phải **Deny**. ✅

### Test 3 — User random KHÔNG tạo được
- Authenticated: **ON** → Firebase UID = `fake-uid-not-admin`
- Simulation type: **create**
- → phải **Deny**. ✅

### Test 4 — Admin tạo được
- Authenticated: **ON** → Firebase UID = UID thật của bạn
- Simulation type: **create**
- Document data: hợp lệ (có đủ title, location, priceValue, priceLabel, slug, và `createdAt` sẽ được auto-fill bởi `request.time`)
- → phải **Allow**. ✅

Nếu bất kỳ test nào sai kỳ vọng, kiểm tra lại UID trong rules.

---

## Bước 6 — Bỏ chế độ test mode (nếu đang dùng)

Khi tạo Firestore mới, Google thường hỏi chọn:
- **Test mode**: `allow read, write: if request.time < ...;` — HẾT HẠN SAU 30 NGÀY.
- **Production mode**: deny mặc định.

Sau khi deploy rules ở Bước 4, rules của bạn sẽ **ghi đè** test mode → an toàn.

Có thể kiểm tra lại bằng cách vào tab Rules, xem nội dung phải khớp với file `firestore.rules` bạn đã viết.

---

## Pattern bổ sung: Custom Claims (khi scale thêm nhiều admin)

Với > 5 admin, hard-code UID trong rules sẽ cồng kềnh. Dùng **Custom Claims**:

```javascript
// Chạy 1 lần bằng Admin SDK / Cloud Functions
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

Rồi trong rules đổi:
```javascript
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

Với dự án gia đình (1-3 admin), hard-code UID là đủ — đơn giản, không phụ thuộc backend.

---

## Checklist hoàn tất

- [ ] Bật Authentication (Email/Password hoặc Google)
- [ ] Tạo account admin, copy UID
- [ ] Thay `YOUR_ADMIN_UID_HERE` trong `firestore.rules` + `storage.rules`
- [ ] Deploy rules (Console hoặc CLI)
- [ ] Test 4 scenario trong Rules Playground
- [ ] Kiểm tra client code: thử tạo listing khi **chưa** đăng nhập → phải fail với `permission-denied`
- [ ] Kiểm tra client code: đăng nhập admin → tạo listing OK

Khi cả 7 mục trên đều ✅, Firestore của bạn đã an toàn cho production.
