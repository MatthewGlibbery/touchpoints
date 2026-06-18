import { useState, useMemo, lazy, Suspense } from 'react';
import {
  ArrowLeft, Plus, Settings2, ChevronDown, Trash2, X,
  Minus, Grid3X3, Box,
} from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { AxisConfigurator } from './AxisConfigurator';
import { SingleAxisView } from './SingleAxisView';
import { DualAxisView } from './DualAxisView';
import { CardDugout } from './CardDugout';
import type { CardItem } from './FrameworkCard';
import type { Framework, FrameworkAxis } from '../../types/blueprint';

const ThreeAxisView = lazy(() => import('./ThreeAxisView').then((m) => ({ default: m.ThreeAxisView })));

type ViewMode = 'axis' | 'framework';

export function FrameworksView() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const setFrameworkMode = useBlueprintStore((s) => s.setFrameworkMode);
  const activeFrameworkId = useBlueprintStore((s) => s.activeFrameworkId);
  const setActiveFramework = useBlueprintStore((s) => s.setActiveFramework);
  const activeAxisId = useBlueprintStore((s) => s.activeAxisId);
  const setActiveAxis = useBlueprintStore((s) => s.setActiveAxis);
  const addFramework = useBlueprintStore((s) => s.addFramework);
  const removeFramework = useBlueprintStore((s) => s.removeFramework);

  const [showAxisConfig, setShowAxisConfig] = useState(false);
  const [showFwSelector, setShowFwSelector] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // View mode: either viewing a single axis (for plotting) or a combined framework
  const [viewMode, setViewMode] = useState<ViewMode>('axis');

  if (!blueprint) return null;

  const frameworks = blueprint.frameworks ?? [];
  const axes = blueprint.frameworkAxes ?? [];
  const activeAxis = axes.find((a) => a.id === activeAxisId) ?? axes[0] ?? null;
  const activeFramework = frameworks.find((f) => f.id === activeFrameworkId) ?? frameworks[0] ?? null;

  // Collect all card items from the blueprint
  const allCards: CardItem[] = useMemo(() => {
    const items: CardItem[] = [];
    for (const pp of blueprint.painPoints) items.push({ type: 'pain', item: pp });
    for (const op of blueprint.opportunities) items.push({ type: 'opportunity', item: op });
    for (const q of (blueprint.questions ?? [])) items.push({ type: 'question', item: q });
    return items;
  }, [blueprint.painPoints, blueprint.opportunities, blueprint.questions]);

  // Resolve axes for active framework
  const resolvedFwAxes: FrameworkAxis[] = useMemo(() => {
    if (!activeFramework) return [];
    return activeFramework.axisIds
      .map((id) => axes.find((a) => a.id === id))
      .filter(Boolean) as FrameworkAxis[];
  }, [activeFramework, axes]);

  const handleCreateFramework = (name: string, selectedAxes: string[], mode: '2d' | '3d') => {
    addFramework(name, selectedAxes, mode);
    setShowCreateModal(false);
    setViewMode('framework');
  };

  const switchToAxis = (id: string) => {
    setActiveAxis(id);
    setViewMode('axis');
  };

  const switchToFramework = (id: string) => {
    setActiveFramework(id);
    setViewMode('framework');
  };

  return (
    <>
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas-bg)',
        overflow: 'hidden',
      }}>
        {/* ── Top bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          height: 56,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-bg)',
          flexShrink: 0,
          zIndex: 10,
        }}>
          <button
            onClick={() => setFrameworkMode(false)}
            title="Back to blueprint"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            <ArrowLeft size={14} />
            Blueprint
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

          {/* View mode toggle */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('axis')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: viewMode === 'axis' ? 600 : 400,
                border: 'none', cursor: 'pointer',
                background: viewMode === 'axis' ? 'var(--surface-bg-muted)' : 'transparent',
                color: viewMode === 'axis' ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Minus size={11} />
              Plot
            </button>
            <button
              onClick={() => setViewMode('framework')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: viewMode === 'framework' ? 600 : 400,
                border: 'none', borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer',
                background: viewMode === 'framework' ? 'var(--surface-bg-muted)' : 'transparent',
                color: viewMode === 'framework' ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Grid3X3 size={11} />
              Combine
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* Context-specific selector */}
          {viewMode === 'axis' ? (
            /* Axis selector */
            <AxisSelector
              axes={axes}
              activeId={activeAxis?.id ?? null}
              onSelect={switchToAxis}
              onManage={() => setShowAxisConfig(true)}
            />
          ) : (
            /* Framework selector */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeFramework && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {activeFramework.mode}
                </span>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowFwSelector((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
                    color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {activeFramework?.name ?? 'No combination'}
                  <ChevronDown size={13} />
                </button>
                {showFwSelector && (
                  <FrameworkDropdown
                    frameworks={frameworks}
                    activeId={activeFramework?.id ?? null}
                    onSelect={(id) => { switchToFramework(id); setShowFwSelector(false); }}
                    onDelete={(id) => { removeFramework(id); setShowFwSelector(false); }}
                    onCreate={() => { setShowCreateModal(true); setShowFwSelector(false); }}
                    onClose={() => setShowFwSelector(false)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Axes library button */}
          <button
            onClick={() => setShowAxisConfig(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            <Settings2 size={14} />
            Axes
          </button>
        </div>

        {/* ── Main content ── */}
        {viewMode === 'axis' ? (
          /* Single axis plotting */
          axes.length === 0 ? (
            <EmptyAxesState onOpenAxes={() => setShowAxisConfig(true)} />
          ) : activeAxis ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <SingleAxisView axis={activeAxis} cards={allCards} />
              <CardDugout cards={allCards} axes={[activeAxis]} />
            </div>
          ) : null
        ) : (
          /* Framework combination view */
          !activeFramework ? (
            <EmptyFrameworkState onCreateFramework={() => setShowCreateModal(true)} hasAxes={axes.length >= 2} />
          ) : resolvedFwAxes.length < 2 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              This framework needs at least 2 valid axes. Edit axes or create a new combination.
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {resolvedFwAxes.length === 2 && (
                <DualAxisView axes={[resolvedFwAxes[0], resolvedFwAxes[1]]} cards={allCards} />
              )}
              {resolvedFwAxes.length === 3 && (
                <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading 3D view…</div>}>
                  <ThreeAxisView axes={[resolvedFwAxes[0], resolvedFwAxes[1], resolvedFwAxes[2]]} cards={allCards} />
                </Suspense>
              )}
              <CardDugout cards={allCards} axes={resolvedFwAxes} />
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showAxisConfig && <AxisConfigurator onClose={() => setShowAxisConfig(false)} />}
      {showCreateModal && (
        <CreateFrameworkModal
          axes={axes}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateFramework}
          onOpenAxes={() => { setShowCreateModal(false); setShowAxisConfig(true); }}
        />
      )}
    </>
  );
}

// ─── Axis selector ────────────────────────────────────────────────────────────

function AxisSelector({
  axes,
  activeId,
  onSelect,
  onManage,
}: {
  axes: FrameworkAxis[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = axes.find((a) => a.id === activeId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}
      >
        {active?.title ?? 'Select axis'}
        <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 220,
            background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 4, zIndex: 100,
          }}>
            {axes.map((axis) => (
              <button
                key={axis.id}
                onClick={() => { onSelect(axis.id); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer',
                  background: axis.id === activeId ? 'var(--surface-bg-muted)' : 'transparent',
                  color: 'var(--text-primary)', fontSize: 13,
                  fontWeight: axis.id === activeId ? 600 : 400,
                }}
              >
                <div>{axis.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{axis.lowLabel} → {axis.highLabel}</div>
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            <button
              onClick={() => { onManage(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                border: 'none', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}
            >
              <Plus size={13} /> Manage axes
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyAxesState({ onOpenAxes }: { onOpenAxes: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)' }}>
      <Minus size={40} strokeWidth={1} />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Create your first axis</h3>
      <p style={{ fontSize: 13, maxWidth: 380, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        Define axes like "Impact", "Effort", or "Feasibility" and plot your pain points, opportunities, and questions along them.
      </p>
      <button onClick={onOpenAxes} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer' }}>
        <Plus size={14} /> New axis
      </button>
    </div>
  );
}

function EmptyFrameworkState({ onCreateFramework, hasAxes }: { onCreateFramework: () => void; hasAxes: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)' }}>
      <Grid3X3 size={40} strokeWidth={1} />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No combinations yet</h3>
      <p style={{ fontSize: 13, maxWidth: 380, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        Combine 2–3 axes to see where your cards land in 2D or 3D space. Plot cards on individual axes first using "Plot" mode.
      </p>
      {hasAxes ? (
        <button onClick={onCreateFramework} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer' }}>
          <Plus size={14} /> New combination
        </button>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Create at least 2 axes in "Plot" mode first.</p>
      )}
    </div>
  );
}

// ─── Framework dropdown ───────────────────────────────────────────────────────

function FrameworkDropdown({
  frameworks,
  activeId,
  onSelect,
  onDelete,
  onCreate,
  onClose,
}: {
  frameworks: Framework[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240,
        background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 4, zIndex: 100,
      }}>
        {frameworks.map((fw) => (
          <div
            key={fw.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: fw.id === activeId ? 'var(--surface-bg-muted)' : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(fw.id)}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: fw.id === activeId ? 600 : 400, color: 'var(--text-primary)' }}>
              {fw.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{fw.mode}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(fw.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
        <button
          onClick={onCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}
        >
          <Plus size={13} /> New combination
        </button>
      </div>
    </>
  );
}

// ─── Create framework modal ──────────────────────────────────────────────────

function CreateFrameworkModal({
  axes,
  onClose,
  onCreate,
  onOpenAxes,
}: {
  axes: FrameworkAxis[];
  onClose: () => void;
  onCreate: (name: string, axisIds: string[], mode: '2d' | '3d') => void;
  onOpenAxes: () => void;
}) {
  const [name, setName] = useState('');
  const [selectedAxes, setSelectedAxes] = useState<string[]>([]);
  const mode: '2d' | '3d' = selectedAxes.length <= 2 ? '2d' : '3d';

  const toggleAxis = (id: string) => {
    if (selectedAxes.includes(id)) {
      setSelectedAxes(selectedAxes.filter((a) => a !== id));
    } else if (selectedAxes.length < 3) {
      setSelectedAxes([...selectedAxes, id]);
    }
  };

  const canCreate = name.trim() && selectedAxes.length >= 2;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 24, width: 420, boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>New Combination</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Impact vs Effort"
            autoFocus
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>

        {/* Axis selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Select 2–3 axes — {selectedAxes.length} selected → {mode.toUpperCase()}
          </label>
          {axes.length < 2 ? (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>Need at least 2 axes.</p>
              <button onClick={onOpenAxes} style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Create axes →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {axes.map((axis) => {
                const selected = selectedAxes.includes(axis.id);
                const order = selectedAxes.indexOf(axis.id) + 1;
                const labels = ['X', 'Y', 'Z'];
                return (
                  <button
                    key={axis.id}
                    onClick={() => toggleAxis(axis.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      background: selected ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {selected && (
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {labels[order - 1]}
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{axis.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{axis.lowLabel} → {axis.highLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 13, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => canCreate && onCreate(name.trim(), selectedAxes, mode)}
            disabled={!canCreate}
            style={{
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--accent-primary)', color: '#fff',
              cursor: canCreate ? 'pointer' : 'not-allowed',
              opacity: canCreate ? 1 : 0.5,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
