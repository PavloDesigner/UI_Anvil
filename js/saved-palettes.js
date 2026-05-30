/* localStorage CRUD for saved palettes */

const STORAGE_KEY = 'ui-colors-saved';

export function getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function persist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * @param {{ name: string, state: object, previewColors: string[], previewRows?: Array<{label:string,colors:string[]}> }} opts
 */
export function addPalette({ name, state, previewColors, previewRows }) {
  const list = getAll();
  const entry = {
    id:            `pal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:          name.trim() || `Palette ${list.length + 1}`,
    savedAt:       Date.now(),
    method:        state.method,
    steps:         state.steps,
    previewColors: previewColors || [],
    previewRows:   previewRows   || null,
    state: {
      method:             state.method,
      steps:              state.steps,
      theme:              state.theme,
      format:             state.format,
      harmony:            state.harmony,
      showSecondaryBrand: state.showSecondaryBrand ?? false,
      showTertiaryBrand:  state.showTertiaryBrand  ?? false,
      palettes: Object.fromEntries(
        Object.entries(state.palettes).map(([k, v]) => [k, { input: v.input, locked: !!v.locked }])
      ),
    },
  };
  list.unshift(entry);
  persist(list);
  return entry;
}

export function removePalette(id) {
  persist(getAll().filter(p => p.id !== id));
}

export function renamePalette(id, newName) {
  persist(getAll().map(p =>
    p.id === id ? { ...p, name: newName.trim() || p.name } : p
  ));
}

/** Overwrite entire list (used by import) */
export function replaceAllPalettes(list) {
  persist(list);
}
