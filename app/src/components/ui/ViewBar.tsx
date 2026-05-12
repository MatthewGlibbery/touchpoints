import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Lightbulb, HelpCircle, Pencil, X, ChevronDown, Presentation, CircleDot, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { Blueprint } from '../../types/blueprint';
import { Panel, IconButton, inputStyle } from './primitives';

type CanvasView = 'edit' | 'pain-points' | 'opportunities' | 'questions' | 'status';

const VIEW_META: Record<CanvasView, { label: string; icon: React.ReactNode }> = {
  'edit':          { label: 'Edit',          icon: <Pencil size={12} /> },
  'pain-points':   { label: 'Pains',         icon: <AlertCircle size={12} /> },
  'opportunities': { label: 'Opportunities', icon: <Lightbulb size={12} /> },
  'questions':     { label: 'Questions',     icon: <HelpCircle size={12} /> },
  'status':        { label: 'Status',        icon: <CircleDot size={12} /> },
};

export function ViewBar() {
  const canvasView              = useBlueprintStore((s) => s.canvasView);
  const setCanvasView           = useBlueprintStore((s) => s.setCanvasView);
  const blueprint               = useBlueprintStore((s) => s.blueprint);
  const setPresentationEditMode = useBlueprintStore((s) => s.setPresentationEditMode);
  const presentMode             = useBlueprintStore((s) => s.presentMode);
  const presentationEditMode    = useBlueprintStore((s) => s.presentationEditMode);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const currentMeta = VIEW_META[canvasView];
  const inPresentation = presentMode || presentationEditMode;

  const statusTransitionCount = blueprint?.actions.filter((a) => a.statusTransition?.fromStatusId || a.statusTransition?.toStatusId).length ?? 0;

  const views: { id: CanvasView; count?: number }[] = [
    { id: 'edit' },
    { id: 'pain-points',   count: blueprint?.painPoints.length },
    { id: 'opportunities', count: blueprint?.opportunities.length },
    { id: 'questions',     count: (blueprint?.questions ?? []).length },
    { id: 'status',        count: statusTransitionCount || undefined },
  ];

  function selectView(id: CanvasView) {
    setCanvasView(id);
    setOpen(false);
  }

  function handlePresent() {
    setOpen(false);
    setPresentationEditMode(true);
  }

  return (
    <>
      <div ref={ref} style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }}>
        {/* Trigger pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: inPresentation ? 'var(--accent-primary)' : 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {inPresentation ? <Presentation size={12} /> : currentMeta.icon}
            {inPresentation ? 'Presenting' : currentMeta.label}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderLeft: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            <ChevronDown
              size={13}
              color="var(--text-muted)"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </button>
        </div>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: 180,
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
              padding: '4px',
            }}
          >
            {views.map(({ id, count }) => {
              const meta = VIEW_META[id];
              const active = canvasView === id && !inPresentation;
              return (
                <button
                  key={id}
                  onClick={() => selectView(id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--surface-bg-muted)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {meta.icon}
                  <span style={{ flex: 1 }}>{meta.label}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: active ? 'var(--border-strong)' : 'var(--surface-bg-muted)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '1px 5px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            <button
              onClick={handlePresent}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: inPresentation ? 600 : 400,
                color: inPresentation ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: inPresentation ? 'var(--accent-primary-soft)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Presentation size={12} />
              <span style={{ flex: 1 }}>Present</span>
            </button>
          </div>
        )}
      </div>

      {canvasView !== 'edit' && blueprint && canvasView !== 'status' && (
        <ViewPanel view={canvasView as Exclude<CanvasView, 'edit' | 'status'>} blueprint={blueprint} />
      )}
      {canvasView === 'status' && blueprint && (
        <StatusPanel blueprint={blueprint} />
      )}
    </>
  );
}

function ViewPanel({ view, blueprint }: { view: Exclude<CanvasView, 'edit' | 'status'>; blueprint: Blueprint }) {
  const setCanvasView = useBlueprintStore((s) => s.setCanvasView);
  const items = view === 'pain-points'
    ? blueprint.painPoints
    : view === 'opportunities'
    ? blueprint.opportunities
    : (blueprint.questions ?? []);

  const title = view === 'pain-points' ? 'Pain Points' : view === 'opportunities' ? 'Opportunities' : 'Questions';

  const accentColor = view === 'pain-points'
    ? 'var(--accent-danger)'
    : view === 'opportunities'
    ? 'var(--accent-success)'
    : 'var(--accent-warning)';

  return (
    <Panel
      animateFrom="right"
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        width: 320,
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 49,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '14px 16px 0', flexShrink: 0, position: 'relative' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{items.length} total</span>
        <IconButton
          icon={<X size={13} />}
          onClick={() => setCanvasView('edit')}
          style={{ position: 'absolute', top: 12, right: 12 }}
        />
        <div style={{ height: 1, background: 'var(--border-subtle)', marginTop: 12 }} />
      </div>

      <div style={{ overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            None found in this blueprint
          </p>
        )}
        {items.map((item: any) => {
          const action = blueprint.actions.find((a) =>
            view === 'pain-points' ? a.painPointIds.includes(item.id)
            : view === 'opportunities' ? a.opportunityIds.includes(item.id)
            : (a.questionIds ?? []).includes(item.id)
          );
          const actor = action ? blueprint.actors.find((a) => a.id === action.actorId) : null;
          const phase = action ? blueprint.phases.find((p) => p.id === action.phaseId) : null;

          const bgMap = {
            'pain-points':   'rgba(239,68,68,0.05)',
            'opportunities': 'rgba(34,197,94,0.05)',
            'questions':     'rgba(245,158,11,0.05)',
          };
          const borderMap = {
            'pain-points':   'rgba(239,68,68,0.2)',
            'opportunities': 'rgba(34,197,94,0.2)',
            'questions':     'rgba(245,158,11,0.2)',
          };

          const label = view === 'pain-points' && item.severity
            ? item.severity
            : view === 'opportunities' && item.effort
            ? `${item.effort} effort`
            : view === 'questions' && item.type
            ? item.type
            : null;

          return (
            <div key={item.id} style={{
              padding: '10px 12px',
              background: bgMap[view],
              border: `1px solid ${borderMap[view]}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}>
              {label && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: accentColor,
                  textTransform: 'capitalize',
                  letterSpacing: '0.04em',
                }}>
                  {label}
                </span>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                {item.description ?? item.text}
              </p>
              {(actor || phase) && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                  {[actor?.name, phase?.name].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const STATUS_PALETTE = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];

function StatusPanel({ blueprint }: { blueprint: Blueprint }) {
  const setCanvasView = useBlueprintStore((s) => s.setCanvasView);
  const addStatus = useBlueprintStore((s) => s.addStatus);
  const updateStatus = useBlueprintStore((s) => s.updateStatus);
  const removeStatus = useBlueprintStore((s) => s.removeStatus);

  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const statuses = blueprint.statuses ?? [];

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    const color = STATUS_PALETTE[statuses.length % STATUS_PALETTE.length];
    addStatus(label, color);
    setNewLabel('');
  };

  const actionsWithTransition = blueprint.actions.filter(
    (a) => a.statusTransition?.fromStatusId || a.statusTransition?.toStatusId
  );

  return (
    <Panel
      animateFrom="right"
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        width: 320,
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 49,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '14px 16px 0', flexShrink: 0, position: 'relative' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Status</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{actionsWithTransition.length} transition{actionsWithTransition.length !== 1 ? 's' : ''}</span>
        <IconButton
          icon={<X size={13} />}
          onClick={() => setCanvasView('edit')}
          style={{ position: 'absolute', top: 12, right: 12 }}
        />
        <div style={{ height: 1, background: 'var(--border-subtle)', marginTop: 12 }} />
      </div>

      <div style={{ overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Status vocabulary */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
          Statuses
        </p>

        {statuses.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            No statuses yet. Add one below.
          </p>
        )}

        {statuses.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px',
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            {editingId === s.id ? (
              <input
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => { if (editDraft.trim()) updateStatus(s.id, { label: editDraft.trim() }); setEditingId(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingId(null); }}
                autoFocus
                style={{ ...inputStyle, fontSize: 12, flex: 1, padding: '2px 6px' }}
              />
            ) : (
              <span
                style={{ fontSize: 13, fontWeight: 600, color: s.color, flex: 1, cursor: 'pointer' }}
                onDoubleClick={() => { setEditingId(s.id); setEditDraft(s.label); }}
                title="Double-click to rename"
              >
                {s.label}
              </span>
            )}
            <button
              onClick={() => removeStatus(s.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        {/* Add status */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="New status…"
            style={{ ...inputStyle, fontSize: 12, flex: 1 }}
          />
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            style={{
              display: 'flex', alignItems: 'center', padding: '0 10px',
              background: newLabel.trim() ? 'var(--accent-primary)' : 'var(--surface-bg-muted)',
              color: newLabel.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: newLabel.trim() ? 'pointer' : 'not-allowed',
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Plus size={12} />
          </button>
        </div>

        {actionsWithTransition.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
              Transitions
            </p>
            {actionsWithTransition.map((action) => {
              const from = statuses.find((s) => s.id === action.statusTransition?.fromStatusId);
              const to = statuses.find((s) => s.id === action.statusTransition?.toStatusId);
              const phase = blueprint.phases.find((p) => p.id === action.phaseId);
              return (
                <div key={action.id} style={{
                  padding: '8px 10px',
                  background: 'var(--surface-bg-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {from && <span style={{ fontSize: 11, fontWeight: 700, color: from.color }}>{from.label}</span>}
                    {from && to && <ArrowRight size={10} color="var(--text-muted)" />}
                    {!from && to && <ArrowRight size={10} color="var(--text-muted)" />}
                    {to && <span style={{ fontSize: 11, fontWeight: 700, color: to.color }}>{to.label}</span>}
                  </div>
                  {phase && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{phase.name}</span>}
                </div>
              );
            })}
          </>
        )}
      </div>
    </Panel>
  );
}
