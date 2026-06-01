/**
 * Shared tooltip utility.
 *
 * Movement is GPU-composited via CSS vars (--tip-x / --tip-y) driving a
 * transform: translate(); when the tooltip is already visible and a new
 * anchor is hovered, it *glides* to the new position (.tooltip--following)
 * instead of fading out and back in.
 *
 * The tooltip itself is non-interactive (pointer-events: none) — you copy a
 * color by clicking the swatch you're already hovering, and the tooltip
 * flashes a green "copied" confirmation via flashCopied().
 */

let _el         = null;
let _hideTimer  = null;
let _fadeTimer  = null;
let _currentHex = null;

const COPY_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function _get() {
  return _el || (_el = document.getElementById('tooltip'));
}

function _setContent(t, text, isHex, copied) {
  const tail = isHex
    ? `<span class="tooltip-copy">${copied ? CHECK_ICON : COPY_ICON}</span>`
    : '';
  t.innerHTML = `<span class="tooltip-label">${_esc(text)}</span>${tail}`;
}

/**
 * @param {Element} anchor  - element to position next to
 * @param {string}  text    - label to display
 * @param {string}  [color] - optional hex color → shows swatch dot + copy hint
 */
export function showTooltip(anchor, text, color) {
  const t = _get();
  if (!t) return;
  clearTimeout(_hideTimer);
  clearTimeout(_fadeTimer);

  _currentHex = color || null;
  const isHex = !!color;

  _setContent(t, text, isHex, false);

  if (isHex) {
    t.style.setProperty('--tip-clr', color);
    t.classList.add('tooltip--hex');
  } else {
    t.style.removeProperty('--tip-clr');
    t.classList.remove('tooltip--hex');
  }
  t.classList.remove('tooltip--copied');

  const wasVisible =
    t.classList.contains('tooltip--visible') || t.classList.contains('tooltip--following');

  t.style.display = 'flex';

  /* Measure & compute target position (fixed coords; translate does the move) */
  const r  = anchor.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;

  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 8;
  if (y < 6) y = r.bottom + 8;                                 // flip below if clipped
  x = Math.max(6, Math.min(x, window.innerWidth - tw - 6));    // clamp horizontally

  if (wasVisible) {
    /* Already on-screen → glide to the new anchor */
    t.classList.add('tooltip--following');
    t.style.setProperty('--tip-x', x + 'px');
    t.style.setProperty('--tip-y', y + 'px');
  } else {
    /* Fresh entrance → set position first, then fade/scale in */
    t.classList.remove('tooltip--following', 'tooltip--visible');
    t.style.setProperty('--tip-x', x + 'px');
    t.style.setProperty('--tip-y', y + 'px');
    requestAnimationFrame(() => t.classList.add('tooltip--visible'));
  }
}

/**
 * Flash the "copied" confirmation on the currently-shown tooltip.
 * Call this from a swatch's click handler right after copying.
 */
export function flashCopied(hex) {
  const t = _get();
  if (!t || !t.classList.contains('tooltip--hex')) return;
  const label = (hex || _currentHex || '').toUpperCase();
  _setContent(t, label, true, true);
  t.classList.add('tooltip--copied');
  clearTimeout(_fadeTimer);
  _fadeTimer = setTimeout(() => {
    t.classList.remove('tooltip--copied');
    if (_currentHex) _setContent(t, _currentHex.toUpperCase(), true, false);
  }, 1100);
}

export function hideTooltip() {
  const t = _get();
  if (!t) return;
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => {
    t.classList.remove('tooltip--visible', 'tooltip--following');
    _fadeTimer = setTimeout(() => {
      if (!t.classList.contains('tooltip--visible')) {
        t.style.display = 'none';
        t.classList.remove('tooltip--hex', 'tooltip--copied');
        _currentHex = null;
      }
    }, 200);
  }, 80);
}

function _esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
