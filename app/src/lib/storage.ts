import type { Blueprint } from '../types/blueprint';
import { supabase } from './supabase';

const ALL_KEY = 'touchpoints_blueprints';
const CURRENT_KEY = 'touchpoints_current_id';
const LEGACY_KEY = 'touchpoints_blueprint';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function lsReadAll(): Record<string, Blueprint> {
  try {
    const raw = localStorage.getItem(ALL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Blueprint>) : {};
  } catch {
    return {};
  }
}

function lsWriteAll(all: Record<string, Blueprint>): void {
  try {
    localStorage.setItem(ALL_KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ─── Cloud helpers ────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function saveBlueprintCloud(blueprint: Blueprint): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('[cloud] saveBlueprintCloud: no user session');
    return;
  }

  const { data: existing } = await supabase
    .from('blueprints')
    .select('id')
    .eq('owner_id', userId)
    .eq('data->>id', blueprint.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('blueprints')
      .update({ data: blueprint, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) console.error('[cloud] update error:', error);
  } else {
    const { error } = await supabase
      .from('blueprints')
      .insert({ owner_id: userId, data: blueprint, updated_by: userId });
    if (error) console.error('[cloud] insert error:', error);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function saveBlueprint(blueprint: Blueprint): void {
  try {
    const all = lsReadAll();
    all[blueprint.id] = blueprint;
    lsWriteAll(all);
    localStorage.setItem(CURRENT_KEY, blueprint.id);
  } catch {
    // fail silently
  }
  // Fire cloud write in background (non-blocking)
  saveBlueprintCloud(blueprint).catch((e) => console.error('[cloud] background save failed:', e));
}

export function loadAllBlueprints(): Record<string, Blueprint> {
  return lsReadAll();
}

export async function fetchBlueprintsFromCloud(): Promise<Record<string, Blueprint>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return lsReadAll();

    const { data, error } = await supabase
      .from('blueprints')
      .select('data')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !data) return lsReadAll();

    const all: Record<string, Blueprint> = {};
    for (const row of data) {
      const bp = row.data as Blueprint;
      if (bp?.id) all[bp.id] = bp;
    }

    // Sync cloud data down to localStorage
    lsWriteAll(all);

    return all;
  } catch {
    return lsReadAll();
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
    return lsReadAll()[currentId] ?? null;
  } catch {
    return null;
  }
}

export function switchBlueprint(id: string): Blueprint | null {
  try {
    const all = lsReadAll();
    const bp = all[id] ?? null;
    if (bp) localStorage.setItem(CURRENT_KEY, id);
    return bp;
  } catch {
    return null;
  }
}

export function deleteBlueprint(id: string): void {
  try {
    const all = lsReadAll();
    delete all[id];
    lsWriteAll(all);
    const currentId = localStorage.getItem(CURRENT_KEY);
    if (currentId === id) localStorage.removeItem(CURRENT_KEY);
  } catch {}

  // Fire cloud delete in background
  (async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      await supabase
        .from('blueprints')
        .delete()
        .eq('owner_id', userId)
        .eq('data->>id', id);
    } catch {}
  })();
}

export function clearBlueprint(): void {
  localStorage.removeItem(CURRENT_KEY);
}

// ─── Migration ────────────────────────────────────────────────────────────────

export async function migrateLocalBlueprints(): Promise<Blueprint[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const local = lsReadAll();
    if (Object.keys(local).length === 0) return [];

    const { data } = await supabase
      .from('blueprints')
      .select('data->>id')
      .eq('owner_id', userId);

    const cloudIds = new Set((data ?? []).map((r: { id: string }) => r.id));
    return Object.values(local).filter((bp) => !cloudIds.has(bp.id));
  } catch {
    return [];
  }
}

export async function importBlueprintsToCloud(blueprints: Blueprint[]): Promise<void> {
  for (const bp of blueprints) {
    await saveBlueprintCloud(bp);
  }
}

// ─── Share links ──────────────────────────────────────────────────────────────

async function getBlueprintRowId(blueprintDataId: string): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const { data } = await supabase
      .from('blueprints')
      .select('id')
      .eq('owner_id', userId)
      .eq('data->>id', blueprintDataId)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function getShareToken(blueprintDataId: string): Promise<string | null> {
  try {
    const rowId = await getBlueprintRowId(blueprintDataId);
    if (!rowId) return null;
    const { data } = await supabase
      .from('blueprint_shares')
      .select('token')
      .eq('blueprint_id', rowId)
      .maybeSingle();
    return data?.token ?? null;
  } catch {
    return null;
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function createShareToken(blueprintDataId: string): Promise<string | null> {
  try {
    const rowId = await getBlueprintRowId(blueprintDataId);
    if (!rowId) {
      console.error('[share] blueprint row not found in Supabase for id:', blueprintDataId);
      return null;
    }
    const token = generateToken();
    const { data, error } = await supabase
      .from('blueprint_shares')
      .insert({ blueprint_id: rowId, token, can_comment: true })
      .select('token')
      .single();
    if (error) { console.error('[share] insert error:', error); return null; }
    return data?.token ?? null;
  } catch (e) {
    console.error('[share] createShareToken error:', e);
    return null;
  }
}

export async function deleteShareToken(blueprintDataId: string): Promise<void> {
  try {
    const rowId = await getBlueprintRowId(blueprintDataId);
    if (!rowId) return;
    await supabase.from('blueprint_shares').delete().eq('blueprint_id', rowId);
  } catch {}
}
