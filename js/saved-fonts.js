/* localStorage CRUD for saved font pairs */

const STORAGE_KEY = 'ui-colors-saved-fonts';

export function getAllFonts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function persist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * @param {{ name: string, typo: object }} opts
 */
export function addFontPair({ name, typo }) {
  const list = getAllFonts();
  const entry = {
    id:          `fnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:        name.trim() || `Font Pair ${list.length + 1}`,
    savedAt:     Date.now(),
    heading:     typo.heading,
    body:        typo.body,
    scaleMethod: typo.scaleMethod,
    baseSize:    typo.baseSize,
    steps:       typo.steps,
    baseStep:    typo.baseStep,
  };
  list.unshift(entry);
  persist(list);
  return entry;
}

export function removeFontPair(id) {
  persist(getAllFonts().filter(f => f.id !== id));
}

export function renameFontPair(id, newName) {
  persist(getAllFonts().map(f =>
    f.id === id ? { ...f, name: newName.trim() || f.name } : f
  ));
}

/** Overwrite entire list (used by import) */
export function replaceAllFonts(list) {
  persist(list);
}
