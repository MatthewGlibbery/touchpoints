import { useState } from 'react';
import { AlertCircle, Lightbulb, HelpCircle, Pencil, Presentation, MessageCircle, X } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { Blueprint } from '../../types/blueprint';
import { Panel, IconButton } from './primitives';

type CanvasView = 'edit' | 'pain-points' | 'opportunities' | 'questions';

const VIEW_ITEMS: { id: CanvasView; label: string; icon: React.ReactNode; color?: string }[] = [
  { id: 'edit',          label: 'Edit',          icon: <Pencil size={16} /> },
  { id: 'pain-points',   label: 'Pains',         icon: <AlertCircle size={16} />, color: 'var(--accent-danger)' },
  { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb size={16} />,   color: 'var(--accent-success)' },
  { id: 'questions',     label: 'Questions',     icon: <HelpCircle size={16} />,  color: 'var(--accent-warning)' },
];

export function ViewRail() {
  const canvasView              = useBlueprintStore((s) => s.canvasView);
  const setCanvasView           = useBlueprintStore((s) => s.setCanvasView);
  const setPresentationEditMode = useBlueprintStore((s) => s.setPresentationEditMode);
  const presentMode             = useBlueprintStore((s) => s.presentMode);
  const presentationEditMode    = useBlueprintStore((s) => s.presentationEditMode);
  const commentMode             = useBlueprintStore((s) => s.commentMode);
  const setCommentMode          = useBlueprintStore((s) => s.setCommentMode);

  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const inPresentation = presentMode || presentationEditMode;

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setHovered(null); }}
      style={{
        position: 'fixed',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 4,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {VIEW_ITEMS.map(({ id, label, icon, color }) => {
        const active = canvasView === id && !inPresentation && !commentMode;
        const isHovered = hovered === id;
        return (
          <button
            key={id}
            onClick={() => setCanvasView(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: active ? 'var(--surface-bg-muted)' : 'transparent',
              color: active ? (color ?? 'var(--accent-primary)') : isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'background 0.12s, color 0.12s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
            {expanded && (
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 500 }}>
                {label}
              </span>
            )}
          </button>
        );
      })}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 2px' }} />

      {/* Present */}
      <button
        onClick={() => setPresentationEditMode(true)}
        onMouseEnter={() => setHovered('present')}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: inPresentation ? 'var(--accent-primary-soft)' : 'transparent',
          color: inPresentation ? 'var(--accent-primary)' : hovered === 'present' ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'background 0.12s, color 0.12s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flexShrink: 0, display: 'flex' }}><Presentation size={16} /></span>
        {expanded && <span style={{ fontSize: 12, fontWeight: inPresentation ? 600 : 500 }}>Present</span>}
      </button>

      {/* Comment */}
      <button
        onClick={() => setCommentMode(!commentMode)}
        onMouseEnter={() => setHovered('comment')}
        onMouseLeave={() => setHovered(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: commentMode ? 'var(--accent-primary-soft)' : 'transparent',
          color: commentMode ? 'var(--accent-primary)' : hovered === 'comment' ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'background 0.12s, color 0.12s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flexShrink: 0, display: 'flex' }}><MessageCircle size={16} /></span>
        {expanded && (
          <span style={{ fontSize: 12, fontWeight: commentMode ? 600 : 500 }}>
            {commentMode ? 'Exit comments' : 'Comment'}
          </span>
        )}
      </button>
    </div>
  );
}


// ─── Side panel that shows when a non-edit view is active ─────────────────────

export function ViewPanel_() {
  const canvasView = useBlueprintStore((s) => s.canvasView);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  if (canvasView === 'edit' || !blueprint) return null;
  return <ViewPanel view={canvasView as Exclude<typeof canvasView, 'edit'>} blueprint={blueprint} />;
}

function ViewPanel({ view, blueprint }: { view: 'pain-points' | 'opportunities' | 'questions'; blueprint: Blueprint }) {
  const setCanvasView = useBlueprintStore((s) => s.setCanvasView);
  const effectiveActors = useBlueprintStore((s) => s.effectiveActors);
  const effectivePhases = useBlueprintStore((s) => s.effectivePhases);
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
          const actor = action ? effectiveActors.find((a) => a.id === action.actorId) : null;
          const phase = action ? effectivePhases.find((p) => p.id === action.phaseId) : null;

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
