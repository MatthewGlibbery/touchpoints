import { memo, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import type { CommentAnchor } from '../../types/blueprint';
import { useBlueprintStore } from '../../store/blueprint.store';
import {
  useCommentsStore,
  commentsForAnchor,
  rootCommentForAnchor,
  buildAnchorRegistry,
  isAnchorDetached,
} from '../../store/comments.store';

type Props = {
  anchor: CommentAnchor;
  // Position for the popover. If not provided, the click handler approximates
  // from the click event's clientX/clientY.
  getAnchorPos?: () => { x: number; y: number } | null;
  // Optional inline style overrides (placement on the host element).
  style?: React.CSSProperties;
};

export const CommentBadge = memo(({ anchor, getAnchorPos, style }: Props) => {
  const comments = useCommentsStore((s) => s.comments);
  const filter = useCommentsStore((s) => s.filter);
  const openThread = useCommentsStore((s) => s.openThread);
  const blueprintRowId = useBlueprintStore((s) => s.blueprintRowId);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const userId = useBlueprintStore((s) => s.userId);
  const commentMode = useBlueprintStore((s) => s.commentMode);

  const anchorComments = useMemo(
    () => commentsForAnchor(comments, anchor),
    [comments, anchor.type, anchor.id],
  );
  const root = useMemo(
    () => rootCommentForAnchor(comments, anchor),
    [comments, anchor.type, anchor.id],
  );

  // In comment mode, hide the badge when the active filter excludes this thread.
  const hiddenByFilter = useMemo(() => {
    if (!commentMode || filter === 'all') return false;
    if (anchorComments.length === 0) return false;
    if (filter === 'unresolved') return !!root?.resolvedAt;
    if (filter === 'resolved') return !root?.resolvedAt;
    if (filter === 'me') {
      return !anchorComments.some(
        (c) =>
          (userId && c.authorUserId === userId) ||
          c.mentions.some((m) => m.userId === userId),
      );
    }
    if (filter === 'detached') {
      const reg = buildAnchorRegistry(blueprint);
      const ids = new Set((blueprint?.actions ?? []).map((a) => a.id));
      return !isAnchorDetached(anchor, reg, ids);
    }
    return false;
  }, [commentMode, filter, anchorComments, root, userId, blueprint, anchor.type, anchor.id]);

  if (!blueprintRowId) return null;
  if (anchorComments.length === 0) return null;
  if (hiddenByFilter) return null;

  const resolved = !!root?.resolvedAt;
  const count = anchorComments.length;

  return (
    <button
      type="button"
      className={`comment-badge${resolved ? ' resolved' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        const pos = getAnchorPos?.() ?? { x: e.clientX, y: e.clientY };
        openThread(anchor, pos);
      }}
      style={style}
      aria-label={`${count} comment${count === 1 ? '' : 's'}`}
    >
      <MessageCircle size={11} />
      {count}
    </button>
  );
});
