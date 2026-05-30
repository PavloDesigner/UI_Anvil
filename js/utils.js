/* Utility helpers — pure functions */

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

/* Encode state to URL hash */
export function encodeState(state) {
  const payload = {
    m: state.method,
    s: state.steps,
    t: state.theme,
    f: state.format,
    h: state.harmony,
    p: Object.fromEntries(
      Object.entries(state.palettes).map(([k, v]) => [k, { i: v.input, l: v.locked ? 1 : 0 }])
    ),
  };
  try {
    return btoa(JSON.stringify(payload)).replace(/=/g, '');
  } catch { return ''; }
}

export function decodeState(hash) {
  try {
    const raw = hash.replace(/^#/, '');
    if (!raw) return null;
    const payload = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
    return {
      method: payload.m || 'tailwind',
      steps: payload.s || 11,
      theme: payload.t || 'dark',
      format: payload.f || 'hex',
      harmony: payload.h || 'auto',
      palettes: Object.fromEntries(
        Object.entries(payload.p || {}).map(([k, v]) => [k, { input: v.i, locked: !!v.l }])
      ),
    };
  } catch { return null; }
}

/* Generate a plausible random hex color */
export function randomHue(hintH = null, harmony = 'auto') {
  const h = hintH !== null ? hintH : Math.random() * 360;
  const s = 55 + Math.random() * 35;
  const l = 40 + Math.random() * 20;
  const { rgbToHex, hslToRgb } = (() => {
    // inline to avoid circular import; color.js re-exports these same fns
    function hslToRgbLocal({ h: hh, s: ss, l: ll }) {
      hh /= 360; ss /= 100; ll /= 100;
      let r, g, b;
      if (ss === 0) { r = g = b = ll; }
      else {
        const f = (p, q, t) => {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
        const p = 2 * ll - q;
        r = f(p, q, hh + 1/3); g = f(p, q, hh); b = f(p, q, hh - 1/3);
      }
      return { r: r * 255, g: g * 255, b: b * 255 };
    }
    function rgbToHexLocal({ r, g, b }) {
      return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    }
    return { rgbToHex: rgbToHexLocal, hslToRgb: hslToRgbLocal };
  })();
  return rgbToHex(hslToRgb({ h, s, l }));
}

/* Returns harmony offsets for random palette generation */
export function harmonyOffsets(harmony) {
  switch (harmony) {
    case 'mono':          return [0, 0, 0, 0, 0, 0];
    case 'analogous':     return [0, 30, -30, 60, -60, 15];
    case 'complementary': return [0, 180, 30, 210, -30, 150];
    case 'triadic':       return [0, 120, 240, 60, 180, 300];
    default:              return Array.from({ length: 6 }, () => Math.random() * 360);
  }
}
