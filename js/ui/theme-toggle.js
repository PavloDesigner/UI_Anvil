/* Light/dark theme toggle */

import { getState, setTheme } from '../state.js';

export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = getState().theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}
