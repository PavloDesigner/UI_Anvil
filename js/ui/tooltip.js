/**
 * Shared tooltip utility.
 *
 * Movement is GPU-composited via CSS vars (--tip-x / --tip-y) driving a
 * transform: translate(); when the tooltip is already visible and a new
 * anchor is hovered, it *glides* to the new position (.tooltip--following)
 * instead of fading out and back in.
 *
 * For hex-color tooltips the chip becomes interactive: hover onto it and
 * click to copy the color value to the clipboard.
 */

import { copyToClipboard } from '../utils.js';
import { showToast } from './toast.js';

let _el          = null;
let _hideTimer   = null;
let _fadeTimer   = null;
let _currentHex  = null;
let _overTooltip = false;

const COPY_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function _get() {
  if (_el) return _el;
  _el = document.getElementById('tooltip');
  if (_el) _wire(_el);
  return _el;
}

function _wire(t) {
  /* Keep the chip alive while the pointer is on it, so it can be clicked */
  t.addEventListener('mouseenter', () => {
    _overTooltip = true;
    clearTimeout(_hideTimer);
    clearTimeout(_fadeTimer);
  });
  t.addEventListener('mouseleave', () => {
    _overTooltip = false;
    hideTooltip();
  });

  /* Click to copy the current hex */
  t.addEventListener('click', async () => {
    if (!_currentHex) return;
    const ok = await copyToClipboard(_currentHex);
    if (ok !== false) {
      _setContent(t, _currentHex.toUpperCase(), true, true);
      t.classList.add('tooltip--copied');
      showToast(`Copied ${_currentHex.toUpperCase()}`);
      clearTimeout(_fadeTimer);
      _fadeTimer = setTimeout(() => {
        t.classList.remove('tooltip--copied');
        if (_currentHex) _setContent(t, _currentHex.toUpperCase(), true, false);
      }, 1100);
    }
  });
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
 * @param {string}  [color] - optional hex color for the swatch dot + copy
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
    t.style.pointerEvents = 'auto';
  } else {
    t.style.removeProperty('--tip-clr');
    t.classList.remove('tooltip--hex');
    t.style.pointerEvents = 'none';
  }
  t.classList.remove('tooltip--copied');

  const wasVisible =
    t.classList.contains('tooltip--visible') || t.classList.contains('tooltip--following');

  /* Make it measurable */
  t.style.display = 'flex';

  /* Measure & compute target position (fixed coords; translate does the move) */
  const r  = anchor.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;

  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 8;
  if (y < 6) y = r.bottom + 8;                                   // flip below if clipped
  x = Math.max(6, Math.min(x, window.innerWidth  - tw - 6));     // clamp horizontally

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

export function hideTooltip() {
  const t = _get();
  if (!t) return;
  /* Grace period so the pointer can cross the gap onto the chip to click it */
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => {
    if (_overTooltip) return;
    t.classList.remove('tooltip--visible', 'tooltip--following');
    _fadeTimer = setTimeout(() => {
      if (!t.classList.contains('tooltip--visible')) {
        t.style.display = 'none';
        t.classList.remove('tooltip--hex', 'tooltip--copied');
        t.style.pointerEvents = 'none';
        _currentHex = null;
      }
    }, 200);
  }, 130);
}

function _esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
