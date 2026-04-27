# FIX10 — Preview modal + bỏ dedupe visual (fix bug lặp ảnh)

## Bản mới nhất (FIX10) — fixes thêm

### Bug "5 ảnh khác nhau, vị trí 4-5 lặp ảnh đầu"
**Nguyên nhân:** dHash dedupe visual với threshold 5/64 bit QUÁ gắt. Ảnh BĐS thường cùng bố cục (trời xanh ở trên, đất ở dưới, nhà ở giữa) → nhiều ảnh khác nhau bị coi là "trùng visual" → bị bỏ → số ảnh lưu < 5 → UI fallback lặp ảnh đầu.

**Fix:** **BỎ hẳn dedupe visual**. Giờ chỉ dedupe theo *exact byte match* (re-pick cùng file 2 lần trong 1 batch). 5 ảnh khác nhau chắc chắn vào đủ 5.

### Bug "lần thứ 2 báo lỗi"
**Nguyên nhân:** state cũ (button `disabled`, file input value, staging data) sót lại từ batch trước.

**Fix:** thêm `resetImagePickerState()` gọi khi (a) mở modal, (b) sau submit thành công, (c) khi bấm "Clear all". Reset mọi thứ: file input, staging, thumbnail grid, button state, status text.

### Preview modal — review trước khi lưu
Sau khi nén xong, **popup mới** hiện lên:
- Grid thumbnails (ảnh đã nén, kèm kích thước dưới từng ảnh)
- Nút **✕** trên mỗi ảnh → xoá riêng ảnh đó trước khi Apply
- **Apply these images** → ghi đè textarea (xoá toàn bộ ảnh cũ, thay bằng ảnh mới)
- **Cancel (keep old)** → không đụng gì đến form, ảnh cũ giữ nguyên

Textarea KHÔNG bị đụng cho đến khi bạn bấm Apply.

### Nút "Clear all" riêng
Bên cạnh nút "Pick images" có thêm nút **Clear all** (màu đỏ). Bấm sẽ xoá:
- Toàn bộ text trong textarea (URL / data-URL ảnh cũ)
- File input
- Staging / preview nếu đang có
- Status text
- Bất kỳ thumbnail nào đang hiển thị

Không có "rác" nào từ batch cũ sót lại ảnh hưởng batch mới.

---

## Từ FIX9++ (vẫn giữ)

### Giới hạn 5 ảnh / tin (giảm từ 20)
- `MAX_IMAGES_PER_LISTING = 5` trong `app.js`
- `validator.js`: `checkImages` chặn tại 5
- Hint i18n (VI / EN / ZH-Hant) + `index.html` đã đồng bộ "Tối đa 5 ảnh / tin"

### Luôn upload được — kể cả file 4K/8K
`compressImage` giờ dùng thuật toán **ladder 2 chiều** (dim + quality):
```
dimLadder     = [1600, 1280, 1024, 800, 640, 480, 360, 240]
qualityLadder = [0.82, 0.72, 0.62, 0.52, 0.42, 0.35, 0.3]
```
Thuật toán thử từng combo — nếu kết quả ≤ `targetBytes` (150KB) thì dừng ngay, nếu không thì luôn giữ bản nhỏ nhất. Kể cả ảnh iPhone HEIC/ProRAW 8K, bước cuối 240px × 0.3 quality sẽ xuống cỡ 5–15KB — **không bao giờ fail vì kích thước**.

### Messages bằng tiếng Anh
Tất cả hiệu ứng / status từ picker giờ là tiếng Anh:
- `Compressing 3/5...`
- `Uploaded 3 images (~380 KB) · cleared 2 old images · deduped 1 visual duplicate`
- `Upload failed — keeping 2 existing images.`
- `No valid image files — keeping 1 existing image.`

### Picker ảnh ở chế độ Admin (giữ từ FIX9+)
- **Thêm ảnh thành công → XOÁ toàn bộ ảnh cũ** (thay vì append). Chỉ giữ ảnh mới vừa chọn.
- **Thêm ảnh thất bại → GIỮ ảnh cũ** y nguyên. Báo lỗi kèm số ảnh cũ được giữ.
- **Tự dedupe ảnh trùng về visual**: dùng dHash (difference hash) 64-bit. 2 ảnh có Hamming distance ≤ 5 bit được coi là "giống visual" → chỉ giữ 1. Hoạt động ngay cả khi ảnh đã bị nén lại hoặc đổi quality.

Log trong Console khi dedupe:
```
[picker] ⊘ anh2.jpg is a visual duplicate of anh1.jpg (dist=3)
```


## 2 lỗi đã fix

### 1. "Không thêm nhiều ảnh được bằng file img"

**Nguyên nhân có thể:** một trong các khả năng sau, đã xử lý hết:
- `<input type="file" hidden>` — một số phiên bản iOS Safari bỏ qua `.click()` trên input có `hidden`. Đã đổi sang dùng `class="visually-hidden"` (CSS ẩn nhưng input vẫn click được).
- `compressImage` lỗi lặng: nếu 1 ảnh nén lỗi, toàn bộ đợt bị bỏ qua mà không báo. Đã log per-file vào Console + báo toast chi tiết.
- Tổng dung lượng vượt ~900KB: Firestore giới hạn document 1 MiB → validator reject khi submit. Đã kiểm ngưỡng NGAY trong picker, dừng sớm và báo rõ.

**Cách test:**
1. Mở DevTools (F12) → tab Console
2. Bấm "Chọn ảnh từ máy" → chọn 3-5 ảnh cùng lúc
3. Xem Console log: `[picker] received N file(s): ...` + `[picker] ✓ ảnh.jpg → 120 KB` cho từng ảnh
4. Nếu có ảnh bị bỏ, log sẽ hiện `[picker] skip file: tenfile.jpg` + lý do

### 2. "Không đăng bài mới được"

**Nguyên nhân phổ biến nhất:** `firestore.rules` chưa được deploy lên Firebase Console.
Netlify chỉ phục vụ file tĩnh (HTML/CSS/JS). **Firestore rules PHẢI deploy riêng** qua:

> Firebase Console → Firestore Database → Rules → dán nội dung file `rules/firestore.rules` → **Publish**

Nếu rules cũ không chấp nhận field `featured` / `bedrooms=0` / v.v., mọi lần ghi sẽ bị reject với `permission-denied`.

**Cách test sau khi deploy rules:**
1. Mở site → đăng nhập admin (gõ `#admin` vào URL hoặc triple-click logo)
2. Bấm "Thêm tin" → điền form → bấm "Đăng tin"
3. Nếu lỗi, toast giờ sẽ hiện dạng `title: Tiêu đề quá ngắn...` hoặc `Bạn không có quyền... [permission-denied]`
4. Mở Console xem log chi tiết: `[store] addListing Firestore error: permission-denied ...`

## Thay đổi kỹ thuật

| File | Thay đổi |
|---|---|
| `app.js` | `wireListingFormEvents`: log lỗi + hiển thị field lỗi lên toast. Sửa coerce number để input="0" không bị bỏ qua. |
| `app.js` | `_handleImageFiles`: per-file logging, chặn vượt 900KB, reduce targetBytes 150KB. |
| `app.js` | `wireImagePicker`: thêm log chẩn đoán. |
| `index.html` | `<input id="image-file">`: `hidden` → `class="visually-hidden"`. |
| `src/store.js` | `addListing`, `updateListing`: log payload keys + lỗi Firestore vào Console. |

## Deploy

### Netlify (hosting file tĩnh)
Chỉ cần kéo-thả toàn bộ folder này vào Netlify (Drag-and-drop) hoặc:
```bash
netlify deploy --prod --dir .
```

### Firebase Console (rules — làm RIÊNG)
1. Đăng nhập Firebase Console: https://console.firebase.google.com
2. Chọn project `hoangsam-bds`
3. Firestore Database → tab **Rules**
4. Dán nội dung `rules/firestore.rules` vào
5. Bấm **Publish**

Không làm bước này = mọi ghi sẽ fail. Đây là lỗi Bug 2 phổ biến nhất.
