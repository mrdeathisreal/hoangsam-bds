# Security Policy — Hoàng Sâm · hoangsam.bds

Cảm ơn bạn đã quan tâm đến bảo mật của dự án này. Trang `hoangsam.bds` là website bất động sản dùng Firebase + Netlify, lưu trữ thông tin công khai (tin đăng, bình luận) và form đặt lịch khách hàng.

## Supported Versions

Chỉ commit mới nhất trên branch `main` được hỗ trợ vá lỗi.

| Version                        | Supported          |
| ------------------------------ | ------------------ |
| `main` (HEAD)                  | :white_check_mark: |
| Previous deploys trên Netlify  | :x:                |

## Scope — In Scope (ưu tiên nhận báo cáo)

- **Firestore Security Rules** — nếu bạn có thể đọc/ghi dữ liệu ngoài quyền cho phép (vd: khách tạo/sửa/xoá tin đăng, đọc `appointments`/`contacts`)
- **Firebase Auth** — bypass admin check, escalate privilege
- **Netlify deploy** — inject script qua PR, pollute Netlify build config
- **XSS** — inject script qua form (title, comment, appointment note...)
- **API key exfil** — lấy được Gemini API key của admin qua network / storage
- **Rate-limit bypass** — spam vượt 5/10min, 10/24h ở `comments`/`appointments`

## Out of Scope

- Denial of Service qua flood (trách nhiệm của Netlify/Firebase)
- Thông tin Firebase Web config trong source — đây là **public by design**
- Phishing, social engineering nhân viên
- Tấn công vật lý vào máy của admin
- Vulnerabilities trong Firebase SDK / Gemini API (báo cho Google)

## Reporting a Vulnerability

### Cách báo
Gửi 1 trong 3 kênh dưới, **không** mở public issue / public PR:

1. **Email**: `nhhuy130@gmail.com` — kèm chủ đề bắt đầu bằng `[SECURITY]`
2. **Zalo riêng**: `0909326188` (Marshall Ng)
3. **GitHub Security Advisory**: https://github.com/mrdeathisreal/hoangsam-bds/security/advisories/new (private, chỉ maintainer thấy)

### Nội dung báo cáo
Xin vui lòng cung cấp:
- Mô tả vulnerability
- Bước tái hiện (proof of concept)
- Impact đánh giá (data leak / privilege escalation / DoS / XSS...)
- Phiên bản/commit hash bạn test
- Thông tin liên hệ để chúng tôi phản hồi

### Timeline phản hồi

| Giai đoạn        | Thời gian      |
| ---------------- | -------------- |
| Xác nhận đã nhận | Trong 48 giờ   |
| Đánh giá ban đầu | Trong 7 ngày   |
| Fix hoặc phản hồi | Trong 30 ngày |
| Public disclosure | Sau khi fix + 14 ngày |

### Nếu báo cáo được chấp nhận

- Bạn sẽ được ghi công trong `CHANGELOG.md` (nếu muốn)
- Hotfix sẽ được deploy lên Netlify trong 72 giờ
- Commit fix sẽ tham chiếu advisory number

### Nếu báo cáo bị từ chối

Chúng tôi sẽ giải thích lý do (trùng với báo cáo trước, out of scope, không tái hiện được...) trong vòng 7 ngày.

## Safe Harbor

Chúng tôi cam kết không theo đuổi pháp lý với researcher thực hiện security testing thiện chí, miễn là bạn:

- **Không** truy cập / thay đổi / xoá dữ liệu của người dùng thật
- **Không** thực hiện DoS/DDoS
- **Không** công khai vulnerability trước khi chúng tôi xác nhận đã fix
- **Không** sử dụng social engineering với nhân viên / khách hàng
- Dừng ngay khi được yêu cầu

## Hardening đã áp dụng

Tham khảo — để researcher biết những gì đã có:

- Content Security Policy (CSP) + X-Frame-Options: DENY + HSTS 1 năm — xem `netlify.toml`
- Firestore Rules: admin UID whitelist, type-check mọi field, key whitelist — xem `rules/firestore.rules`
- Storage Rules: admin-only write, ≤5MB, chỉ `image/*` — xem `rules/storage.rules`
- XSS protection: `escapeHtml()` mọi user input trong `src/ui-render.js`
- Honeypot + rate-limit 5/10min + auto-ban trong `src/ai-ui.js` + `app.js`
- Gemini API key: chỉ lưu localStorage máy admin, không gửi server nào khác

## Credit

Maintainer: Marshall Ng — `nhhuy130@gmail.com` — https://github.com/mrdeathisreal

---

**Lưu ý cho public researcher**: dự án này chạy production với khách hàng thật. Vui lòng tôn trọng dữ liệu cá nhân (số điện thoại, lịch hẹn) khi testing.
