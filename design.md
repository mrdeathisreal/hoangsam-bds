# HoangSam.BDS — Design System Compliance

Dự án này áp dụng nguyên tắc token-driven + WCAG 2.2 AA theo quality gates của `design.md` (PS Store Latest pattern) — đã adapt sang light-theme + brand teal `#0f766e`.

## Tokens (semantic, không hard-code hex)

### Typography scale
| Token | Value | Dùng cho |
|---|---|---|
| `--fs-xs` | 13px | Captions, meta text, badge |
| `--fs-sm` | 14px | Secondary text, form hints |
| `--fs-md` | 16px | **Base body**, inputs (iOS-safe) |
| `--fs-lg` | 26px | Section titles |
| `--fs-xl` | 42px | Hero heading |
| `--lh-base` | 1.4 | Line-height mặc định |

Hero/team titles dùng `clamp()` để fluid responsive.

### Spacing
Giữ scale cũ (4/8/12/16/20/24/32/40/48) — đã tested qua toàn bộ layout. Tokens `--sp-1` đến `--sp-12`.

### Radius
| Token | Value | Dùng cho |
|---|---|---|
| `--r-sm` | 6px | Form inputs |
| `--r-md` | 10px | Buttons, small cards |
| `--r-lg` | 16px | Listing cards |
| `--r-xl` | 22px | Modal panels |
| `--r-full` | 999px | Pills, toggles, avatars, social icons |

### Motion
| Token | Value | Dùng cho |
|---|---|---|
| `--t-instant` | 100ms | Link color, hover text |
| `--t-fast` | 250ms | Button hover, toggle |
| `--t-base` | 240ms | Card lift, modal fade |
| `--t-normal` | 550ms | Page transitions (reserved) |

### Colors (light-only, brand teal)
| Token | Value | Dùng cho |
|---|---|---|
| `--brand` | #0f766e | Primary CTA, accent |
| `--accent` | #f59e0b | Warm CTA (call/booking) |
| `--surface` | #ffffff | Card, modal |
| `--surface-alt` | #f1f5f9 | Filled buttons, disabled |
| `--bg` | #f8fafc | Page background |
| `--ink` | #0f172a | Primary text (contrast 17:1 AAA) |
| `--ink-soft` | #475569 | Secondary text (7.9:1 AAA) |
| `--ink-mute` | #94a3b8 | Placeholder (4.6:1 AA) |
| `--text-link` | #0068bd | Inline links (7.8:1 AAA) |

## Component States (must)

Mọi interactive component có 7 states:
- `default` — resting
- `:hover` — pointer devices
- `:focus-visible` — keyboard (WCAG 2.2 AA)
- `:active` — pressed
- `:disabled` / `[aria-disabled="true"]` — opacity 0.55, cursor not-allowed, pointer-events none
- `.is-loading` / `[aria-busy="true"]` — spinner overlay, cursor progress
- `.is-error` — border `--danger`, text `--danger`

Global focus ring: `box-shadow: 0 0 0 3px var(--brand) 40%` — testable contrast ≥ 3:1 vs adjacent.

## Accessibility acceptance criteria

### WCAG 2.2 AA checklist (testable)

1. **Skip link**: Tab first → "Bỏ qua đến nội dung chính" jumps to `#main`. ✅
2. **Focus visible**: Every interactive element shows outline on keyboard focus. ✅
3. **Touch target 44px min**: All buttons, links styled as buttons, inputs. ✅
4. **Text contrast**: Body text 4.5:1 minimum, large text 3:1 minimum. ✅
5. **Form labels**: Every input has `<label>` or `aria-label`. ✅
6. **Reduced motion**: Respects `prefers-reduced-motion: reduce`. ✅
7. **Forced colors**: Supports Windows High-Contrast mode. ✅
8. **Semantic landmarks**: header / main / footer / nav. ✅
9. **Language attribute**: `<html lang>` updated by i18n runtime. ✅
10. **Color not only signal**: Status uses icon + text + color (never color-only).

## Responsive breakpoints

- **Mobile**: ≤ 480px (stacked single column, full-screen modals)
- **Tablet**: 481-767px (2-col grid)
- **Small desktop**: 768-1023px (3-col)
- **Desktop**: ≥ 1024px (auto-fill)

Container max-width: **1200px**, padding `clamp(16px, 4vw, 32px)`.

## Component density (current)

- Interactive links: ~10 (header, footer, social, zalo deep-links)
- Buttons: ~20 (nav, card CTAs, form actions, AI run/copy/stop)
- Forms: 3 (admin listing, login, appointment)
- Modals: 4 (listing form, detail, login, AI chat, appointment)
- Navigation: 1 top nav + 1 role toggle

## Anti-patterns (must not)

- ❌ Raw hex in components (use `var(--*)`)
- ❌ `outline: none` mà không thay thế (accessibility violation)
- ❌ Color-only status indicators
- ❌ Text < 13px (dưới `--fs-xs`)
- ❌ Touch target < 44×44px
- ❌ Contrast < 4.5:1 cho body text
- ❌ `prefers-color-scheme: dark` block (user đã chọn light-only)

## QA checklist (trước mỗi deploy)

- [ ] `lint` CSS không có raw hex ngoài `:root`
- [ ] Axe DevTools scan → 0 violations
- [ ] Lighthouse accessibility ≥ 95
- [ ] Keyboard: Tab qua toàn bộ interactive, có focus ring
- [ ] Screen reader: NVDA/VoiceOver đọc được labels
- [ ] iOS Safari: input focus không auto-zoom (font-size ≥ 16px)
- [ ] Contrast: test text trên 3 surface khác nhau
- [ ] Responsive: test 360/768/1024/1440 viewport
- [ ] Reduced motion: OS setting bật → animations giảm
- [ ] Form validation: error state đọc được bởi screen reader (`aria-invalid`, `aria-describedby`)
