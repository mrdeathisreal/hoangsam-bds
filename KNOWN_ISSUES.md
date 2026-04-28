# Known Issues

## 🟡 Gemini Free Tier quota hạn chế (cần xử lý)

**Tình trạng**: Free tier Google Gemini API có giới hạn rất chặt:
- `gemini-2.0-flash`: **15 requests/phút** + **200 requests/ngày**
- `gemini-2.5-flash`: **10 requests/phút** + **200 requests/ngày**
- Quota reset: 00:00 Pacific Time (= **15:00 VN**)

**Khi hit limit**: GAS tự trả về message tiếng Việt thân thiện
> *"Em đang có nhiều khách hỏi cùng lúc, anh/chị cho em vài giây rồi gửi lại câu hỏi nha."*

**Phát hiện**: ngày 28/04/2026 trong lúc test heavy → hit 200/day cho cả gemini-2.0 và gemini-2.5.

### Hướng xử lý khi sẵn sàng

**A. Upgrade Tier 1 (recommend)**
- Vào https://aistudio.google.com/billing → set up billing
- Tự lên Tier 1: 2,000 RPM + 4M req/ngày
- Chi phí ước tính: $0.10/1M input + $0.40/1M output → cho website BDS thường < $5/tháng

**B. Multi-key fallback**
- Tạo 2-3 Gemini API key từ các Google account khác nhau
- Update `gas/email-api.gs` để xoay vòng giữa các key khi 1 cái hit limit
- Code mẫu:
  ```javascript
  const KEYS = ['AIza...1', 'AIza...2', 'AIza...3'];
  let lastKeyIdx = 0;
  function getNextKey() {
    lastKeyIdx = (lastKeyIdx + 1) % KEYS.length;
    return KEYS[lastKeyIdx];
  }
  ```

**C. Cache common Q&A**
- Cache câu hỏi phổ biến ("vay ngân hàng?", "có nhà q8?") trong Firestore
- Trả lời từ cache thay vì gọi Gemini → tiết kiệm 80%+ requests

### Production reality
Khách thực tế ít khi hit 200/ngày — đa số chỉ chat 5-10 lượt rồi book. Vấn đề này CHỦ YẾU xảy ra khi automated test hoặc traffic spike.

---

## ✅ Đã giải quyết

### Chat UI Messenger-style (28/04/2026)
- Avatar bubble (B = user, 🏠 = AI)
- Gradient teal-blue + animation fade-in
- Auto-scroll mượt

### Multi-turn conversation (28/04/2026)
- Lưu chat history trong session, AI nhớ context
- Nút "↻ Mới" để reset
- Reset tự động khi đóng modal

### Pipeline CI/CD (28/04/2026)
- 3 jobs: validate → deploy → health-check
- Lighthouse weekly audit
- Daily GAS health monitoring

### Gemini OAuth fix (27/04/2026)
- Re-authorized với `external_request` scope
- Phiên bản 8 deployed với gemini-2.0-flash
- Quota error handler thân thiện
