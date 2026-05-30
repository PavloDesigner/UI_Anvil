/* Typography state — fonts + scale settings, persisted to localStorage */

const STORAGE_KEY = 'ui-colors-typography';

const DEFAULT = {
  heading:     'Playfair Display',
  body:        'Inter',
  scaleMethod: 'perfect-fourth',
  baseSize:    16,
  steps:       9,
  baseStep:    3,   // which step (0-indexed) is the "base" size
  headingLocked: false,
  bodyLocked:    false,
};

let _state  = { ...DEFAULT };
const _subs = [];

/* ─── Persistence ─── */
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _state = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
}

/* ─── Notify ─── */
function notify() {
  const snap = { ..._state };
  _subs.forEach(fn => fn(snap));
}

/* ─── Public API ─── */
export function initTypography() {
  restore();
  notify();
}

export function getTypography() { return { ..._state }; }

export function setHeadingFont(family) {
  _state.heading = family;
  persist(); notify();
}

export function setBodyFont(family) {
  _state.body = family;
  persist(); notify();
}

export function setScaleMethod(method) {
  _state.scaleMethod = method;
  persist(); notify();
}

export function setBaseSize(px) {
  _state.baseSize = Math.max(10, Math.min(24, Math.round(px)));
  persist(); notify();
}

export function setTypoSteps(n) {
  _state.steps    = Math.max(5, Math.min(15, n));
  _state.baseStep = Math.min(_state.baseStep, _state.steps - 1);
  persist(); notify();
}

export function setHeadingLocked(locked) {
  _state.headingLocked = !!locked;
  persist(); notify();
}

export function setBodyLocked(locked) {
  _state.bodyLocked = !!locked;
  persist(); notify();
}

export function subscribeTypography(fn) {
  _subs.push(fn);
}
