/**
 * Shared tooltip utility.
 * Positions a fixed tooltip above (or below if near top of screen) any anchor element.
 * Pass a hex color string to get a color-dot swatch alongside the text.
 */

let _el = null;
let _hideTimer = null;

function _get() {
  return _el || (_el = document.getElementById('tooltip'));
}

/**
 * @param {Element} anchor  - element to position next to
 * @param {string}  text    - label to display
 * @param {string}  [color] - optional hex color for the swatch dot
 */
export function showTooltip(anchor, text, color) {
  const t = _get();
  if (!t) return;
  clearTimeout(_hideTimer);

  t.textContent = text;

  if (color) {
    t.style.setProperty('--tip-clr', color);
    t.classList.add('tooltip--hex');
  } else {
    t.style.removeProperty('--tip-clr');
    t.classList.remove('tooltip--hex');
  }

  t.style.display = 'block';
  t.classList.remove('tooltip--visible');

  requestAnimationFrame(() => {
    const r  = anchor.getBoundingClientRect();
    const tr = t.getBoundingClientRect();

    let top  = r.top - tr.height - 8;
    let left = r.left + r.width / 2 - tr.width / 2;

    // Flip below if clipped by the top edge
    if (top < 6) top = r.bottom + 8;
    // Stay within horizontal bounds
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));

    t.style.top  = top + 'px';
    t.style.left = left + 'px';
    t.classList.add('tooltip--visible');
  });
}

export function hideTooltip() {
  const t = _get();
  if (!t) return;
  t.classList.remove('tooltip--visible');
  _hideTimer = setTimeout(() => {
    if (!t.classList.contains('tooltip--visible')) {
      t.style.display = 'none';
      t.classList.remove('tooltip--hex');
    }
  }, 150);
}
