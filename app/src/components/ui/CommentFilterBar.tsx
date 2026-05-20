import { useMemo } from 'react';
import { useBlueprintStore } from '../../store/blueprint.store';
import {
  useCommentsStore,
  buildAnchorRegistry,
  filterComments,
  type CommentFilter,
} from '../../store/comments.store';

const FILTERS: { id: CommentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'me', label: '@Me' },
  { id: 'unresolved', label: 'Unresolved' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'detached', label: 'Detached' },
];

export function CommentFilterBar() {
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const userId = useBlueprintStore((s) => s.userId);

  const comments = useCommentsStore((s) => s.comments);
  const filter = useCommentsStore((s) => s.filter);
  const setFilter = useCommentsStore((s) => s.setFilter);
  const setDetachedModalOpen = useCommentsStore((s) => s.setDetachedModalOpen);

  const counts = useMemo(() => {
    const reg = buildAnchorRegistry(blueprint);
    const ids = new Set((blueprint?.actions ?? []).map((a) => a.id));
    const roots = comments.filter((x) => x.parentCommentId === null);
    const c: Record<CommentFilter, number> = {
      all: roots.length, me: 0, unresolved: 0, resolved: 0, detached: 0,
    };
    for (const f of FILTERS) {
      if (f.id === 'all') continue;
      const matched = filterComments(comments, f.id, userId, reg, ids);
      const rootIds = new Set<string>();
      for (const m of matched) {
        rootIds.add(m.parentCommentId ?? m.id);
      }
      c[f.id] = rootIds.size;
    }
    return c;
  }, [blueprint, comments, userId]);

  if (!commentMode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-pill)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {FILTERS.map((f) => {
        const active = filter === f.id;
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              // Clicking 'Detached' twice (or while already active) opens the
              // re-attach modal. First click just sets the filter.
              if (f.id === 'detached' && active) {
                setDetachedModalOpen(true);
              } else {
                setFilter(f.id);
              }
            }}
            title={f.id === 'detached' && active ? 'Click again or use Manage to re-attach' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: active ? '#fff' : 'var(--text-secondary)',
              background: active ? 'var(--accent-primary)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
          >
            {f.label}
            {count > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  background: active ? '#fff' : 'var(--surface-bg-muted)',
                  borderRadius: 8,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {filter === 'detached' && counts.detached > 0 && (
        <button
          type="button"
          onClick={() => setDetachedModalOpen(true)}
          style={{
            marginLeft: 4,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent-primary)',
            background: 'var(--accent-primary-soft)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
          }}
        >
          Manage…
        </button>
      )}
    </div>
  );
}
