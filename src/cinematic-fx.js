/**
 * cinematic-fx.js — Lead capture popup + cinematic effects
 * ----------------------------------------------------------------------------
 * Features:
 *   1) Lead popup: hiện sau 4s, 24h cookie, Zalo CTA + close
 *   2) Hero fade+rise on load
 *   3) Ken Burns zoom cho ảnh listings
 *   4) Scroll-triggered fade-in cho cards (IntersectionObserver)
 *   5) Hover 3D tilt cho cards
 * ----------------------------------------------------------------------------
 */

const POPUP_DELAY_MS = 7000; // Mềm mại hơn — đợi user xem trang trước
const POPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const POPUP_KEY = 'hs_popup_dismissed_at';

// ─── 1. Lead capture popup ─────────────────────────────────────────────────
function shouldShowPopup() {
  try {
    const last = Number(localStorage.getItem(POPUP_KEY) || 0);
    return Date.now() - last > POPUP_COOLDOWN_MS;
  } catch { return true; }
}

function showPopup() {
  const popup = document.getElementById('lead-popup');
  if (!popup) return;
  popup.hidden = false;
  popup.setAttribute('aria-hidden', 'false');
  // trigger animation next frame
  requestAnimationFrame(() => popup.classList.add('lead-popup--open'));
}

function closePopup() {
  const popup = document.getElementById('lead-popup');
  if (!popup) return;
  popup.classList.remove('lead-popup--open');
  setTimeout(() => {
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
  }, 300);
  try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch {}
}

function initPopup() {
  const popup = document.getElementById('lead-popup');
  if (!popup) return;

  // Close handlers
  popup.addEventListener('click', (e) => {
    if (e.target.matches('[data-popup-close]') || e.target.closest('[data-popup-close]')) {
      closePopup();
    }
  });
  // Track Zalo click as conversion (still close after)
  popup.querySelector('.lead-popup__btn--primary')?.addEventListener('click', () => {
    try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch {}
  });
  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popup.hidden) closePopup();
  });

  if (shouldShowPopup()) {
    setTimeout(showPopup, POPUP_DELAY_MS);
  }
}

// ─── 2. Hero fade+rise on load ─────────────────────────────────────────────
function initHeroAnimation() {
  const title = document.querySelector('.hero__title');
  const subtitle = document.querySelector('.hero__subtitle');
  if (!title) return;

  [title, subtitle].forEach((el, i) => {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.9s ease-out, transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)';
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 100 + i * 200);
  });
}

// ─── 3. Scroll-triggered fade-in cho cards ─────────────────────────────────
function initScrollFadeIn() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('cf-fade-in--visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

  // Re-observe on DOM changes (for dynamically added listing cards)
  function observeCards() {
    document.querySelectorAll('.card:not(.cf-fade-in)').forEach((card, i) => {
      card.classList.add('cf-fade-in');
      card.style.transitionDelay = `${(i % 6) * 60}ms`;
      observer.observe(card);
    });
  }

  observeCards();

  // Watch for new cards added by ui-render.js
  const grid = document.querySelector('.cards-grid, .listings-grid, [class*="grid"]');
  if (grid) {
    new MutationObserver(observeCards).observe(grid, { childList: true, subtree: true });
  }
  // Also watch the whole body in case grid selector misses
  new MutationObserver((mutations) => {
    if (mutations.some(m => Array.from(m.addedNodes).some(n => n.nodeType === 1 && (n.classList?.contains('listing-card') || n.querySelector?.('.card'))))) {
      observeCards();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// ─── 4. Hover 3D tilt cho cards ────────────────────────────────────────────
function init3DTilt() {
  // Use event delegation — works for dynamically added cards
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;  // 0..1
    const y = (e.clientY - rect.top) / rect.height;  // 0..1
    const tiltX = (y - 0.5) * -4; // ±2 deg — subtle hơn
    const tiltY = (x - 0.5) * 4;
    card.style.transform = `perspective(1100px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.01)`;
    card.style.transition = 'transform 0.08s ease-out';
  });

  document.addEventListener('mouseleave', (e) => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    card.style.transform = '';
    card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
  }, true);

  // Reset on mouseout from card
  document.addEventListener('mouseout', (e) => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    if (!card.contains(e.relatedTarget)) {
      card.style.transform = '';
      card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }
  });
}

// ─── 5. Ken Burns zoom cho ảnh listings ────────────────────────────────────
function initKenBurns() {
  // Apply class — CSS handles the slow zoom animation
  function applyToImages() {
    document.querySelectorAll('.card img:not(.cf-ken-burns), .card__media img:not(.cf-ken-burns)').forEach(img => {
      img.classList.add('cf-ken-burns');
    });
  }
  applyToImages();
  // Re-apply on dynamic content
  new MutationObserver(applyToImages).observe(document.body, { childList: true, subtree: true });
}

// ─── INIT ──────────────────────────────────────────────────────────────────
function init() {
  initPopup();
  initHeroAnimation();
  initScrollFadeIn();
  init3DTilt();
  initKenBurns();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
