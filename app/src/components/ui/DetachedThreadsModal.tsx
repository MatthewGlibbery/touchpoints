import { useMemo, useState } from 'react';
import { X, Trash2, Link2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import {
  useCommentsStore,
  buildAnchorRegistry,
  isAnchorDetached,
} from '../../store/comments.store';
import { renderCommentBody } from './MentionInput';
import type { CommentAnchor } from '../../types/blueprint';

type ReanchorChoice = {
  type: CommentAnchor['type'];
  id: string;
  label: string;
};

export function DetachedThreadsModal() {
  const open = useCommentsStore((s) => s.detachedModalOpen);
  const setOpen = useCommentsStore((s) => s.setDetachedModalOpen);
  const comments = useCommentsStore((s) => s.comments);
  const reattachThread = useCommentsStore((s) => s.reattachThread);
  const removeComment = useCommentsStore((s) => s.removeComment);

  const blueprint = useBlueprintStore((s) => s.blueprint);
  const effectiveActors = useBlueprintStore((s) => s.effectiveActors);
  const userId = useBlueprintStore((s) => s.userId);

  // Detached root comments (the rest of the thread is implied)
  const detachedRoots = useMemo(() => {
    if (!blueprint) return [];
    const reg = buildAnchorRegistry(blueprint);
    const ids = new Set(blueprint.actions.map((a) => a.id));
    return comments
      .filter((c) => c.parentCommentId === null)
      .filter((c) => isAnchorDetached(c.anchor, reg, ids));
  }, [comments, blueprint]);

  // Available re-anchor targets
  const reanchorOptions = useMemo<ReanchorChoice[]>(() => {
    if (!blueprint) return [];
    const out: ReanchorChoice[] = [];
    for (const a of blueprint.actions) {
      const ph = blueprint.phases.find((p) => p.id === a.phaseId);
      out.push({
        type: 'action',
        id: a.id,
        label: ph ? `Step: ${a.label} (${ph.name})` : `Step: ${a.label}`,
      });
    }
    for (const p of blueprint.phases) {
      out.push({ type: 'phase', id: p.id, label: `Phase: ${p.name}` });
    }
    for (const ac of effectiveActors) {
      out.push({ type: 'actor', id: ac.id, label: `Actor: ${ac.name}` });
    }
    return out;
  }, [blueprint]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '80vh',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Detached threads
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Re-attach to an existing element, or permanently delete.
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
          {detachedRoots.length === 0 && (
            <div
              style={{
                padding: 32,
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No detached threads. All comments are anchored to existing elements.
            </div>
          )}

          {detachedRoots.map((root) => (
            <DetachedRow
              key={root.id}
              root={root}
              options={reanchorOptions}
              currentUserId={userId}
              onReattach={(anchor) => reattachThread(root.id, anchor)}
              onDelete={() => removeComment(root.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetachedRow({
  root,
  options,
  currentUserId,
  onReattach,
  onDelete,
}: {
  root: ReturnType<typeof useCommentsStore.getState>['comments'][number];
  options: ReanchorChoice[];
  currentUserId: string | null;
  onReattach: (anchor: CommentAnchor) => Promise<void>;
  onDelete: () => Promise<void> | void;
}) {
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handlePick(opt: ReanchorChoice) {
    setSubmitting(true);
    await onReattach({ type: opt.type, id: opt.id });
    setSubmitting(false);
    setPicking(false);
  }

  return (
    <div
      style={{
        padding: 14,
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 10,
        background: 'var(--surface-bg-muted)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {root.authorName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(root.createdAt).toLocaleString()}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--accent-warning)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Was: {root.anchor.type}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          background: 'var(--surface-bg)',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          maxHeight: 120,
          overflow: 'hidden',
        }}
      >
        {renderCommentBody(root.body, currentUserId)}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {!picking && !confirmDelete && (
          <>
            <button
              type="button"
              onClick={() => setPicking(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent-primary)',
                background: 'var(--accent-primary-soft)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Link2 size={11} />
              Re-attach to…
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent-danger)',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={11} />
              Delete thread
            </button>
          </>
        )}

        {picking && (
          <div style={{ width: '100%' }}>
            <select
              autoFocus
              disabled={submitting}
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const opt = options.find((o) => `${o.type}:${o.id}` === v);
                if (opt) handlePick(opt);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 12,
                color: 'var(--text-primary)',
                background: 'var(--surface-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'inherit',
              }}
            >
              <option value="" disabled>
                Choose a target element…
              </option>
              {options.map((o) => (
                <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPicking(false)}
              disabled={submitting}
              style={{
                marginTop: 6,
                padding: '4px 8px',
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {confirmDelete && (
          <div
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              Permanently delete this thread (and all replies)?
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={async () => {
                  await onDelete();
                  setConfirmDelete(false);
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent-danger)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
