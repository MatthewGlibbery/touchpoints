import { useState, useEffect } from 'react';
import { X, User, Globe, Building2, Users, Activity, Sparkles, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';
import { useBlueprintStore } from '../../store/blueprint.store';
import { Panel, IconButton, FieldBlock, TabBar, inputStyle } from './primitives';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { animateToViewport, captureViewport } from '../../lib/viewportBridge';
import { computeColumnData } from '../../lib/layout';

type Tab = 'details' | 'steps' | 'pains' | 'opportunities' | 'questions';
const ACTOR_ICONS = [User, Globe, Building2, Users];

export function PhaseInspector() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const selectedPhaseId = useBlueprintStore((s) => s.selectedPhaseId);
  const phaseInspectorOpen = useBlueprintStore((s) => s.phaseInspectorOpen);
  const setSelectedPhase = useBlueprintStore((s) => s.setSelectedPhase);
  const updatePhase = useBlueprintStore((s) => s.updatePhase);
  const removePhase = useBlueprintStore((s) => s.removePhase);
  const rfNodes = useBlueprintStore((s) => s.rfNodes);

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [confirmDeletePhase, setConfirmDeletePhase] = useState(false);

  const phase = blueprint?.phases.find((p) => p.id === selectedPhaseId) ?? null;

  const sortedPhases = blueprint ? [...blueprint.phases].sort((a, b) => a.order - b.order) : [];
  const phaseIdx = sortedPhases.findIndex((p) => p.id === selectedPhaseId);
  const prevPhase = phaseIdx > 0 ? sortedPhases[phaseIdx - 1] : null;
  const nextPhase = phaseIdx >= 0 && phaseIdx < sortedPhases.length - 1 ? sortedPhases[phaseIdx + 1] : null;

  const navigateToPhase = (targetPhaseId: string) => {
    setSelectedPhase(targetPhaseId);
    const targetNode = rfNodes.find((n) => n.id === `phase-${targetPhaseId}`);
    if (!targetNode) return;
    const current = captureViewport();
    if (!current) return;
    const nodeWidth = (targetNode.data as any).width as number ?? 280;
    const centerX = targetNode.position.x + nodeWidth / 2;
    animateToViewport({ x: window.innerWidth / 2 - centerX * current.zoom, y: current.y, zoom: current.zoom }, 600);
  };

  const phaseActions = phase
    ? (blueprint?.actions ?? []).filter((a) => a.phaseId === phase.id)
    : [];

  const phasePains = blueprint
    ? blueprint.painPoints.filter((pp) =>
        pp.actionIds.some((aid) => phaseActions.find((a) => a.id === aid))
      )
    : [];

  const phaseOpps = blueprint
    ? blueprint.opportunities.filter((o) =>
        o.actionIds.some((aid) => phaseActions.find((a) => a.id === aid))
      )
    : [];

  const phaseQuestions = blueprint
    ? (blueprint.questions ?? []).filter((q) =>
        q.actionIds.some((aid) => phaseActions.find((a) => a.id === aid))
      )
    : [];

  useEffect(() => {
    if (phase) {
      setNameDraft(phase.name);
      setDescDraft(phase.description ?? '');
    }
    setActiveTab('details');
  }, [phase?.id]);

  if (!phaseInspectorOpen || !phase) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'steps', label: 'Steps', count: phaseActions.length || undefined },
    { id: 'pains', label: 'Pains', count: phasePains.length || undefined },
    { id: 'opportunities', label: 'Opps', count: phaseOpps.length || undefined },
    { id: 'questions', label: 'Questions', count: phaseQuestions.length || undefined },
  ];

  const generateDescription = async () => {
    if (!blueprint) return;
    setGenerating(true);
    try {
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const actorNames = [...new Set(
        phaseActions.map((a) => blueprint.actors.find((ac) => ac.id === a.actorId)?.name ?? 'Unknown')
      )].join(', ');

      const stepLabels = phaseActions.map((a) => `- ${a.label}`).join('\n');
      const prompt = `Service blueprint phase: "${phase.name}"
Actors involved: ${actorNames || 'none'}
Steps in this phase:
${stepLabels || '(no steps yet)'}

Write a concise 1-2 sentence description of what this phase of the service journey involves and why it matters. Be specific to the context above. Return only the description text, no preamble.`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find((b) => b.type === 'text');
      if (text && text.type === 'text') {
        const desc = text.text.trim();
        setDescDraft(desc);
        updatePhase(phase.id, { description: desc });
      }
    } catch (_) {
      // silently fail — user can type manually
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Panel
      animateFrom="left"
      style={{
        position: 'fixed', top: 102, left: 16,
        width: 420, maxHeight: 'calc(100vh - 118px)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header: arrows top-left, close top-right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            icon={<ChevronLeft size={14} />}
            onClick={() => prevPhase && navigateToPhase(prevPhase.id)}
            style={{ opacity: prevPhase ? 1 : 0.3, pointerEvents: prevPhase ? 'auto' : 'none' }}
          />
          <IconButton
            icon={<ChevronRight size={14} />}
            onClick={() => nextPhase && navigateToPhase(nextPhase.id)}
            style={{ opacity: nextPhase ? 1 : 0.3, pointerEvents: nextPhase ? 'auto' : 'none' }}
          />
        </div>
        <IconButton icon={<X size={13} />} onClick={() => setSelectedPhase(null)} />
      </div>

      {/* Phase name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px 14px', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.name}</span>
      </div>

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ overflowY: 'auto', flexGrow: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {activeTab === 'details' && (
          <>
            <FieldBlock label="Phase name">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => { const v = nameDraft.trim(); if (v && v !== phase.name) updatePhase(phase.id, { name: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                style={inputStyle}
              />
            </FieldBlock>

            <FieldBlock label="Description">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={() => {
                    const v = descDraft.trim();
                    if (v !== (phase.description ?? '')) updatePhase(phase.id, { description: v || undefined });
                  }}
                  placeholder="Describe what happens in this phase…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
                <button
                  onClick={generateDescription}
                  disabled={generating}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    background: generating ? 'var(--surface-bg-muted)' : 'var(--accent-primary-soft)',
                    color: generating ? 'var(--text-muted)' : 'var(--accent-primary)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    alignSelf: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                >
                  <Sparkles size={12} />
                  {generating ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>
            </FieldBlock>
          </>
        )}

        {activeTab === 'steps' && (() => {
          if (phaseActions.length === 0) {
            return <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No steps in this phase yet.</p>;
          }
          const { phaseColumns } = computeColumnData(blueprint!);
          const col = phaseColumns.get(phase.id);
          const colCount = col?.colCount ?? 1;
          const columns: number[] = [];
          for (let i = 0; i < colCount; i++) {
            if (phaseActions.some((a) => a.order === i)) columns.push(i);
          }
          return (
            <>
              {columns.map((colOrder) => {
                const colActions = phaseActions.filter((a) => a.order === colOrder);
                return (
                  <div key={colOrder}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                      Step {colOrder + 1}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {colActions.map((action) => {
                        const actor = blueprint?.actors.find((a) => a.id === action.actorId);
                        const ActorIcon = ACTOR_ICONS[(actor?.order ?? 0) % ACTOR_ICONS.length] ?? Activity;
                        return (
                          <div
                            key={action.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '9px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--surface-bg-muted)',
                            }}
                          >
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 7,
                              background: `${actor?.color ?? '#888'}18`,
                              border: `1px solid ${actor?.color ?? '#888'}35`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <ActorIcon size={13} color={actor?.color ?? 'var(--text-muted)'} />
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{action.label}</p>
                              {actor && (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 1 }}>{actor.name}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}

        {activeTab === 'pains' && (
          <>
            {phasePains.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No pain points in this phase.</p>
            )}
            {phasePains.map((pp) => (
              <div
                key={pp.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{pp.description || <em style={{ color: 'var(--text-muted)' }}>No description</em>}</p>
                <span style={{
                  alignSelf: 'flex-start',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#EF4444',
                  textTransform: 'capitalize',
                }}>{pp.severity}</span>
              </div>
            ))}
          </>
        )}

        {activeTab === 'opportunities' && (
          <>
            {phaseOpps.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No opportunities in this phase.</p>
            )}
            {phaseOpps.map((o) => (
              <div
                key={o.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(34,197,94,0.05)',
                  border: '1px solid rgba(34,197,94,0.15)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{o.description || <em style={{ color: 'var(--text-muted)' }}>No description</em>}</p>
                {o.effort && (
                  <span style={{
                    alignSelf: 'flex-start',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(34,197,94,0.12)',
                    color: '#22C55E',
                    textTransform: 'capitalize',
                  }}>{o.effort} effort</span>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === 'questions' && (
          <>
            {phaseQuestions.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No questions in this phase.</p>
            )}
            {phaseQuestions.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(245,158,11,0.05)',
                  border: '1px solid rgba(245,158,11,0.15)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{q.text || <em style={{ color: 'var(--text-muted)' }}>No text</em>}</p>
                {q.type && (
                  <span style={{
                    alignSelf: 'flex-start',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#F59E0B',
                    textTransform: 'capitalize',
                  }}>{q.type}</span>
                )}
              </div>
            ))}
          </>
        )}

      </div>

      {/* Delete phase button — only on Details tab */}
      {activeTab === 'details' && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <button
            onClick={() => setConfirmDeletePhase(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--accent-danger)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <Trash2 size={13} />
            Delete phase
          </button>
        </div>
      )}

      {confirmDeletePhase && (
        <ConfirmDeleteModal
          title="Delete this phase?"
          description={`This will permanently remove "${phase.name}" and all its steps, pain points, opportunities, and questions.`}
          onConfirm={() => { setConfirmDeletePhase(false); removePhase(phase.id); }}
          onCancel={() => setConfirmDeletePhase(false)}
        />
      )}
    </Panel>
  );
}
