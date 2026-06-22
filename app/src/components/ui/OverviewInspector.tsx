import { useState } from 'react';
import { User, Globe, Building2, Users, Activity, X, AlertCircle, Lightbulb, HelpCircle, Loader2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { Action } from '../../types/blueprint';
import { Panel, IconButton, TabBar, inputStyle } from './primitives';

const ACTOR_ICONS = [User, Globe, Building2, Users];

type OverviewTab = 'steps' | 'pains' | 'opportunities' | 'questions';

export function OverviewInspector() {
  const blueprint              = useBlueprintStore((s) => s.blueprint);
  const effectiveActors        = useBlueprintStore((s) => s.effectiveActors);
  const selectedOverviewCell   = useBlueprintStore((s) => s.selectedOverviewCell);
  const overviewCellGenerating = useBlueprintStore((s) => s.overviewCellGenerating);
  const clearOverviewCell      = useBlueprintStore((s) => s.clearOverviewCell);
  const setOverviewMode        = useBlueprintStore((s) => s.setOverviewMode);
  const setSelectedNode        = useBlueprintStore((s) => s.setSelectedNode);
  const updateAction           = useBlueprintStore((s) => s.updateAction);
  const updateCellDescription  = useBlueprintStore((s) => s.updateCellDescription);

  const [activeTab, setActiveTab]     = useState<OverviewTab>('steps');
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft]   = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft]     = useState('');

  if (!blueprint || !selectedOverviewCell) return null;

  const { actorId, phaseId, actionId } = selectedOverviewCell;
  const actor = effectiveActors.find((a) => a.id === actorId);
  const phase = blueprint.phases.find((p) => p.id === phaseId);
  if (!actor || !phase) return null;

  const ActorIcon = ACTOR_ICONS[actor.order % ACTOR_ICONS.length] ?? Activity;
  const key = `${actorId}-${phaseId}`;
  const description = blueprint.overviewCellDescriptions?.[key] ?? null;

  const cellActions = blueprint.actions
    .filter((a) => a.actorId === actorId && a.phaseId === phaseId)
    .sort((a, b) => a.order - b.order);

  const repAction = blueprint.actions.find((a) => a.id === actionId) ?? cellActions[0];

  const allPainIds = new Set(cellActions.flatMap((a) => a.painPointIds));
  const allOppIds  = new Set(cellActions.flatMap((a) => a.opportunityIds));
  const allQIds    = new Set(cellActions.flatMap((a) => a.questionIds ?? []));
  const cellPains     = blueprint.painPoints.filter((p) => allPainIds.has(p.id));
  const cellOpps      = blueprint.opportunities.filter((o) => allOppIds.has(o.id));
  const cellQuestions = (blueprint.questions ?? []).filter((q) => allQIds.has(q.id));

  const tabs: { id: OverviewTab; label: string; count?: number }[] = [
    { id: 'steps',         label: 'Steps',     count: cellActions.length },
    { id: 'pains',         label: 'Pains',     count: cellPains.length },
    { id: 'opportunities', label: 'Opps',      count: cellOpps.length },
    { id: 'questions',     label: 'Questions', count: cellQuestions.length },
  ];

  return (
    <Panel
      animateFrom="left"
      style={{
        position: 'fixed',
        top: 102,
        left: 16,
        width: 420,
        maxHeight: 'calc(100vh - 118px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 48,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px 0', flexShrink: 0 }}>
        {/* Row 1: close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <IconButton icon={<X size={14} />} onClick={clearOverviewCell} title="Close" variant="ghost" />
        </div>

        {/* Row 2: actor icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${actor.color}18`, border: `1px solid ${actor.color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ActorIcon size={15} color={actor.color} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
            {actor.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span> {phase.name}
          </p>
        </div>

        {/* Editable overview card label (labelAbstract of representative action) */}
        {repAction && (
          <div style={{ marginBottom: 10 }}>
            {editingLabel ? (
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => {
                  const v = labelDraft.trim();
                  if (v) updateAction(repAction.id, { labelAbstract: v });
                  setEditingLabel(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingLabel(false);
                }}
                style={{ ...inputStyle, fontSize: 12, padding: '5px 9px' }}
              />
            ) : (
              <button
                onClick={() => { setLabelDraft(repAction.labelAbstract ?? repAction.label); setEditingLabel(true); }}
                title="Edit overview card label"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                  background: 'var(--surface-bg-muted)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)', padding: '4px 10px', cursor: 'text',
                  maxWidth: '100%', textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
              >
                {repAction.labelAbstract ?? repAction.label}
              </button>
            )}
          </div>
        )}

        {/* Editable AI description */}
        <div style={{ marginBottom: 14 }}>
          {editingDesc ? (
            <textarea
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={() => { updateCellDescription(actorId, phaseId, descDraft.trim()); setEditingDesc(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false); }}
              rows={3}
              style={{ ...inputStyle, fontSize: 13, resize: 'none', lineHeight: 1.6 }}
            />
          ) : overviewCellGenerating && !description ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              Generating description…
            </span>
          ) : (
            <div
              onClick={() => { setDescDraft(description ?? ''); setEditingDesc(true); }}
              style={{
                fontSize: 13,
                color: description ? 'var(--text-secondary)' : 'var(--text-muted)',
                lineHeight: 1.6,
                cursor: 'text',
                minHeight: 36,
                fontStyle: description ? 'normal' : 'italic',
              }}
            >
              {description ?? 'Click to add description…'}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {activeTab === 'steps' && (
          <StepsTab
            cellActions={cellActions}
            onNavigate={(id) => { setOverviewMode(false); setSelectedNode(id); }}
          />
        )}
        {activeTab === 'pains' && (
          <ItemsTab
            items={cellPains.map((p) => ({ id: p.id, text: p.description, badge: p.severity }))}
            accentColor="var(--accent-danger)"
            emptyText="No pain points in this cell."
            bgColor="rgba(239,68,68,0.05)"
            borderColor="rgba(239,68,68,0.2)"
          />
        )}
        {activeTab === 'opportunities' && (
          <ItemsTab
            items={cellOpps.map((o) => ({ id: o.id, text: o.description, badge: o.effort ? `${o.effort} effort` : undefined }))}
            accentColor="var(--accent-success)"
            emptyText="No opportunities in this cell."
            bgColor="rgba(34,197,94,0.05)"
            borderColor="rgba(34,197,94,0.2)"
          />
        )}
        {activeTab === 'questions' && (
          <ItemsTab
            items={cellQuestions.map((q) => ({ id: q.id, text: q.text, badge: q.type }))}
            accentColor="var(--accent-warning)"
            emptyText="No questions in this cell."
            bgColor="rgba(245,158,11,0.05)"
            borderColor="rgba(245,158,11,0.2)"
          />
        )}
      </div>
    </Panel>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepsTab({ cellActions, onNavigate }: { cellActions: Action[]; onNavigate: (id: string) => void }) {
  if (cellActions.length === 0) {
    return <p style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 13 }}>No steps in this cell.</p>;
  }
  return (
    <div style={{ padding: '8px 0' }}>
      {cellActions.map((action, i) => {
        const painCount = action.painPointIds.length;
        const oppCount  = action.opportunityIds.length;
        const qCount    = (action.questionIds ?? []).length;
        return (
          <button
            key={action.id}
            onClick={() => onNavigate(action.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              width: '100%', padding: '10px 18px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2, minWidth: 18, flexShrink: 0 }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}>
                {action.label}
              </p>
              {action.labelDetailed && (
                <p style={{
                  fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {action.labelDetailed}
                </p>
              )}
            </div>
            {(painCount > 0 || oppCount > 0 || qCount > 0) && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', marginTop: 2 }}>
                {painCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--accent-danger)' }}>
                    <AlertCircle size={11} /> {painCount}
                  </span>
                )}
                {oppCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--accent-success)' }}>
                    <Lightbulb size={11} /> {oppCount}
                  </span>
                )}
                {qCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--accent-warning)' }}>
                    <HelpCircle size={11} /> {qCount}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ItemsTab({
  items, accentColor, emptyText, bgColor, borderColor,
}: {
  items: { id: string; text: string; badge?: string }[];
  accentColor: string;
  emptyText: string;
  bgColor: string;
  borderColor: string;
}) {
  if (items.length === 0) {
    return <p style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 13 }}>{emptyText}</p>;
  }
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} style={{
          padding: '10px 12px', background: bgColor, border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          {item.badge && (
            <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'capitalize', letterSpacing: '0.04em' }}>
              {item.badge}
            </span>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            {item.text}
          </p>
        </div>
      ))}
    </div>
  );
}
