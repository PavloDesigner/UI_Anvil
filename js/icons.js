/**
 * icons.js — Lucide icon strings (MIT licence · https://lucide.dev)
 *
 * All paths use the standard 24×24 viewBox.
 * Size is controlled via the `size` option; stroke weight via `sw`.
 * Pass `cls` to add class names to the <svg> element.
 */

const _P = {
  /* Theme */
  'sun':            '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  'moon':           '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',

  /* Palette controls */
  'lock':           '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'lock-open':      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  'pipette':        '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  'x':              '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'plus':           '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'shuffle':        '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  'chevron-down':   '<path d="m6 9 6 6 6-6"/>',
  'wand-2':         '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',

  /* Actions */
  'bookmark':       '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  'download':       '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'trash-2':        '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  'copy':           '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',

  /* Directional */
  'arrow-up':       '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-down':     '<path d="m19 12-7 7-7-7"/><path d="M12 5v14"/>',
  'arrow-right':    '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'check':          '<path d="M20 6 9 17l-5-5"/>',

  /* Status */
  'info':           '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'circle-check':   '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'circle-x':       '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',

  /* Misc UI */
  'search':         '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'cloud-upload':   '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',
  'upload':         '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  'eye':            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'sparkles':       '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  'palette':        '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.477-1.125-.29-.289-.46-.676-.46-1.087 0-.91.75-1.648 1.648-1.648h1.741c3.058 0 5.54-2.483 5.54-5.54 0-4.974-4.5-9.012-10-9.012Z"/>',
};

/**
 * Returns an SVG string for the named Lucide icon.
 * @param {string} name   — icon name (kebab-case)
 * @param {object} opts
 * @param {number}  opts.size  — width & height in px (default 16)
 * @param {string}  opts.cls   — extra class names on the <svg>
 * @param {number}  opts.sw    — stroke-width (default 2)
 */
export function icon(name, { size = 16, cls = '', sw = 2 } = {}) {
  const paths = _P[name];
  if (!paths) { console.warn(`[icons] unknown icon: "${name}"`); return ''; }
  const clsAttr = cls ? ` class="${cls}"` : '';
  return `<svg${clsAttr} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
