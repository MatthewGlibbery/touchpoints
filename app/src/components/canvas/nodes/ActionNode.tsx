import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  User, Globe, Building2, Users, Activity,
  AlertCircle, Lightbulb, HelpCircle, Diamond, Sparkles,
} from 'lucide-react';
import type { Action } from '../../../types/blueprint';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { useCommentsStore } from '../../../store/comments.store';
import { ACTION_NODE_WIDTH, OVERVIEW_CARD_HEIGHT } from '../../../lib/layout';
import { CommentBadge } from '../../ui/CommentBadge';
import { uploadActionMedia, mediaTypeFromFile } from '../../../lib/upload';
import type { ActionMedia } from '../../../types/blueprint';

type ActionNodeData = { action: Action; actorColor: string; actorOrder: number; nodeH?: number; allPainsAi?: boolean; allOppsAi?: boolean; allQsAi?: boolean };

const ACTOR_ICONS = [User, Globe, Building2, Users];

const HIGHLIGHT_COLORS: Record<string, string> = {
  'pain-points':   'var(--accent-danger)',
  'opportunities': 'var(--accent-success)',
  'questions':     'var(--accent-warning)',
};

const HIGHLIGHT_SOFT: Record<string, string> = {
  'pain-points':   'rgba(239,68,68,0.22)',
  'opportunities': 'rgba(34,197,94,0.22)',
  'questions':     'rgba(245,158,11,0.22)',
};

const HIGHLIGHT_GLOW: Record<string, string> = {
  'pain-points':   '0 0 0 3px rgba(239,68,68,0.18)',
  'opportunities': '0 0 0 3px rgba(34,197,94,0.18)',
  'questions':     '0 0 0 3px rgba(245,158,11,0.18)',
};

export const ActionNode = memo(({ data }: NodeProps) => {
  const { action, actorColor, actorOrder, nodeH, allPainsAi, allOppsAi, allQsAi } = data as ActionNodeData;
  const updateAction = useBlueprintStore((s) => s.updateAction);
  const setSelectedNode = useBlueprintStore((s) => s.setSelectedNode);
  const openInspectorToTab = useBlueprintStore((s) => s.openInspectorToTab);
  const animateToNode = useBlueprintStore((s) => s.animateToNode);
  const setSelectedOverviewCell = useBlueprintStore((s) => s.setSelectedOverviewCell);
  const setLightboxUrl = useBlueprintStore((s) => s.setLightboxUrl);
  const canvasView = useBlueprintStore((s) => s.canvasView);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const overviewMode = useBlueprintStore((s) => s.overviewMode);
  const selectedNodeId = useBlueprintStore((s) => s.selectedNodeId);
  const multiSelectedNodeIds = useBlueprintStore((s) => s.multiSelectedNodeIds);
  const setMultiSelectedNodeIds = useBlueprintStore((s) => s.setMultiSelectedNodeIds);
  const selected = selectedNodeId === action.id;
  const multiSelected = multiSelectedNodeIds.includes(action.id);
  const openThread = useCommentsStore((s) => s.openThread);

  const cardCenterPos = useCallback((): { x: number; y: number } | null => {
    const el = cardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (presentMode) return;
    if (commentMode) {
      openThread({ type: 'action', id: action.id }, cardCenterPos());
      return;
    }
    // Shift+click: toggle in multi-select without opening inspector
    if (e.shiftKey) {
      const current = useBlueprintStore.getState().multiSelectedNodeIds;
      if (current.includes(action.id)) {
        setMultiSelectedNodeIds(current.filter((id) => id !== action.id));
      } else {
        setMultiSelectedNodeIds([...current, action.id]);
      }
      // Close inspector if open
      setSelectedNode(null);
      return;
    }
    // Normal click: clear multi-select and open inspector
    if (multiSelectedNodeIds.length > 0) {
      setMultiSelectedNodeIds([]);
    }
    setSelectedNode(action.id);
    animateToNode(action.id);
  }, [presentMode, commentMode, openThread, action.id, cardCenterPos, setSelectedNode, animateToNode, multiSelectedNodeIds, setMultiSelectedNodeIds]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.label);
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const overviewInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Track the card's actual rendered size so connection handles always anchor
  // to the visible card bounds — not the ReactFlow node wrapper, which can be
  // taller than the card when the row is sized to a taller sibling.
  const [cardSize, setCardSize] = useState<{ w: number; h: number }>({
    w: ACTION_NODE_WIDTH,
    h: overviewMode ? OVERVIEW_CARD_HEIGHT : 140,
  });

  // Drag-and-drop file upload state
  const [fileDragOver, setFileDragOver] = useState(false);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const editLocked = isGuestView || isCollaboratorView || commentMode || presentMode;

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    if (editLocked || !blueprint) return;
    const files = e.dataTransfer.files;
    if (!files.length) return;
    // Only accept image/video files — take the first valid one (single image per action)
    const file = Array.from(files).find(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!file) return;
    const result = await uploadActionMedia(file, blueprint.id, action.id);
    if ('error' in result) {
      console.error('[ActionNode] upload error:', result.error);
      return;
    }
    const newMedia: ActionMedia[] = [{ id: `m-${Date.now()}`, type: mediaTypeFromFile(file), url: result.url }];
    updateAction(action.id, { media: newMedia });
  }, [editLocked, blueprint, action.id, updateAction]);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    if (editLocked) return;
    // Only show drop indicator for files (not ReactFlow node drags)
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setFileDragOver(true);
    }
  }, [editLocked]);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setFileDragOver(false);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // Use offsetWidth/Height (border-box) so handle anchors land on the visible
    // card's outer edge, not the content-box.
    const sync = () => setCardSize({ w: el.offsetWidth, h: el.offsetHeight });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, [overviewMode]);

  const HANDLE_PROXIMITY = 18; // px from edge midpoint to reveal handle

  // Attach proximity tracking to the ReactFlow wrapper so handles don't
  // disappear when cursor moves from the card onto a handle element.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // Walk up from the inner card to find the outer ReactFlow node wrapper.
    // We must attach to the wrapper (not the card) so the listener fires even
    // when the cursor is on a handle element positioned outside the card bounds.
    let wrapper: HTMLElement | null = el.parentElement;
    while (wrapper && !wrapper.classList.contains('react-flow__node')) {
      wrapper = wrapper.parentElement;
    }
    if (!wrapper) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX;
      const my = e.clientY;
      const midTop    = { x: rect.left + rect.width / 2, y: rect.top };
      const midBottom = { x: rect.left + rect.width / 2, y: rect.bottom };
      const midLeft   = { x: rect.left,  y: rect.top + rect.height / 2 };
      const midRight  = { x: rect.right, y: rect.top + rect.height / 2 };
      const dist = (p: { x: number; y: number }) => Math.hypot(mx - p.x, my - p.y);
      const nearest = [
        { id: 'top',    d: dist(midTop) },
        { id: 'bottom', d: dist(midBottom) },
        { id: 'left',   d: dist(midLeft) },
        { id: 'right',  d: dist(midRight) },
      ].sort((a, b) => a.d - b.d)[0];
      if (nearest.d <= HANDLE_PROXIMITY) {
        wrapper!.setAttribute('data-handle-near', nearest.id);
      } else {
        wrapper!.removeAttribute('data-handle-near');
      }
    };

    const onLeave = () => wrapper!.removeAttribute('data-handle-near');

    wrapper.addEventListener('mousemove', onMove);
    wrapper.addEventListener('mouseleave', onLeave);
    return () => {
      wrapper!.removeEventListener('mousemove', onMove);
      wrapper!.removeEventListener('mouseleave', onLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setDraft(action.label); }, [action.label]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== action.label) updateAction(action.id, { label: trimmed });
    else setDraft(action.label);
    setEditing(false);
  }, [draft, action.id, action.label, updateAction]);

  const painCount = action.painPointIds.length;
  const oppCount = action.opportunityIds.length;
  const qCount = (action.questionIds ?? []).length;
  const isDecisionPoint = (action.tags ?? []).includes('decision-point');
  const hasBadges = painCount > 0 || oppCount > 0 || qCount > 0;

  const ActorIcon = ACTOR_ICONS[actorOrder % ACTOR_ICONS.length] ?? Activity;

  // View highlighting
  const isFiltered = canvasView !== 'edit';
  const isMatch =
    (canvasView === 'pain-points'   && painCount > 0) ||
    (canvasView === 'opportunities' && oppCount > 0)  ||
    (canvasView === 'questions'     && qCount > 0);
  const hasMultiSelect = multiSelectedNodeIds.length > 0;
  const dimmed = (isFiltered && !isMatch) || (hasMultiSelect && !multiSelected);
  const highlighted = isFiltered && isMatch;

  const hColor = HIGHLIGHT_COLORS[canvasView] ?? '';
  const hBg    = HIGHLIGHT_SOFT[canvasView] ?? '';
  const hGlow  = HIGHLIGHT_GLOW[canvasView] ?? '';

  const borderColor = selected
    ? 'var(--accent-primary)'
    : multiSelected
    ? 'var(--accent-primary)'
    : highlighted
    ? hColor
    : 'var(--border-subtle)';

  const borderWidth = selected || multiSelected || highlighted ? 2 : 1;

  const bgColor = selected
    ? `linear-gradient(rgba(59,130,246,0.12), rgba(59,130,246,0.12)), var(--surface-bg)`
    : multiSelected
    ? `linear-gradient(rgba(59,130,246,0.06), rgba(59,130,246,0.06)), var(--surface-bg)`
    : highlighted
    ? `linear-gradient(${hBg}, ${hBg}), var(--surface-bg)`
    : 'var(--surface-bg)';

  const shadow = selected
    ? `0 0 0 4px rgba(59,130,246,0.12), var(--shadow-md)`
    : multiSelected
    ? `0 0 0 3px rgba(59,130,246,0.08), var(--shadow-sm)`
    : highlighted
    ? `${hGlow}, var(--shadow-md)`
    : 'var(--shadow-sm)';

  const firstMedia = action.media?.[0];

  // Anchor left/right handles at the node wrapper's vertical center (= row center)
  // so horizontal edges between cards of different heights are straight lines.
  // Top/bottom handles anchor to the card's actual edges for vertical edges.
  const handleMidY = (nodeH ?? cardSize.h) / 2;

  const leftHandleStyle: React.CSSProperties = {
    ...handleStyle,
    top: handleMidY,
    left: 0,
  };
  const rightHandleStyle: React.CSSProperties = {
    ...handleStyle,
    top: handleMidY,
    left: cardSize.w,
    right: 'auto',
  };
  const topHandleStyle: React.CSSProperties = {
    ...handleStyle,
    top: 0,
    left: cardSize.w / 2,
  };
  const bottomHandleStyle: React.CSSProperties = {
    ...handleStyle,
    top: nodeH ?? cardSize.h,
    bottom: 'auto',
    left: cardSize.w / 2,
  };

  // ─── Overview (semantic zoom) rendering ────────────────────────────────────
  if (overviewMode) {
    const overviewLabel = action.labelAbstract || action.label;
    const overviewBorder = selected ? 'var(--accent-primary)' : 'var(--border-subtle)';
    const overviewBorderW = selected ? 2 : 1;
    const overviewBg = selected
      ? `linear-gradient(rgba(59,130,246,0.12), rgba(59,130,246,0.12)), var(--surface-bg)`
      : highlighted
      ? `linear-gradient(${hBg}, ${hBg}), var(--surface-bg)`
      : 'var(--surface-bg)';
    const overviewShadow = selected
      ? `0 0 0 4px rgba(59,130,246,0.12), var(--shadow-md)`
      : highlighted
      ? `${hGlow}, var(--shadow-md)`
      : 'var(--shadow-sm)';

    return (
      <>
        <Handle id="left"   type="target" position={Position.Left}   style={leftHandleStyle} />
        <Handle id="right"  type="source" position={Position.Right}  style={rightHandleStyle} />
        <Handle id="top"    type="target" position={Position.Top}    style={topHandleStyle} />
        <Handle id="bottom" type="source" position={Position.Bottom} style={bottomHandleStyle} />
        <div
          ref={cardRef}
          className="action-drag-handle"
          onClick={() => {
            if (presentMode || editingOverview) return;
            if (commentMode) { openThread({ type: 'action', id: action.id }, cardCenterPos()); return; }
            setSelectedOverviewCell(action.actorId, action.phaseId, action.id);
          }}
          onDoubleClick={(e) => {
            if (presentMode) return;
            e.stopPropagation();
            setOverviewDraft(overviewLabel);
            setEditingOverview(true);
          }}
          style={{
            width: ACTION_NODE_WIDTH,
            height: OVERVIEW_CARD_HEIGHT,
            boxSizing: 'border-box',
            background: overviewBg,
            border: `${overviewBorderW}px solid ${highlighted ? hColor : overviewBorder}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: overviewShadow,
            padding: '0 14px',
            overflow: 'hidden',
            cursor: presentMode ? 'default' : 'pointer',
            opacity: dimmed ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `${actorColor}18`,
              border: `1px solid ${actorColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ActorIcon size={13} color={actorColor} />
          </div>
          {editingOverview ? (
            <input
              ref={overviewInputRef}
              autoFocus
              value={overviewDraft}
              onChange={(e) => setOverviewDraft(e.target.value)}
              onBlur={() => {
                const v = overviewDraft.trim();
                if (v) updateAction(action.id, { labelAbstract: v });
                setEditingOverview(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditingOverview(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: 0,
                lineHeight: 1.35,
              }}
            />
          ) : (
            <p style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: 0,
              flex: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {overviewLabel}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Handle id="left"   type="target" position={Position.Left}   style={leftHandleStyle} />
      <Handle id="right"  type="source" position={Position.Right}  style={rightHandleStyle} />
      <Handle id="top"    type="target" position={Position.Top}    style={topHandleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={bottomHandleStyle} />

      <div
        ref={cardRef}
        className="action-drag-handle"
        data-selected={selected}
        style={{
          width: ACTION_NODE_WIDTH,
          background: bgColor,
          border: `${borderWidth}px solid ${fileDragOver ? 'var(--accent-primary)' : borderColor}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: fileDragOver ? '0 0 0 4px rgba(59,130,246,0.18), var(--shadow-md)' : shadow,
          padding: '14px',
          overflow: 'hidden',
          cursor: presentMode ? 'default' : 'pointer',
          opacity: dimmed ? 0.3 : 1,
          transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s',
        }}
        onDoubleClick={(e) => { if (presentMode || overviewMode || commentMode) return; e.stopPropagation(); setEditing(true); }}
        onClick={handleCardClick}
        onDrop={handleFileDrop}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
      >
        {/* Comment badge — top-right of card; visible in any mode when commented */}
        <CommentBadge
          anchor={{ type: 'action', id: action.id }}
          getAnchorPos={cardCenterPos}
          style={{ position: 'absolute', top: -8, right: -8 }}
        />
        {/* Icon + label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${actorColor}18`,
              border: `1px solid ${actorColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ActorIcon size={15} color={actorColor} />
          </div>

          {isDecisionPoint && (
            <Diamond size={11} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
          )}
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') { setDraft(action.label); setEditing(false); }
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: 0,
                lineHeight: 1.35,
              }}
            />
          ) : (
            <p style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: 0,
              flex: 1,
            }}>
              {action.label}
            </p>
          )}
        </div>

        {/* Description */}
        {action.labelDetailed && (
          <p style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '8px 0 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {action.labelDetailed}
          </p>
        )}

        {/* Media preview — edge-to-edge */}
        {firstMedia && (
          <div
            style={{
              margin: hasBadges ? '8px -14px 0' : '8px -14px -14px',
              lineHeight: 0,
              cursor: firstMedia.type !== 'video' ? 'zoom-in' : undefined,
            }}
            onClick={(e) => {
              if (firstMedia.type !== 'video') {
                e.stopPropagation();
                setLightboxUrl(firstMedia.url);
              }
            }}
          >
            {firstMedia.type === 'video' ? (
              <video
                src={firstMedia.url}
                style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
                muted preload="metadata"
              />
            ) : (
              <img
                src={firstMedia.url}
                alt={firstMedia.caption ?? ''}
                style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>
        )}

        {/* Divider + badges — skip divider when media is present */}
        {hasBadges && (
          <>
            {!firstMedia && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px 0' }} />}
            {firstMedia && <div style={{ margin: '8px 0 0' }} />}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {painCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'pains'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <AlertCircle size={12} color="var(--accent-danger)" />
                  {painCount}
                  {allPainsAi && <Sparkles size={8} color="var(--accent-danger)" style={{ opacity: 0.7 }} />}
                </button>
              )}
              {oppCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'opportunities'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <Lightbulb size={12} color="var(--accent-success)" />
                  {oppCount}
                  {allOppsAi && <Sparkles size={8} color="var(--accent-success)" style={{ opacity: 0.7 }} />}
                </button>
              )}
              {qCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'questions'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <HelpCircle size={12} color="var(--accent-warning)" />
                  {qCount}
                  {allQsAi && <Sparkles size={8} color="var(--accent-warning)" style={{ opacity: 0.7 }} />}
                </button>
              )}
            </div>
          </>        )}

      </div>
    </>
  );
});

const handleStyle: React.CSSProperties = { width: 12, height: 12 };
