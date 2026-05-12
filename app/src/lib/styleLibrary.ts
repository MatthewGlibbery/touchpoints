const STORAGE_KEY = 'touchpoints-style-presets';

export type StylePreset = {
  id: string;
  name: string;
  baseStyle: string;
  createdAt: string;
};

export function loadPresets(): StylePreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function savePreset(name: string, baseStyle: string): StylePreset {
  const preset: StylePreset = {
    id: `preset-${Date.now()}`,
    name,
    baseStyle,
    createdAt: new Date().toISOString(),
  };
  const all = [...loadPresets(), preset];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return preset;
}

export function deletePreset(id: string): void {
  const all = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
