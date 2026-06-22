import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, RotateCcw, MoreVertical, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import {
  useCommentsStore,
  commentsForAnchor,
  rootCommentForAnchor,
  repliesForRoot,
  reactionsForComment,
} from '../../store/comments.store';
import {
  COMMENT_REACTION_EMOJIS,
  type Actor,
  type Blueprint,
  type Comment,
  type CommentAnchor,
  type CommentReactionEmoji,
} from '../../types/blueprint';
import { MentionInput, renderCommentBody, type MentionInputHandle } from './MentionInput';
import { IconButton } from './primitives';

const POPOVER_WIDTH = 340;
const POPOVER_HEIGHT_EST = 320;
const POPOVER_MARGIN = 12;
const ANCHOR_GAP = 28;

function anchorElementSelector(a: CommentAnchor): string | null {
  switch (a.type) {
    case 'action': return `.react-flow__node[data-id="action-${a.id}"]`;
    case 'phase': return `.react-flow__node[data-id="phase-${a.id}"]`;
    case 'actor': return `.react-flow__node[data-id="actor-${a.id}"]`;
    case 'statusLane': return `.react-flow__node[data-id="slane-label-${a.id}"]`;
    case 'timelineLane': return `.react-flow__node[data-id="tlane-label-${a.id}"]`;
    case 'statusSegment': return `.react-flow__node[data-id="sseg-${a.id}"]`;
    case 'timelineSegment': return `.react-flow__node[data-id="tseg-${a.id}"]`;
    case 'edge': return `.react-flow__edge[data-id="${a.id}"]`;
    default: return null;
  }
}

type ThreadLayout = {
  popLeft: number;
  popTop: number;
  side: 'left' | 'right';
  connector: { x1: number; y1: number; x2: number; y2: number; dotX: number; dotY: number } | null;
};

function computeLayoutFromRect(rect: DOMRect): ThreadLayout {
  let side: 'left' | 'right' = 'right';
  let popLeft = rect.right + ANCHOR_GAP;
  if (popLeft + POPOVER_WIDTH > window.innerWidth - POPOVER_MARGIN) {
    const altLeft = rect.left - ANCHOR_GAP - POPOVER_WIDTH;
    if (altLeft >= POPOVER_MARGIN) {
      popLeft = altLeft;
      side = 'left';
    } else {
      popLeft = window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN;
    }
  }
  const anchorCY = rect.top + rect.height / 2;
  let popTop = anchorCY - POPOVER_HEIGHT_EST / 2;
  popTop = Math.max(POPOVER_MARGIN, Math.min(popTop, window.innerHeight - POPOVER_HEIGHT_EST - POPOVER_MARGIN));
  const startX = side === 'right' ? rect.right : rect.left;
  const endX = side === 'right' ? popLeft : popLeft + POPOVER_WIDTH;
  return {
    popLeft,
    popTop,
    side,
    connector: { x1: startX, y1: anchorCY, x2: endX, y2: anchorCY, dotX: startX, dotY: anchorCY },
  };
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

function anchorTitle(anchor: CommentAnchor, bp: Blueprint | null, actors?: Actor[]): string {
  if (!bp) return 'Comment';
  switch (anchor.type) {
    case 'action': {
      const a = bp.actions.find((x) => x.id === anchor.id);
      return a?.label || 'Step';
    }
    case 'phase': {
      const p = bp.phases.find((x) => x.id === anchor.id);
      return p?.name || 'Phase';
    }
    case 'actor': {
      const a = (actors ?? bp.actors).find((x) => x.id === anchor.id);
      return a?.name || 'Actor';
    }
    case 'edge':
      return 'Connection';
    case 'statusLane': {
      const lane = (bp.statusLanes ?? []).find((l) => l.id === anchor.id);
      return lane?.name || 'Status lane';
    }
    case 'timelineLane': {
      const lane = (bp.timelineLanes ?? []).find((l) => l.id === anchor.id);
      return lane?.name || 'Timeline lane';
    }
    case 'statusSegment': {
      for (const l of bp.statusLanes ?? []) {
        const seg = l.segments.find((s) => s.id === anchor.id);
        if (seg) return seg.label || l.name;
      }
      return 'Status segment';
    }
    case 'timelineSegment': {
      for (const l of bp.timelineLanes ?? []) {
        const seg = l.segments.find((s) => s.id === anchor.id);
        if (seg) return seg.label || l.name;
      }
      return 'Timeline segment';
    }
    default:
      return 'Comment';
  }
}

export function CommentThread() {
  const openAnchor = useCommentsStore((s) => s.openAnchor);
  const openAnchorPos = useCommentsStore((s) => s.openAnchorPos);
  const closeThread = useCommentsStore((s) => s.closeThread);
  const comments = useCommentsStore((s) => s.comments);
  const reactions = useCommentsStore((s) => s.reactions);
  const postComment = useCommentsStore((s) => s.postComment);
  const removeComment = useCommentsStore((s) => s.removeComment);
  const toggleReaction = useCommentsStore((s) => s.toggleReaction);
  const toggleResolved = useCommentsStore((s) => s.toggleResolved);

  const userId = useBlueprintStore((s) => s.userId);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const displayName = useBlueprintStore((s) => s.displayName);
  const blueprintRowId = useBlueprintStore((s) => s.blueprintRowId);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const effectiveActors = useBlueprintStore((s) => s.effectiveActors);
  const collaborators = useCommentsStore((s) => s.collaborators);
  // True for any signed-in user with a loaded blueprint they can read —
  // i.e. the owner OR an accepted collaborator. RLS gates writes.
  const canParticipate = !!userId && !!blueprint;

  const containerRef = useRef<HTMLDivElement>(null);
  const mentionRef = useRef<MentionInputHandle>(null);
  // Track whether the composer currently has any text — used to enable Post.
  const [composerEmpty, setComposerEmpty] = useState(true);

  // Close on Escape; close on click outside the popover (but ignore badge clicks)
  useEffect(() => {
    if (!openAnchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeThread();
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const target = e.target as HTMLElement;
      if (el.contains(target)) return;
      // Ignore clicks on a comment badge (it manages its own open)
      if (target.closest?.('.comment-badge')) return;
      closeThread();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openAnchor, closeThread]);

  // Reset draft when switching anchors
  useEffect(() => {
    mentionRef.current?.clear();
    setComposerEmpty(true);
  }, [openAnchor?.type, openAnchor?.id]);

  // Track the anchor element's screen position via RAF + add a highlight class
  // for as long as the thread is open. CommentThread is mounted outside
  // ReactFlowProvider, so we can't subscribe to xyflow's transform store —
  // a single requestAnimationFrame loop is cheap enough for one popover.
  const [layout, setLayout] = useState<ThreadLayout | null>(null);
  useEffect(() => {
    if (!openAnchor) {
      setLayout(null);
      return;
    }
    const sel = anchorElementSelector(openAnchor);
    let raf = 0;
    let highlighted: Element | null = null;
    const tick = () => {
      const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
      if (!el) {
        // Fallback: anchor element not in DOM (offscreen or not yet mounted).
        // Position near the click location if we have it.
        const fallback = openAnchorPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const popLeft = Math.min(
          Math.max(POPOVER_MARGIN, fallback.x - POPOVER_WIDTH / 2),
          window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN,
        );
        const popTop = Math.min(
          Math.max(POPOVER_MARGIN, fallback.y + 12),
          window.innerHeight - POPOVER_HEIGHT_EST - POPOVER_MARGIN,
        );
        setLayout({ popLeft, popTop, side: 'right', connector: null });
        raf = requestAnimationFrame(tick);
        return;
      }
      if (highlighted !== el) {
        highlighted?.classList.remove('comment-anchor-active');
        el.classList.add('comment-anchor-active');
        highlighted = el;
      }
      const rect = el.getBoundingClientRect();
      setLayout(computeLayoutFromRect(rect));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      highlighted?.classList.remove('comment-anchor-active');
    };
  }, [openAnchor?.type, openAnchor?.id, openAnchorPos?.x, openAnchorPos?.y]);

  const root = useMemo(
    () => (openAnchor ? rootCommentForAnchor(comments, openAnchor) : undefined),
    [comments, openAnchor],
  );
  const replies = useMemo(
    () => (root ? repliesForRoot(comments, root.id) : []),
    [comments, root],
  );
  const allForAnchor = useMemo(
    () => (openAnchor ? commentsForAnchor(comments, openAnchor) : []),
    [comments, openAnchor],
  );

  if (!openAnchor || !layout) return null;

  const { popLeft: left, popTop: top, connector } = layout;

  const canPost = canParticipate && !!blueprintRowId && !composerEmpty;

  const handlePost = async () => {
    if (!canParticipate || !blueprintRowId || !userId || !userEmail) return;
    const serialized = mentionRef.current?.serialize();
    if (!serialized) return;
    const body = serialized.body.trim();
    if (!body) return;
    const isReply = !!root;
    await postComment({
      blueprintRowId,
      anchor: openAnchor,
      parentCommentId: isReply ? root!.id : null,
      authorUserId: userId,
      authorName: displayName?.trim() || userEmail,
      authorEmail: userEmail,
      body,
      mentions: serialized.mentions,
    });
    mentionRef.current?.clear();
    setComposerEmpty(true);
    setTimeout(() => mentionRef.current?.focus(), 50);
  };

  const handleResolve = async () => {
    if (!root || !userId) return;
    await toggleResolved(root.id, userId);
  };

  return (
    <>
      {connector && (
        <svg
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9499,
            overflow: 'visible',
          }}
        >
          <line
            x1={connector.x1}
            y1={connector.y1}
            x2={connector.x2}
            y2={connector.y2}
            stroke="var(--border-strong)"
            strokeWidth={1.5}
          />
          <circle cx={connector.dotX} cy={connector.dotY} r={4} fill="var(--border-strong)" />
        </svg>
      )}
    <div
      ref={containerRef}
      className="comment-thread-popover"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
          title={anchorTitle(openAnchor, blueprint, effectiveActors)}
        >
          {anchorTitle(openAnchor, blueprint, effectiveActors)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {root && canParticipate && (
            <button
              type="button"
              onClick={handleResolve}
              title={root.resolvedAt ? 'Reopen thread' : 'Resolve thread'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: root.resolvedAt ? 'var(--accent-success)' : 'var(--text-secondary)',
                border: `1px solid ${root.resolvedAt ? 'var(--accent-success)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-pill)',
                background: 'transparent',
              }}
            >
              {root.resolvedAt ? <RotateCcw size={11} /> : <Check size={11} />}
              {root.resolvedAt ? 'Reopen' : 'Resolve'}
            </button>
          )}
          <IconButton icon={<X size={13} />} onClick={closeThread} size={22} title="Close thread" />
        </div>
      </div>

      {/* Thread body */}
      <div style={{ overflowY: 'auto', padding: '8px 12px', flex: 1 }}>
        {allForAnchor.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            No comments yet.
          </div>
        )}
        {root && (
          <CommentItem
            comment={root}
            reactions={reactionsForComment(reactions, root.id)}
            currentUserId={userId}
            onToggleReaction={(emoji) => userId && toggleReaction(root.id, userId, emoji)}
            onDelete={() => removeComment(root.id)}
          />
        )}
        {replies.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            reactions={reactionsForComment(reactions, c.id)}
            currentUserId={userId}
            onToggleReaction={(emoji) => userId && toggleReaction(c.id, userId, emoji)}
            onDelete={() => removeComment(c.id)}
          />
        ))}
      </div>

      {/* Composer */}
      {canParticipate && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'var(--surface-bg-muted)',
          }}
        >
          <MentionInput
            ref={mentionRef}
            collaborators={collaborators}
            ownerEmail={userEmail}
            ownerUserId={userId}
            ownerName={displayName}
            autoFocus
            placeholder={root ? 'Reply…' : 'Add a comment…'}
            onSubmit={handlePost}
            onChangeText={(t) => setComposerEmpty(t.trim().length === 0)}
            rows={2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button type="button" className="btn-ghost" onClick={closeThread} style={{ padding: '6px 12px', fontSize: 12 }}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handlePost} disabled={!canPost} style={{ padding: '6px 12px', fontSize: 12 }}>
              {root ? 'Reply' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function CommentItem({
  comment,
  reactions,
  currentUserId,
  onToggleReaction,
  onDelete,
}: {
  comment: Comment;
  reactions: ReturnType<typeof reactionsForComment>;
  currentUserId: string | null;
  onToggleReaction: (emoji: CommentReactionEmoji) => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isAuthor = !!currentUserId && comment.authorUserId === currentUserId;

  // Reaction summary: { emoji → { count, mine } }
  const summary = useMemo(() => {
    const m = new Map<CommentReactionEmoji, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const cur = m.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.userId === currentUserId) cur.mine = true;
      m.set(r.emoji, cur);
    }
    return m;
  }, [reactions, currentUserId]);

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, position: 'relative' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {comment.authorName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRelative(comment.createdAt)}</div>
        {comment.resolvedAt && (
          <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--accent-success)', fontWeight: 600 }}>
            • Resolved
          </span>
        )}
        {isAuthor && (
          <button
            type="button"
            onClick={() => setShowMenu((m) => !m)}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: 4,
              color: 'var(--text-muted)',
            }}
            aria-label="More actions"
          >
            <MoreVertical size={12} />
          </button>
        )}
        {showMenu && (
          <div
            onMouseLeave={() => setShowMenu(false)}
            style={{
              position: 'absolute',
              right: 0,
              top: 22,
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 1,
              minWidth: 120,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onDelete();
                setShowMenu(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: 'var(--accent-danger)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
        {renderCommentBody(comment.body, currentUserId)}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {COMMENT_REACTION_EMOJIS.map((emoji) => {
          const s = summary.get(emoji);
          if (!s) return null; // Hide reactions with 0 count by default
          return (
            <button
              key={emoji}
              type="button"
              className={`comment-reaction-pill${s.mine ? ' active' : ''}`}
              onClick={() => onToggleReaction(emoji)}
            >
              <span>{emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{s.count}</span>
            </button>
          );
        })}
        {/* Reaction picker: always show one neutral "+" pill */}
        <ReactionPicker onPick={onToggleReaction} />
      </div>
    </div>
  );
}

// Inline thread view (used by NodeInspector "Comments" tab and any future
// non-popover surface). Renders thread + composer for a given anchor without
// the floating popover wrapper. Caller controls layout/sizing.
export function ThreadView({
  anchor,
  showCancel = false,
  onCancel,
  hideHeader = false,
}: {
  anchor: CommentAnchor;
  showCancel?: boolean;
  onCancel?: () => void;
  hideHeader?: boolean;
}) {
  const comments = useCommentsStore((s) => s.comments);
  const reactions = useCommentsStore((s) => s.reactions);
  const collaborators = useCommentsStore((s) => s.collaborators);
  const postComment = useCommentsStore((s) => s.postComment);
  const removeComment = useCommentsStore((s) => s.removeComment);
  const toggleReaction = useCommentsStore((s) => s.toggleReaction);
  const toggleResolved = useCommentsStore((s) => s.toggleResolved);

  const userId = useBlueprintStore((s) => s.userId);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const displayName = useBlueprintStore((s) => s.displayName);
  const blueprintRowId = useBlueprintStore((s) => s.blueprintRowId);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const canParticipate = !!userId && !!blueprint;

  const mentionRef = useRef<MentionInputHandle>(null);
  const [composerEmpty, setComposerEmpty] = useState(true);

  const root = useMemo(() => rootCommentForAnchor(comments, anchor), [comments, anchor.type, anchor.id]);
  const replies = useMemo(() => (root ? repliesForRoot(comments, root.id) : []), [comments, root]);
  const allForAnchor = useMemo(() => commentsForAnchor(comments, anchor), [comments, anchor.type, anchor.id]);

  // Reset composer when switching anchors
  useEffect(() => {
    mentionRef.current?.clear();
    setComposerEmpty(true);
  }, [anchor.type, anchor.id]);

  const canPost = canParticipate && !!blueprintRowId && !composerEmpty;

  const handlePost = async () => {
    if (!canParticipate || !blueprintRowId || !userId || !userEmail) return;
    const serialized = mentionRef.current?.serialize();
    if (!serialized) return;
    const body = serialized.body.trim();
    if (!body) return;
    await postComment({
      blueprintRowId,
      anchor,
      parentCommentId: root ? root.id : null,
      authorUserId: userId,
      authorName: displayName?.trim() || userEmail,
      authorEmail: userEmail,
      body,
      mentions: serialized.mentions,
    });
    mentionRef.current?.clear();
    setComposerEmpty(true);
    setTimeout(() => mentionRef.current?.focus(), 50);
  };

  const handleResolve = async () => {
    if (!root || !userId) return;
    await toggleResolved(root.id, userId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>
      {!hideHeader && root && canParticipate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <button
            type="button"
            onClick={handleResolve}
            title={root.resolvedAt ? 'Reopen thread' : 'Resolve thread'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: root.resolvedAt ? 'var(--accent-success)' : 'var(--text-secondary)',
              border: `1px solid ${root.resolvedAt ? 'var(--accent-success)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {root.resolvedAt ? <RotateCcw size={11} /> : <Check size={11} />}
            {root.resolvedAt ? 'Reopen' : 'Resolve'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {allForAnchor.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            No comments yet.
          </div>
        )}
        {root && (
          <CommentItem
            comment={root}
            reactions={reactionsForComment(reactions, root.id)}
            currentUserId={userId}
            onToggleReaction={(emoji) => userId && toggleReaction(root.id, userId, emoji)}
            onDelete={() => removeComment(root.id)}
          />
        )}
        {replies.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            reactions={reactionsForComment(reactions, c.id)}
            currentUserId={userId}
            onToggleReaction={(emoji) => userId && toggleReaction(c.id, userId, emoji)}
            onDelete={() => removeComment(c.id)}
          />
        ))}
      </div>

      {canParticipate && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <MentionInput
            ref={mentionRef}
            collaborators={collaborators}
            ownerEmail={userEmail}
            ownerUserId={userId}
            placeholder={root ? 'Reply…' : 'Add a comment…'}
            onSubmit={handlePost}
            onChangeText={(t) => setComposerEmpty(t.trim().length === 0)}
            rows={2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            {showCancel && onCancel && (
              <button
                type="button"
                className="btn-ghost"
                onClick={onCancel}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handlePost}
              disabled={!canPost}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              {root ? 'Reply' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReactionPicker({ onPick }: { onPick: (emoji: CommentReactionEmoji) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="comment-reaction-pill"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add reaction"
      >
        +
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute',
            bottom: 26,
            left: 0,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-md)',
            padding: '4px 8px',
            display: 'flex',
            gap: 4,
            zIndex: 1,
          }}
        >
          {COMMENT_REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              style={{
                fontSize: 16,
                padding: '2px 4px',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
