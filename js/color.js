/* Color math primitives — pure functions only */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h.padEnd(6, '0');
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

/* sRGB linear */
function linearize(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function delinearize(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, c)) * 255;
}

export function rgbToLinear({ r, g, b }) {
  return { r: linearize(r), g: linearize(g), b: linearize(b) };
}

export function linearToRgb({ r, g, b }) {
  return { r: delinearize(r), g: delinearize(g), b: delinearize(b) };
}

/* Relative luminance (WCAG) */
export function luminance({ r, g, b }) {
  const { r: lr, g: lg, b: lb } = rgbToLinear({ r, g, b });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/* WCAG contrast ratio */
export function contrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const light = Math.max(l1, l2), dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/* OKLab ↔ sRGB */
export function rgbToOklab({ r, g, b }) {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

export function oklabToRgb({ L, a, b: bk }) {
  const l = L + 0.3963377774 * a + 0.2158037573 * bk;
  const m = L - 0.1055613458 * a - 0.0638541728 * bk;
  const s = L - 0.0894841775 * a - 1.2914855480 * bk;
  const ll = l * l * l, mm = m * m * m, ss = s * s * s;
  const r = +4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss;
  const g = -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss;
  const bv = -0.0041960863 * ll - 0.7034186147 * mm + 1.7076147010 * ss;
  return { r: delinearize(r), g: delinearize(g), b: delinearize(bv) };
}

/* OKLCH ↔ OKLab */
export function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return { L, C, h };
}

export function oklchToOklab({ L, C, h }) {
  const rad = h * Math.PI / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export function rgbToOklch(rgb) {
  return oklabToOklch(rgbToOklab(rgb));
}

export function oklchToRgb(oklch) {
  return oklabToRgb(oklchToOklab(oklch));
}

/* Format a hex color to a display string per format setting */
export function formatColor(hex, format) {
  if (format === 'hex') return hex.toUpperCase();
  const rgb = hexToRgb(hex);
  if (format === 'rgb') {
    const r = Math.round(rgb.r), g = Math.round(rgb.g), b = Math.round(rgb.b);
    return `rgb(${r} ${g} ${b})`;
  }
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(rgb);
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  }
  if (format === 'oklch') {
    const { L, C, h } = rgbToOklch(rgb);
    return `oklch(${(L * 100).toFixed(0)}% ${C.toFixed(3)} ${Math.round(h)})`;
  }
  return hex;
}

/* Parse any common color input to hex */
export function parseColorInput(raw) {
  const s = raw.trim();
  // hex
  if (/^#?[0-9a-fA-F]{3,8}$/.test(s)) {
    const h = s.startsWith('#') ? s : '#' + s;
    if (h.length === 4 || h.length === 7) return h.toLowerCase();
    if (h.length === 5) return ('#' + h[1].repeat(2) + h[2].repeat(2) + h[3].repeat(2)).toLowerCase();
    if (h.length === 9) return h.slice(0, 7).toLowerCase(); // strip alpha
    return null;
  }
  // rgb()
  const rgbM = s.match(/rgba?\(([^)]+)\)/i);
  if (rgbM) {
    const parts = rgbM[1].split(/[\s,/]+/).map(Number).filter(n => !isNaN(n));
    if (parts.length >= 3) return rgbToHex({ r: parts[0], g: parts[1], b: parts[2] });
  }
  // hsl()
  const hslM = s.match(/hsla?\(([^)]+)\)/i);
  if (hslM) {
    const parts = hslM[1].split(/[\s,/]+/).map(p => parseFloat(p));
    if (parts.length >= 3) return rgbToHex(hslToRgb({ h: parts[0], s: parts[1], l: parts[2] }));
  }
  return null;
}

/* Clamp L* in OKLab/OKLCH to gamut [0,1] */
export function clampToGamut(L, C, h) {
  let lo = 0, hi = C;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklchToRgb({ L, C: mid, h });
    const inGamut = rgb.r >= -0.5 && rgb.r <= 255.5 && rgb.g >= -0.5 && rgb.g <= 255.5 && rgb.b >= -0.5 && rgb.b <= 255.5;
    if (inGamut) lo = mid; else hi = mid;
  }
  return lo;
}

/* Pick a random visually distinct hue offset by given angle */
export function offsetHue(h, angle) {
  return (h + angle + 360) % 360;
}
