/* Toast notification manager */

const MAX = 3;
const DURATION = 1500;
let container;

export function initToast() {
  container = document.getElementById('toast-container');
}

export function showToast(msg) {
  if (!container) return;
  if (container.children.length >= MAX) {
    container.firstChild.remove();
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.setAttribute('role', 'status');
  container.appendChild(t);

  setTimeout(() => {
    t.classList.add('toast--out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, DURATION);
}
