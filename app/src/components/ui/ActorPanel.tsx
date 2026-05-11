import { useState, useEffect } from 'react';
import { X, User, Globe, Building2, Users, Activity, Camera, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { Panel, IconButton, FieldBlock, inputStyle } from './primitives';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const ACTOR_ICONS = [User, Globe, Building2, Users];

export function ActorPanel() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const selectedActorId = useBlueprintStore((s) => s.selectedActorId);
  const actorPanelOpen = useBlueprintStore((s) => s.actorPanelOpen);
  const setSelectedActor = useBlueprintStore((s) => s.setSelectedActor);
  const updateActor = useBlueprintStore((s) => s.updateActor);
  const removeActor = useBlueprintStore((s) => s.removeActor);

  const actor = blueprint?.actors.find((a) => a.id === selectedActorId) ?? null;

  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [goalsDraft, setGoalsDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (actor) {
      setNameDraft(actor.name);
      setBioDraft(actor.bio ?? '');
      setGoalsDraft(actor.goals ?? '');
    }
  }, [actor?.id]);

  if (!actorPanelOpen || !actor) return null;

  const ActorIcon = ACTOR_ICONS[actor.order % ACTOR_ICONS.length] ?? Activity;

  const save = (field: 'name' | 'bio' | 'goals', value: string) => {
    const trimmed = value.trim();
    const current = field === 'name' ? actor.name : actor[field] ?? '';
    if (trimmed !== current) updateActor(actor.id, { [field]: trimmed || undefined });
  };

  return (
    <>
    <Panel
      animateFrom="left"
      style={{
        position: 'fixed',
        top: 102,
        left: 16,
        width: 340,
        maxHeight: 'calc(100vh - 118px)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 16px 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: `${actor.color}18`,
            border: `1px solid ${actor.color}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ActorIcon size={16} color={actor.color} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Actor</span>
        </div>
        <IconButton icon={<X size={13} />} onClick={() => setSelectedActor(null)} />
      </div>

      <div style={{ overflowY: 'auto', flexGrow: 1, padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* AI Image placeholder */}
        <div style={{
          width: '100%',
          height: 160,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-bg-muted)',
          border: '1px dashed var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text-muted)',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: `${actor.color}18`,
            border: `1px solid ${actor.color}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Camera size={20} color={actor.color} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 500 }}>AI portrait</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coming soon</span>
        </div>

        {/* Name */}
        <FieldBlock label="Name">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => save('name', nameDraft)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={inputStyle}
          />
        </FieldBlock>

        {/* Bio */}
        <FieldBlock label="Who they are">
          <textarea
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            onBlur={() => save('bio', bioDraft)}
            placeholder="Describe this actor's role and context…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </FieldBlock>

        {/* Goals */}
        <FieldBlock label="Goals">
          <textarea
            value={goalsDraft}
            onChange={(e) => setGoalsDraft(e.target.value)}
            onBlur={() => save('goals', goalsDraft)}
            placeholder="What does this actor want to achieve?"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </FieldBlock>

      </div>

      {/* Delete actor */}
      <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
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
          Delete actor
        </button>
      </div>
    </Panel>

    {confirmDelete && (
      <ConfirmDeleteModal
        title={`Delete actor "${actor.name}"`}
        description="This will remove the actor and all their steps, pain points, opportunities, and questions."
        onConfirm={() => { removeActor(actor.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}
