import { useState, useEffect, useRef } from 'react';
import { X, User, Globe, Building2, Users, Activity, Plus, Trash2, Diamond, Tag as TagIcon, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { PainPoint, Opportunity, Question, ActionMedia } from '../../types/blueprint';
import { Panel, IconButton, FieldBlock, TabBar, inputStyle } from './primitives';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ThreadView } from './CommentThread';
import { useCommentsStore, commentCountForAnchor } from '../../store/comments.store';
import { uploadActionMedia, mediaTypeFromFile } from '../../lib/upload';
import { getBlueprintForVersion } from '../../lib/layout';

type Tab = 'step' | 'pains' | 'opportunities' | 'questions' | 'comments';
const ACTOR_ICONS = [User, Globe, Building2, Users];

export function NodeInspector() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const selectedNodeId = useBlueprintStore((s) => s.selectedNodeId);
  const inspectorOpen = useBlueprintStore((s) => s.inspectorOpen);
  const setInspectorOpen = useBlueprintStore((s) => s.setInspectorOpen);
  const updateAction = useBlueprintStore((s) => s.updateAction);
  const addPainPoint = useBlueprintStore((s) => s.addPainPoint);
  const updatePainPoint = useBlueprintStore((s) => s.updatePainPoint);
  const removePainPoint = useBlueprintStore((s) => s.removePainPoint);
  const addOpportunity = useBlueprintStore((s) => s.addOpportunity);
  const updateOpportunity = useBlueprintStore((s) => s.updateOpportunity);
  const removeOpportunity = useBlueprintStore((s) => s.removeOpportunity);
  const addQuestion = useBlueprintStore((s) => s.addQuestion);
  const updateQuestion = useBlueprintStore((s) => s.updateQuestion);
  const removeQuestion = useBlueprintStore((s) => s.removeQuestion);
  const addTouchpointTag = useBlueprintStore((s) => s.addTouchpointTag);
  const toggleActionTouchpointLabel = useBlueprintStore((s) => s.toggleActionTouchpointLabel);
  const removeAction = useBlueprintStore((s) => s.removeAction);
  const setLightboxUrl = useBlueprintStore((s) => s.setLightboxUrl);
  const setSelectedNode = useBlueprintStore((s) => s.setSelectedNode);
  const animateToNode = useBlueprintStore((s) => s.animateToNode);
  const inspectorRequestedTab = useBlueprintStore((s) => s.inspectorRequestedTab);
  const clearInspectorRequestedTab = useBlueprintStore((s) => s.clearInspectorRequestedTab);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const guestCanComment = useBlueprintStore((s) => s.guestCanComment);
  const addGuestPainPoint = useBlueprintStore((s) => s.addGuestPainPoint);
  const addGuestOpportunity = useBlueprintStore((s) => s.addGuestOpportunity);
  const addGuestQuestion = useBlueprintStore((s) => s.addGuestQuestion);

  const commentsList = useCommentsStore((s) => s.comments);

  // Edit lock: any input/edit action is gated. Distinct from `isGuestView` which
  // also flips the UI to guest variants — commentMode keeps owner UI but disables edits.
  const editLocked = isGuestView || commentMode || isCollaboratorView;

  const [activeTab, setActiveTab] = useState<Tab>('step');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [labelDraft, setLabelDraft] = useState('');
  const [detailDraft, setDetailDraft] = useState('');

  // Tracks which tab the guest is drafting a new item for (deferred insert until non-empty)
  const [guestDraft, setGuestDraft] = useState<'pain' | 'opp' | 'question' | null>(null);

  // Use the effective (versioned) blueprint for reading actions/pains/opps/questions
  const activeVersionId = useBlueprintStore((s) => s.activeVersionId);
  const effectiveBp = blueprint ? getBlueprintForVersion(blueprint, activeVersionId) : null;

  const action = effectiveBp?.actions.find((a) => a.id === selectedNodeId) ?? null;
  const actor = action ? blueprint?.actors.find((a) => a.id === action.actorId) : null;
  const painPoints = action ? effectiveBp!.painPoints.filter((p) => action.painPointIds.includes(p.id)) : [];
  const opportunities = action ? effectiveBp!.opportunities.filter((o) => action.opportunityIds.includes(o.id)) : [];
  const questions = action ? (effectiveBp!.questions ?? []).filter((q) => (action.questionIds ?? []).includes(q.id)) : [];

  // All actions sorted by phase order, then substep order — for cross-phase prev/next navigation
  const allActionsOrdered = blueprint
    ? [...blueprint.actions].sort((a, b) => {
        const phaseOrderA = blueprint.phases.find((p) => p.id === a.phaseId)?.order ?? 0;
        const phaseOrderB = blueprint.phases.find((p) => p.id === b.phaseId)?.order ?? 0;
        if (phaseOrderA !== phaseOrderB) return phaseOrderA - phaseOrderB;
        return a.order - b.order;
      })
    : [];
  const actionIdx = allActionsOrdered.findIndex((a) => a.id === action?.id);
  const prevAction = actionIdx > 0 ? allActionsOrdered[actionIdx - 1] : null;
  const nextAction = actionIdx >= 0 && actionIdx < allActionsOrdered.length - 1 ? allActionsOrdered[actionIdx + 1] : null;

  const navigateToAction = (targetActionId: string) => {
    setSelectedNode(targetActionId);
    animateToNode(targetActionId);
  };

  useEffect(() => {
    if (action) {
      setLabelDraft(action.label);
      setDetailDraft(action.labelDetailed ?? '');
    }
    // Apply a requested tab (from badge click), or default to details
    const requested = useBlueprintStore.getState().inspectorRequestedTab;
    setActiveTab((requested as Tab) ?? 'step');
    if (requested) clearInspectorRequestedTab();
    setGuestDraft(null);
  }, [action?.id]);

  // Discard any pending draft when switching tabs
  useEffect(() => { setGuestDraft(null); }, [activeTab]);

  // Handle badge click on the already-selected node (action?.id doesn't change)
  useEffect(() => {
    if (inspectorRequestedTab) {
      setActiveTab(inspectorRequestedTab as Tab);
      clearInspectorRequestedTab();
    }
  }, [inspectorRequestedTab]);

  if (!inspectorOpen || !action || !actor) return null;

  const ActorIcon = ACTOR_ICONS[actor.order % ACTOR_ICONS.length] ?? Activity;

  const commentCount = action ? commentCountForAnchor(commentsList, { type: 'action', id: action.id }) : 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'step', label: 'Step' },
    { id: 'pains', label: 'Pains', count: painPoints.length || undefined },
    { id: 'opportunities', label: 'Opps', count: opportunities.length || undefined },
    { id: 'questions', label: 'Questions', count: questions.length || undefined },
    { id: 'comments', label: 'Comments', count: commentCount || undefined },
  ];

  return (
    <>
    <Panel
      animateFrom="left"
      style={{
        position: 'fixed', top: 102, left: 16,
        width: 420, maxHeight: 'calc(100vh - 118px)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header: arrows (top-left) + close (top-right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            icon={<ChevronLeft size={14} />}
            onClick={() => prevAction && navigateToAction(prevAction.id)}
            style={{ opacity: prevAction ? 1 : 0.3, pointerEvents: prevAction ? 'auto' : 'none' }}
          />
          <IconButton
            icon={<ChevronRight size={14} />}
            onClick={() => nextAction && navigateToAction(nextAction.id)}
            style={{ opacity: nextAction ? 1 : 0.3, pointerEvents: nextAction ? 'auto' : 'none' }}
          />
        </div>
        <IconButton icon={<X size={13} />} onClick={() => setInspectorOpen(false)} />
      </div>

      {/* Actor icon + step name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px 14px', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${actor.color}18`, border: `1px solid ${actor.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ActorIcon size={16} color={actor.color} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.label}</span>
      </div>

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ overflowY: 'auto', flexGrow: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Step */}
        {activeTab === 'step' && (
          <>
            <FieldBlock label="Title">
              <input value={labelDraft} onChange={(e) => !editLocked && setLabelDraft(e.target.value)}
                onBlur={() => { if (editLocked) return; const v = labelDraft.trim(); if (v && v !== action.label) updateAction(action.id, { label: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                readOnly={editLocked}
                style={{ ...inputStyle, cursor: editLocked ? 'default' : undefined }} />
            </FieldBlock>
            <FieldBlock label="Details">
              <textarea value={detailDraft} onChange={(e) => !editLocked && setDetailDraft(e.target.value)}
                onBlur={() => { if (editLocked) return; const v = detailDraft.trim(); if (v !== (action.labelDetailed ?? '')) updateAction(action.id, { labelDetailed: v || undefined }); }}
                readOnly={editLocked}
                rows={4} style={{ ...inputStyle, resize: editLocked ? 'none' : 'vertical', lineHeight: 1.6, cursor: editLocked ? 'default' : undefined }} />
            </FieldBlock>

            {/* TODO: Bring back Tags and Touchpoints sections in a future iteration */}

            {/* Media */}
            <FieldBlock label="Media">
              <MediaSection action={action} blueprintId={blueprint!.id} onUpdate={(media) => updateAction(action.id, { media })} onLightbox={setLightboxUrl} />
            </FieldBlock>
          </>
        )}

        {/* Pain points */}
        {activeTab === 'pains' && (
          <>
            {painPoints.map((pp) => (
              <PainPointItem key={pp.id} pp={pp}
                isGuestView={isGuestView}
                commentMode={commentMode}
                onUpdate={(patch) => updatePainPoint(pp.id, patch)}
                onRemove={() => removePainPoint(pp.id)} />
            ))}
            {isGuestView && guestDraft === 'pain' && (
              <GuestDraftItem
                placeholder="Describe the pain point…"
                color="rgba(239,68,68,"
                onSubmit={(text) => { addGuestPainPoint(action.id, text, 'medium'); setGuestDraft(null); }}
                onDiscard={() => setGuestDraft(null)}
              />
            )}
            {!editLocked && <AddButton onClick={() => addPainPoint(action.id, '', 'medium')} label="Add pain point" />}
            {isGuestView && guestCanComment && !guestDraft && <AddButton onClick={() => setGuestDraft('pain')} label="Add pain point" />}
          </>
        )}

        {/* Opportunities */}
        {activeTab === 'opportunities' && (
          <>
            {opportunities.map((opp) => (
              <OppItem key={opp.id} opp={opp}
                isGuestView={isGuestView}
                commentMode={commentMode}
                onUpdate={(patch) => updateOpportunity(opp.id, patch)}
                onRemove={() => removeOpportunity(opp.id)} />
            ))}
            {isGuestView && guestDraft === 'opp' && (
              <GuestDraftItem
                placeholder="Describe the opportunity…"
                color="rgba(34,197,94,"
                onSubmit={(text) => { addGuestOpportunity(action.id, text); setGuestDraft(null); }}
                onDiscard={() => setGuestDraft(null)}
              />
            )}
            {!editLocked && <AddButton onClick={() => addOpportunity(action.id, '')} label="Add opportunity" />}
            {isGuestView && guestCanComment && !guestDraft && <AddButton onClick={() => setGuestDraft('opp')} label="Add opportunity" />}
          </>
        )}

        {/* Questions */}
        {activeTab === 'questions' && (
          <>
            {questions.map((q) => (
              <QuestionItem key={q.id} q={q}
                isGuestView={isGuestView}
                commentMode={commentMode}
                onUpdate={(patch) => updateQuestion(q.id, patch)}
                onRemove={() => removeQuestion(q.id)} />
            ))}
            {isGuestView && guestDraft === 'question' && (
              <GuestDraftItem
                placeholder="What do you need to know?"
                color="rgba(245,158,11,"
                onSubmit={(text) => { addGuestQuestion(action.id, text); setGuestDraft(null); }}
                onDiscard={() => setGuestDraft(null)}
              />
            )}
            {!editLocked && <AddButton onClick={() => addQuestion(action.id, '')} label="Add question" />}
            {isGuestView && guestCanComment && !guestDraft && <AddButton onClick={() => setGuestDraft('question')} label="Add question" />}
          </>
        )}

        {/* Comments */}
        {activeTab === 'comments' && (
          <ThreadView anchor={{ type: 'action', id: action.id }} />
        )}

      </div>

      {/* Delete step — only on Step tab, not in guest view or comment mode */}
      {activeTab === 'step' && !editLocked && <div style={{ padding: '0 18px 16px', flexShrink: 0 }}>
        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 12 }} />
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-danger)',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; }}
        >
          <Trash2 size={12} />
          Delete step
        </button>
      </div>}
    </Panel>

    {confirmDelete && (
      <ConfirmDeleteModal
        title="Delete step"
        description={`Delete "${action.label}"? This will also remove any associated pain points, opportunities, and questions.`}
        onConfirm={() => { removeAction(action.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────


function AIBadge() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', fontSize: 10, fontWeight: 600,
      background: 'rgba(139,92,246,0.1)', color: '#8B5CF6',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 'var(--radius-pill)',
      flexShrink: 0,
    }}>
      <Sparkles size={9} />
      AI
    </div>
  );
}

function GuestBadge({ name }: { name?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', fontSize: 10, fontWeight: 600,
      background: 'rgba(20,184,166,0.1)', color: '#14B8A6',
      border: '1px solid rgba(20,184,166,0.25)',
      borderRadius: 'var(--radius-pill)',
      flexShrink: 0,
    }}>
      <User size={9} />
      {name ? name : 'Guest'}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
      fontSize: 12, fontWeight: 500, color: 'var(--accent-primary)',
      background: 'none', border: 'none', cursor: 'pointer',
    }}>
      <Plus size={13} />
      {label}
    </button>
  );
}

function PainPointItem({ pp, isGuestView, commentMode, onUpdate, onRemove }: { pp: PainPoint; isGuestView?: boolean; commentMode?: boolean; onUpdate: (p: Partial<Pick<PainPoint, 'description' | 'severity'>>) => void; onRemove: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const readonly = (isGuestView && !pp.guestContributed) || !!commentMode;
  useEffect(() => { if (pp.description === '' && ref.current) ref.current.focus(); }, []);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 10px', paddingRight: 36, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)' }}>
      {!readonly && <IconButton icon={<X size={11} />} onClick={onRemove} size={22} style={{ position: 'absolute', top: 8, right: 8 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <SeverityPicker value={pp.severity} onChange={(s) => !readonly && onUpdate({ severity: s })} />
        {pp.aiGenerated && <AIBadge />}
        {pp.guestContributed && <GuestBadge name={pp.guestName} />}
      </div>
      <textarea ref={ref} value={pp.description} placeholder="Describe the pain point…"
        readOnly={readonly}
        onChange={(e) => !readonly && onUpdate({ description: e.target.value })}
        rows={2} style={{ ...inputStyle, resize: 'none', background: 'transparent', border: '1px solid transparent', padding: '2px 4px', fontSize: 13 }} />
    </div>
  );
}

function OppItem({ opp, isGuestView, commentMode, onUpdate, onRemove }: { opp: Opportunity; isGuestView?: boolean; commentMode?: boolean; onUpdate: (p: Partial<Pick<Opportunity, 'description' | 'effort'>>) => void; onRemove: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const readonly = (isGuestView && !opp.guestContributed) || !!commentMode;
  useEffect(() => { if (opp.description === '' && ref.current) ref.current.focus(); }, []);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 10px', paddingRight: 36, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 'var(--radius-md)' }}>
      {!readonly && <IconButton icon={<X size={11} />} onClick={onRemove} size={22} style={{ position: 'absolute', top: 8, right: 8 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <EffortPicker value={opp.effort} onChange={(e) => !readonly && onUpdate({ effort: e })} />
        {opp.aiGenerated && <AIBadge />}
        {opp.guestContributed && <GuestBadge name={opp.guestName} />}
      </div>
      <textarea ref={ref} value={opp.description} placeholder="Describe the opportunity…"
        readOnly={readonly}
        onChange={(e) => !readonly && onUpdate({ description: e.target.value })}
        rows={2} style={{ ...inputStyle, resize: 'none', background: 'transparent', border: '1px solid transparent', padding: '2px 4px', fontSize: 13 }} />
    </div>
  );
}

function QuestionItem({ q, isGuestView, commentMode, onUpdate, onRemove }: { q: Question; isGuestView?: boolean; commentMode?: boolean; onUpdate: (p: Partial<Pick<Question, 'text' | 'type'>>) => void; onRemove: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const readonly = (isGuestView && !q.guestContributed) || !!commentMode;
  useEffect(() => { if (q.text === '' && ref.current) ref.current.focus(); }, []);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 10px', paddingRight: 36, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-md)' }}>
      {!readonly && <IconButton icon={<X size={11} />} onClick={onRemove} size={22} style={{ position: 'absolute', top: 8, right: 8 }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <QuestionTypePicker value={q.type} onChange={(t) => !readonly && onUpdate({ type: t })} />
        {q.aiGenerated && <AIBadge />}
        {q.guestContributed && <GuestBadge name={q.guestName} />}
      </div>
      <textarea ref={ref} value={q.text} placeholder="What do you need to know?"
        readOnly={readonly}
        onChange={(e) => !readonly && onUpdate({ text: e.target.value })}
        rows={2} style={{ ...inputStyle, resize: 'none', background: 'transparent', border: '1px solid transparent', padding: '2px 4px', fontSize: 13 }} />
    </div>
  );
}

function GuestDraftItem({ placeholder, color, onSubmit, onDiscard }: {
  placeholder: string;
  color: string; // rgba prefix, e.g. "rgba(239,68,68,"
  onSubmit: (text: string) => void;
  onDiscard: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef('');
  const doneRef = useRef(false);
  const [text, setText] = useState('');

  useEffect(() => { setTimeout(() => taRef.current?.focus(), 50); }, []);

  const commit = (discard?: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (!discard && textRef.current.trim()) onSubmit(textRef.current.trim());
    else onDiscard();
  };

  return (
    <div style={{
      padding: '10px 12px', background: `${color}0.05)`,
      border: `1px solid ${color}0.2)`, borderRadius: 'var(--radius-md)',
    }}>
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => { setText(e.target.value); textRef.current = e.target.value; }}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') commit(true);
        }}
        placeholder={placeholder}
        rows={2}
        style={{ ...inputStyle, resize: 'none', background: 'transparent', border: '1px solid transparent', padding: '2px 4px', fontSize: 13, display: 'block', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  );
}

function SeverityPicker({ value, onChange }: { value: PainPoint['severity']; onChange: (s: PainPoint['severity']) => void }) {
  const levels: PainPoint['severity'][] = ['low', 'medium', 'high'];
  const colors: Record<PainPoint['severity'], string> = { low: '#EF4444', medium: '#EF4444', high: '#EF4444' };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {levels.map((s) => (
        <button key={s} onClick={() => onChange(s)} style={{
          padding: '2px 9px', fontSize: 10, fontWeight: 600,
          borderRadius: 'var(--radius-pill)',
          background: value === s ? colors[s] : 'transparent',
          color: value === s ? '#fff' : 'var(--text-muted)',
          border: `1px solid ${value === s ? colors[s] : 'var(--border-subtle)'}`,
          cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '0.03em',
          transition: 'background 0.12s, color 0.12s',
        }}>
          {s}
        </button>
      ))}
    </div>
  );
}

function EffortPicker({ value, onChange }: { value: Opportunity['effort']; onChange: (e: Opportunity['effort']) => void }) {
  const levels: NonNullable<Opportunity['effort']>[] = ['low', 'medium', 'high', 'unsure'];
  const colors: Record<NonNullable<Opportunity['effort']>, string> = { low: '#22C55E', medium: '#22C55E', high: '#22C55E', unsure: '#22C55E' };

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {levels.map((e) => (
        <button key={e} onClick={() => onChange(value === e ? undefined : e)} style={{
          padding: '2px 9px', fontSize: 10, fontWeight: 600,
          borderRadius: 'var(--radius-pill)',
          background: value === e ? colors[e] : 'transparent',
          color: value === e ? '#fff' : 'var(--text-muted)',
          border: `1px solid ${value === e ? colors[e] : 'var(--border-subtle)'}`,
          cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '0.03em',
          transition: 'background 0.12s, color 0.12s',
        }}>
          {e}
        </button>
      ))}
    </div>
  );
}

function QuestionTypePicker({ value, onChange }: { value: Question['type']; onChange: (t: Question['type']) => void }) {
  const types: NonNullable<Question['type']>[] = ['technical', 'process'];
  const colors: Record<NonNullable<Question['type']>, string> = { technical: '#F59E0B', process: '#F59E0B' };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {types.map((t) => (
        <button key={t} onClick={() => onChange(value === t ? undefined : t)} style={{
          padding: '2px 9px', fontSize: 10, fontWeight: 600,
          borderRadius: 'var(--radius-pill)',
          background: value === t ? colors[t] : 'transparent',
          color: value === t ? '#fff' : 'var(--text-muted)',
          border: `1px solid ${value === t ? colors[t] : 'var(--border-subtle)'}`,
          cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '0.03em',
          transition: 'background 0.12s, color 0.12s',
        }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function DecisionPointToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 'var(--radius-pill)',
        background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
        color: active ? 'var(--accent-warning)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent-warning)' : 'var(--border-subtle)'}`,
        cursor: 'pointer',
        transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      <Diamond size={11} />
      Decision point
    </button>
  );
}

function TouchpointsSection({
  allTags,
  selectedTags,
  onToggle,
  onAddNew,
}: {
  allTags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onAddNew: (tag: string) => void;
}) {
  const [inputVal, setInputVal] = useState('');

  const handleAdd = () => {
    const v = inputVal.trim();
    if (!v) return;
    onAddNew(v);
    setInputVal('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggle(tag)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: active ? 'var(--accent-primary-soft)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                <TagIcon size={10} />
                {tag}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Add touchpoint (e.g. email, form, website)…"
          style={{ ...inputStyle, flex: 1, fontSize: 12 }}
        />
        <button
          onClick={handleAdd}
          disabled={!inputVal.trim()}
          style={{
            padding: '0 12px',
            background: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            fontWeight: 600,
            cursor: inputVal.trim() ? 'pointer' : 'not-allowed',
            opacity: inputVal.trim() ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function MediaSection({
  action,
  blueprintId,
  onUpdate,
  onLightbox,
}: {
  action: { id: string; media?: ActionMedia[] };
  blueprintId: string;
  onUpdate: (media: ActionMedia[]) => void;
  onLightbox: (url: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const current = action.media?.[0] ?? null;

  const setMedia = (item: ActionMedia | null) => {
    onUpdate(item ? [item] : []);
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    const result = await uploadActionMedia(file, blueprintId, action.id);
    if ('error' in result) {
      setUploadError(result.error);
    } else {
      setMedia({ id: `m-${Date.now()}`, type: mediaTypeFromFile(file), url: result.url });
    }
    setUploading(false);
  };

  const handleFiles = (files: FileList | File[]) => {
    const file = Array.from(files).find(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (file) handleFile(file);
  };

  const addFromUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    const type: ActionMedia['type'] = url.match(/\.(mp4|webm|mov)$/i) ? 'video' : url.match(/\.gif$/i) ? 'gif' : 'image';
    setMedia({ id: `m-${Date.now()}`, type, url });
    setUrlDraft('');
    setShowUrlInput(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // If there's already an image, show preview + delete
  if (current) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {(current.type === 'image' || current.type === 'gif') && (
            <div style={{ lineHeight: 0, cursor: 'zoom-in' }} onClick={() => onLightbox(current.url)}>
              <img
                src={current.url}
                alt=""
                style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}
          {current.type === 'video' && (
            <video
              src={current.url}
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
              muted preload="metadata" controls
            />
          )}
          <button
            onClick={() => setMedia(null)}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
            }}
            title="Remove image"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  // No image — show drop zone / browse / paste URL
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => { if (!showUrlInput) fileInputRef.current?.click(); }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '16px 12px',
          textAlign: 'center',
          cursor: showUrlInput ? 'default' : 'pointer',
          background: dragOver ? 'rgba(59,130,246,0.06)' : 'transparent',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
        />
        {uploading ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>
        ) : showUrlInput ? (
          <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <input
              ref={urlInputRef}
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFromUrl();
                if (e.key === 'Escape') { setShowUrlInput(false); setUrlDraft(''); }
              }}
              placeholder="Paste image URL…"
              style={{ ...inputStyle, flex: 1, fontSize: 12 }}
            />
            <button
              onClick={addFromUrl}
              disabled={!urlDraft.trim()}
              style={{
                padding: '0 10px',
                background: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontWeight: 600,
                cursor: urlDraft.trim() ? 'pointer' : 'not-allowed',
                opacity: urlDraft.trim() ? 1 : 0.4,
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowUrlInput(false); setUrlDraft(''); }}
              style={{
                padding: '0 8px',
                background: 'var(--surface-bg-muted)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Drop image here,{' '}
            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>browse</span>
            , or{' '}
            <span
              style={{ color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setShowUrlInput(true); }}
            >
              paste a URL
            </span>
          </span>
        )}
      </div>

      {uploadError && (
        <span style={{ fontSize: 11, color: 'var(--accent-danger)' }}>{uploadError}</span>
      )}
    </div>
  );
}


