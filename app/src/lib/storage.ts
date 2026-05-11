import type { Blueprint } from '../types/blueprint';

const ALL_KEY = 'touchpoints_blueprints';
const CURRENT_KEY = 'touchpoints_current_id';
const LEGACY_KEY = 'touchpoints_blueprint';

export function saveBlueprint(blueprint: Blueprint): void {
  try {
    const all = loadAllBlueprints();
    all[blueprint.id] = blueprint;
    localStorage.setItem(ALL_KEY, JSON.stringify(all));
    localStorage.setItem(CURRENT_KEY, blueprint.id);
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function loadAllBlueprints(): Record<string, Blueprint> {
  try {
    const raw = localStorage.getItem(ALL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Blueprint>) : {};
  } catch {
    return {};
  }
}

export function loadBlueprint(): Blueprint | null {
  try {
    // Migration from legacy single-blueprint storage
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const bp = JSON.parse(legacy) as Blueprint;
      saveBlueprint(bp);
      localStorage.removeItem(LEGACY_KEY);
      return bp;
    }

    const currentId = localStorage.getItem(CURRENT_KEY);
    if (!currentId) return null;
    return loadAllBlueprints()[currentId] ?? null;
  } catch {
    return null;
  }
}

export function switchBlueprint(id: string): Blueprint | null {
  try {
    const all = loadAllBlueprints();
    const bp = all[id] ?? null;
    if (bp) localStorage.setItem(CURRENT_KEY, id);
    return bp;
  } catch {
    return null;
  }
}

export function deleteBlueprint(id: string): void {
  try {
    const all = loadAllBlueprints();
    delete all[id];
    localStorage.setItem(ALL_KEY, JSON.stringify(all));
    const currentId = localStorage.getItem(CURRENT_KEY);
    if (currentId === id) localStorage.removeItem(CURRENT_KEY);
  } catch {}
}

export function clearBlueprint(): void {
  localStorage.removeItem(CURRENT_KEY);
}
