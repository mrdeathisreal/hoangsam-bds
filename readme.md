# Hoàng Sâm BDS

> **Live site:** [hoangsam-bds.web.app](https://hoangsam-bds.web.app) · **Liên hệ:** Zalo 0909326188 · [nhhuy130@gmail.com](mailto:nhhuy130@gmail.com)

Website bất động sản chính chủ tại TP.HCM — minh bạch pháp lý, hình ảnh thật, có **AI tư vấn viên 24/7** nói được Tiếng Việt / English / 繁體中文.

---

## ⚠️ Bản quyền

Repo này **public chỉ với mục đích giới thiệu portfolio**. Toàn bộ mã nguồn, thiết kế, AI prompts, brand voice và nội dung là tài sản độc quyền — **không được fork, copy, hoặc sử dụng** dưới bất kỳ hình thức nào nếu không có văn bản chấp thuận. Xem [LICENSE](./LICENSE).

---

## Tính năng nổi bật

- 🏘️ **Quản lý tin đăng** — admin đăng/sửa/xoá realtime qua Firestore + Storage
- 🤖 **AI tư vấn viên Gemini 2.5** — chat trực tiếp với khách, biết toàn bộ tin đăng, multi-turn conversation
- 📅 **Đặt lịch xem nhà** — gửi email tự động qua Google Apps Script
- 🌐 **Đa ngôn ngữ i18n** — VI / EN / 繁體中文 (cho khách Đài Loan)
- 🔒 **Authentication** — Firebase Auth với role-based access (admin / CTV / khách)
- 📱 **Responsive** — mobile-first, PWA-ready

## Tech Stack

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | HTML + CSS + Vanilla JS (ES modules, không bundler) |
| Backend | Firebase Firestore · Auth · Storage · Hosting |
| AI Layer | Gemini 2.5 Flash qua Google Apps Script proxy |
| Email API | Google Apps Script Web App (Gmail) |
| CI/CD | GitHub Actions (4 pipelines: deploy + health check + Lighthouse + GAS monitoring) |

## Architecture

```
┌────────────┐         ┌──────────────────┐         ┌──────────┐
│  Browser   │ ───────▶│ Firebase Hosting │         │  Gemini  │
│ (Vanilla   │         │   (Static JS)    │         │   API    │
│   JS)      │         └──────────────────┘         └──────────┘
│            │                                            ▲
│            │         ┌──────────────────┐               │
│            │ ───────▶│ Firebase Firestore│              │
│            │         │  (listings, etc) │               │
│            │         └──────────────────┘               │
│            │                                            │
│            │         ┌──────────────────┐               │
│            │ ───────▶│  Google Apps     │ ─────────────▶│
└────────────┘         │  Script (Proxy)  │
                       │  - Email (Gmail) │
                       │  - AI Chat       │
                       └──────────────────┘
```

## Pipelines

- `firebase-deploy.yml` — Validate → Deploy → Health-check trên mỗi push main
- `lighthouse.yml` — Audit performance hàng tuần
- `gas-health.yml` — Test Gemini end-to-end mỗi sáng 7h VN

---

**© 2026 Marshall Ng — All Rights Reserved**
