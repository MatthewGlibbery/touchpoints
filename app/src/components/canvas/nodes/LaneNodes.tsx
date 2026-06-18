import { memo, useState, useCallback, useEffect, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { Trash2, Plus, MoveHorizontal, Palette, RotateCcw, GripVertical } from 'lucide-react';
import type { StatusLane, TimelineLane, LaneSegment } from '../../../types/blueprint';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { useCommentsStore } from '../../../store/comments.store';
import { ACTOR_LABEL_WIDTH, PHASE_WIDTH, getColFromX, getColFromXSnap } from '../../../lib/layout';
import { CommentBadge } from '../../ui/CommentBadge';
import { ConfirmDeleteModal } from '../../ui/ConfirmDeleteModal';

// ─── Status lane label ────────────────────────────────────────────────────────

type StatusLaneLabelData = { lane: StatusLane; height: number };

export const StatusLaneLabelNode = memo(({ data }: NodeProps) => {
  const { lane, height } = data as StatusLaneLabelData;
  const updateStatusLane = useBlueprintStore((s) => s.updateStatusLane);
  const removeStatusLane = useBlueprintStore((s) => s.removeStatusLane);
  const reorderStatusLane = useBlueprintStore((s) => s.reorderStatusLane);
  const setSelectedLaneId = useBlueprintStore((s) => s.setSelectedLaneId);
  const selectedLaneId = useBlueprintStore((s) => s.selectedLaneId);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const openThread = useCommentsStore((s) => s.openThread);
  const readOnly = presentMode || isGuestView || commentMode || isCollaboratorView;
  const selected = selectedLaneId === lane.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dragStartY = useRef(0);
  const didDrag = useRef(false);
  const threshold = height * 0.6;

  useEffect(() => { setDraft(lane.name); }, [lane.name]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== lane.name) updateStatusLane(lane.id, { name: v });
    else setDraft(lane.name);
    setEditing(false);
  };

  const onDivMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly || editing) return;
    e.stopPropagation();
    dragStartY.current = e.clientY;
    didDrag.current = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      if (delta > threshold) {
        didDrag.current = true;
        reorderStatusLane(lane.id, 'down');
        dragStartY.current = ev.clientY;
      } else if (delta < -threshold) {
        didDrag.current = true;
        reorderStatusLane(lane.id, 'up');
        dragStartY.current = ev.clientY;
      }
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [lane.id, reorderStatusLane, threshold, readOnly, editing]);

  const showGrip = !readOnly && (hovered || dragging);
  const showHoverFill = !readOnly && (hovered || dragging || selected);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onDivMouseDown}
      onClick={(e) => {
        if (didDrag.current) return;
        if (commentMode) {
          e.stopPropagation();
          openThread({ type: 'statusLane', id: lane.id }, { x: e.clientX, y: e.clientY });
          return;
        }
        if (readOnly) return;
        e.stopPropagation();
        setSelectedLaneId(lane.id);
      }}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 12,
        paddingLeft: 28,
        gap: 6,
        position: 'relative',
        userSelect: 'none',
        background: showHoverFill ? `${lane.color}0A` : 'transparent',
        borderRight: `2px solid ${showHoverFill ? lane.color + '55' : 'transparent'}`,
        cursor: dragging ? 'grabbing' : (commentMode ? 'inherit' : (readOnly ? 'default' : 'pointer')),
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      {/* Drag grip — left side */}
      <div
        title="Drag to reorder"
        style={{
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          opacity: showGrip ? 1 : 0,
          transition: 'opacity var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        <GripVertical size={12} />
      </div>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(lane.name); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            color: lane.color,
            textAlign: 'right',
            padding: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => { if (!readOnly) { e.stopPropagation(); setEditing(true); } }}
          title={readOnly ? lane.name : 'Double-click to rename'}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: lane.color,
            cursor: readOnly ? 'default' : 'text',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lane.name}
        </span>
      )}
      <CommentBadge
        anchor={{ type: 'statusLane', id: lane.id }}
        style={{ position: 'absolute', top: -6, right: -8 }}
      />
      {selected && !readOnly && !editing && (
        <LaneLabelControls
          color={lane.color}
          onPickColor={(c) => updateStatusLane(lane.id, { color: c })}
          onDelete={() => setConfirming(true)}
        />
      )}
      {confirming && (
        <ConfirmDeleteModal
          title="Delete status lane?"
          description={`"${lane.name}" and all its segments will be removed.`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => { removeStatusLane(lane.id); setConfirming(false); }}
        />
      )}
    </div>
  );
});

// ─── Timeline lane label ──────────────────────────────────────────────────────

type TimelineLaneLabelData = { lane: TimelineLane; height: number };

export const TimelineLaneLabelNode = memo(({ data }: NodeProps) => {
  const { lane, height } = data as TimelineLaneLabelData;
  const updateTimelineLane = useBlueprintStore((s) => s.updateTimelineLane);
  const removeTimelineLane = useBlueprintStore((s) => s.removeTimelineLane);
  const reorderTimelineLane = useBlueprintStore((s) => s.reorderTimelineLane);
  const setSelectedLaneId = useBlueprintStore((s) => s.setSelectedLaneId);
  const selectedLaneId = useBlueprintStore((s) => s.selectedLaneId);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const openThread = useCommentsStore((s) => s.openThread);
  const readOnly = presentMode || isGuestView || commentMode || isCollaboratorView;
  const selected = selectedLaneId === lane.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dragStartY = useRef(0);
  const didDrag = useRef(false);
  const threshold = height * 0.6;

  useEffect(() => { setDraft(lane.name); }, [lane.name]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== lane.name) updateTimelineLane(lane.id, { name: v });
    else setDraft(lane.name);
    setEditing(false);
  };

  const onDivMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly || editing) return;
    e.stopPropagation();
    dragStartY.current = e.clientY;
    didDrag.current = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      if (delta > threshold) {
        didDrag.current = true;
        reorderTimelineLane(lane.id, 'down');
        dragStartY.current = ev.clientY;
      } else if (delta < -threshold) {
        didDrag.current = true;
        reorderTimelineLane(lane.id, 'up');
        dragStartY.current = ev.clientY;
      }
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [lane.id, reorderTimelineLane, threshold, readOnly, editing]);

  const showGrip = !readOnly && (hovered || dragging);
  const showHoverFill = !readOnly && (hovered || dragging || selected);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onDivMouseDown}
      onClick={(e) => {
        if (didDrag.current) return;
        if (commentMode) {
          e.stopPropagation();
          openThread({ type: 'timelineLane', id: lane.id }, { x: e.clientX, y: e.clientY });
          return;
        }
        if (readOnly) return;
        e.stopPropagation();
        setSelectedLaneId(lane.id);
      }}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 12,
        paddingLeft: 28,
        position: 'relative',
        userSelect: 'none',
        background: showHoverFill ? `${lane.color}0A` : 'transparent',
        borderRight: `2px solid ${showHoverFill ? lane.color + '55' : 'transparent'}`,
        cursor: dragging ? 'grabbing' : (commentMode ? 'inherit' : (readOnly ? 'default' : 'pointer')),
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      <div
        title="Drag to reorder"
        style={{
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          opacity: showGrip ? 1 : 0,
          transition: 'opacity var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        <GripVertical size={12} />
      </div>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(lane.name); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            fontWeight: 600,
            color: lane.color,
            textAlign: 'right',
            padding: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => { if (!readOnly) { e.stopPropagation(); setEditing(true); } }}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: lane.color,
            cursor: readOnly ? 'default' : 'text',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lane.name}
        </span>
      )}
      <CommentBadge
        anchor={{ type: 'timelineLane', id: lane.id }}
        style={{ position: 'absolute', top: -6, right: -8 }}
      />
      {selected && !readOnly && !editing && (
        <LaneLabelControls
          color={lane.color}
          onPickColor={(c) => updateTimelineLane(lane.id, { color: c })}
          onDelete={() => setConfirming(true)}
        />
      )}
      {confirming && (
        <ConfirmDeleteModal
          title="Delete timeline lane?"
          description={`"${lane.name}" and all its segments will be removed.`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => { removeTimelineLane(lane.id); setConfirming(false); }}
        />
      )}
    </div>
  );
});

// ─── Lane body (canvas-spanning click target for adding segments) ─────────────

type LaneBodyData = {
  laneId: string;
  kind: 'status' | 'timeline';
  color: string;
  width: number;
  height: number;
  totalColumns: number;
  segments: LaneSegment[];
};

// LaneBodyNode supports two interactions:
//   - Click-without-drag → 1-column segment at that col (existing behavior).
//   - Click-and-drag → segment spanning [min(start,end), max(start,end)] cols.
// Live preview (during hover OR drag) uses the lane's color so the user sees
// the segment "previewed" in its eventual color.

export const LaneBodyNode = memo(({ data }: NodeProps) => {
  const { laneId, kind, color, width, height, totalColumns, segments } = data as LaneBodyData;
  const addStatusSegment = useBlueprintStore((s) => s.addStatusSegment);
  const addTimelineSegment = useBlueprintStore((s) => s.addTimelineSegment);
  const setSelectedLaneSegment = useBlueprintStore((s) => s.setSelectedLaneSegment);
  const setSelectedLaneId = useBlueprintStore((s) => s.setSelectedLaneId);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const readOnly = presentMode || isGuestView || commentMode;
  const rf = useReactFlow();

  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [drawRange, setDrawRange] = useState<{ start: number; end: number } | null>(null);

  const isOccupied = useCallback((col: number) =>
    segments.some((s) => col >= s.startCol && col <= s.endCol),
    [segments]);

  // Clamp a target col to skip over occupied columns relative to an anchor:
  // walk from anchor toward target, stop one col before the first occupied col.
  const clampThroughOccupied = useCallback((anchor: number, target: number): number => {
    if (anchor === target) return target;
    const dir = target > anchor ? 1 : -1;
    let last = anchor;
    for (let c = anchor + dir; (dir > 0 ? c <= target : c >= target); c += dir) {
      if (c < 0 || c >= totalColumns) break;
      if (isOccupied(c)) break;
      last = c;
    }
    return last;
  }, [isOccupied, totalColumns]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const startCol = getColFromX(flowPos.x, totalColumns);
    if (startCol < 0 || startCol >= totalColumns) return;
    if (isOccupied(startCol)) return;
    e.stopPropagation();
    e.preventDefault();

    // Deselect any selected segment / lane so toolbars don't flicker
    setSelectedLaneSegment(null);
    setSelectedLaneId(null);

    let didDrag = false;
    let currentEnd = startCol;
    setDrawRange({ start: startCol, end: startCol });

    const onMove = (ev: MouseEvent) => {
      const fp = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const rawCol = getColFromX(fp.x, totalColumns);
      const clampedCol = Math.max(0, Math.min(totalColumns - 1, rawCol));
      const endCol = clampThroughOccupied(startCol, clampedCol);
      if (endCol !== currentEnd) didDrag = true;
      currentEnd = endCol;
      setDrawRange({ start: startCol, end: endCol });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cleanup();
        setDrawRange(null);
      }
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };

    const onUp = () => {
      cleanup();
      const minCol = Math.min(startCol, currentEnd);
      const maxCol = Math.max(startCol, currentEnd);
      setDrawRange(null);
      // Click-without-drag → single-column segment at startCol (existing UX);
      // drag → multi-column segment.
      if (!didDrag) {
        if (kind === 'status') addStatusSegment(laneId, startCol, startCol);
        else addTimelineSegment(laneId, startCol, startCol);
      } else {
        if (kind === 'status') addStatusSegment(laneId, minCol, maxCol);
        else addTimelineSegment(laneId, minCol, maxCol);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
  }, [readOnly, rf, totalColumns, isOccupied, clampThroughOccupied, kind, laneId, addStatusSegment, addTimelineSegment, setSelectedLaneSegment, setSelectedLaneId]);

  const onMove = (e: React.MouseEvent) => {
    if (readOnly || drawRange) return;
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const col = getColFromX(flowPos.x, totalColumns);
    setHoverCol(col);
  };

  const blocked = hoverCol !== null && isOccupied(hoverCol);
  const previewMin = drawRange ? Math.min(drawRange.start, drawRange.end) : hoverCol;
  const previewMax = drawRange ? Math.max(drawRange.start, drawRange.end) : hoverCol;
  const showPreview = !readOnly && previewMin !== null && previewMax !== null && (drawRange || !blocked);

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={() => { if (!drawRange) setHoverCol(null); }}
      onMouseDown={onMouseDown}
      style={{
        width,
        height,
        position: 'relative',
        cursor: readOnly ? 'default' : (blocked && !drawRange ? 'not-allowed' : 'copy'),
      }}
    >
      {showPreview && previewMin !== null && previewMax !== null && (
        <div
          style={{
            position: 'absolute',
            left: previewMin * PHASE_WIDTH,
            top: 4,
            width: (previewMax - previewMin + 1) * PHASE_WIDTH,
            height: height - 8,
            background: `${color}1A`,
            border: `1px dashed ${color}`,
            borderRadius: 'var(--radius-md)',
            opacity: drawRange ? 0.85 : 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            pointerEvents: 'none',
            transition: drawRange ? 'none' : 'left 0.1s, width 0.1s',
          }}
        >
          <Plus size={14} />
        </div>
      )}
    </div>
  );
});

// ─── Status segment ───────────────────────────────────────────────────────────

type StatusSegmentData = {
  segment: LaneSegment;
  laneId: string;
  kind: 'status' | 'timeline';
  color: string;
  width: number;
  height: number;
  totalColumns: number;
  siblings: LaneSegment[];
};

export const StatusSegmentNode = memo(({ data }: NodeProps) => {
  const { segment, laneId, kind, color, width, height, totalColumns, siblings } = data as StatusSegmentData;
  const removeStatusSegment = useBlueprintStore((s) => s.removeStatusSegment);
  const updateStatusSegment = useBlueprintStore((s) => s.updateStatusSegment);
  const setSelectedLaneSegment = useBlueprintStore((s) => s.setSelectedLaneSegment);
  const selectedLaneSegmentId = useBlueprintStore((s) => s.selectedLaneSegmentId);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const openThread = useCommentsStore((s) => s.openThread);
  const readOnly = presentMode || isGuestView || commentMode;
  const rf = useReactFlow();

  const selected = selectedLaneSegmentId === segment.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.label);
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);

  useEffect(() => { setDraft(segment.label); }, [segment.label]);

  const commit = () => {
    const v = draft.trim();
    if (v !== segment.label) updateStatusSegment(laneId, segment.id, { label: v });
    setEditing(false);
  };

  const drag = useDragHandle({
    rf, totalColumns, segment, siblings, readOnly,
    laneId, kind,
    onClickWithoutDrag: () => setSelectedLaneSegment(segment.id),
  });

  // Live drag updates the store directly; no local preview transform needed
  const activeEdge: 'left' | 'right' | null =
    drag.activeEdge ?? hoveredEdge;

  return (
    <div
      onMouseLeave={() => { setHoveredEdge(null); }}
      onClick={(e) => {
        if (!commentMode) return;
        e.stopPropagation();
        openThread({ type: 'statusSegment', id: segment.id }, { x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        setEditing(true);
      }}
      style={{
        width,
        height,
        padding: 6,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <CommentBadge
        anchor={{ type: 'statusSegment', id: segment.id }}
        style={{ position: 'absolute', top: -2, right: -2, zIndex: 8 }}
      />
      <div
        onMouseDown={(e) => drag.onBodyDown(e)}
        style={{
          width: width - 12,
          height: height - 12,
          background: `${color}20`,
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
          boxShadow: drag.dragging
            ? `0 0 0 3px ${color}55, var(--shadow-md)`
            : selected
            ? `0 0 0 2px ${color}33`
            : 'none',
          transition: drag.dragging ? 'none' : 'box-shadow 0.15s',
          overflow: 'hidden',
          cursor: readOnly ? 'default' : (drag.dragging && drag.mode === 'move' ? 'grabbing' : 'grab'),
          zIndex: drag.dragging ? 100 : 1,
          position: 'relative',
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { setDraft(segment.label); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              color,
              textAlign: 'center',
            }}
          />
        ) : (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {segment.label || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Status…</span>}
          </span>
        )}

        {/* Edge handles — always responsive, icon shows on edge hover */}
        {!readOnly && !editing && (
          <>
            <div
              onMouseEnter={() => !drag.dragging && setHoveredEdge('left')}
              onMouseLeave={() => !drag.dragging && setHoveredEdge((e) => e === 'left' ? null : e)}
              onMouseDown={(e) => drag.onEdgeDown(e, 'left')}
              style={resizeHandleStyle('left')}
            />
            <div
              onMouseEnter={() => !drag.dragging && setHoveredEdge('right')}
              onMouseLeave={() => !drag.dragging && setHoveredEdge((e) => e === 'right' ? null : e)}
              onMouseDown={(e) => drag.onEdgeDown(e, 'right')}
              style={resizeHandleStyle('right')}
            />
            {activeEdge && (
              <div
                style={{
                  position: 'absolute',
                  [activeEdge]: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 6,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <MoveHorizontal size={11} color="#fff" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected controls — color picker + delete */}
      {!readOnly && selected && !editing && !drag.dragging && (
        <>
          <SegmentColorPicker
            currentColor={color}
            hasOverride={segment.color !== undefined}
            onPick={(c) => updateStatusSegment(laneId, segment.id, { color: c })}
            onReset={() => updateStatusSegment(laneId, segment.id, { color: undefined })}
            anchorStyle={{ position: 'absolute', top: -2, right: 22, zIndex: 7 }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); removeStatusSegment(laneId, segment.id); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Delete"
            style={{ ...iconBtnStyle, position: 'absolute', top: -2, right: -2, background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', zIndex: 7 }}
          >
            <Trash2 size={10} />
          </button>
        </>
      )}
    </div>
  );
});

// ─── Timeline segment ─────────────────────────────────────────────────────────

type TimelineSegmentData = {
  segment: LaneSegment;
  laneId: string;
  kind: 'status' | 'timeline';
  color: string;
  width: number;
  height: number;
  totalColumns: number;
  siblings: LaneSegment[];
};

export const TimelineSegmentNode = memo(({ data }: NodeProps) => {
  const { segment, laneId, kind, color, width, height, totalColumns, siblings } = data as TimelineSegmentData;
  const updateTimelineSegment = useBlueprintStore((s) => s.updateTimelineSegment);
  const removeTimelineSegment = useBlueprintStore((s) => s.removeTimelineSegment);
  const setSelectedLaneSegment = useBlueprintStore((s) => s.setSelectedLaneSegment);
  const selectedLaneSegmentId = useBlueprintStore((s) => s.selectedLaneSegmentId);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const openThread = useCommentsStore((s) => s.openThread);
  const readOnly = presentMode || isGuestView || commentMode;
  const rf = useReactFlow();

  const selected = selectedLaneSegmentId === segment.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.label);
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);

  useEffect(() => { setDraft(segment.label); }, [segment.label]);

  const commit = () => {
    const v = draft.trim();
    if (v !== segment.label) updateTimelineSegment(laneId, segment.id, { label: v });
    setEditing(false);
  };

  const drag = useDragHandle({
    rf, totalColumns, segment, siblings, readOnly,
    laneId, kind,
    onClickWithoutDrag: () => setSelectedLaneSegment(segment.id),
  });

  const activeEdge: 'left' | 'right' | null =
    drag.activeEdge ?? hoveredEdge;

  return (
    <div
      onMouseLeave={() => { setHoveredEdge(null); }}
      onClick={(e) => {
        if (!commentMode) return;
        e.stopPropagation();
        openThread({ type: 'timelineSegment', id: segment.id }, { x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        setEditing(true);
      }}
      style={{
        width,
        height,
        position: 'relative',
      }}
    >
      <CommentBadge
        anchor={{ type: 'timelineSegment', id: segment.id }}
        style={{ position: 'absolute', top: -8, right: -2, zIndex: 8 }}
      />
      <div
        onMouseDown={(e) => drag.onBodyDown(e)}
        style={{
          width,
          height,
          padding: '8px 12px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: readOnly ? 'default' : (drag.dragging && drag.mode === 'move' ? 'grabbing' : 'grab'),
          opacity: drag.dragging ? 0.85 : 1,
          zIndex: drag.dragging ? 100 : 1,
          position: 'relative',
        }}
      >
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
        <div
          style={{
            flex: 1,
            height: 0,
            borderTop: `2px dotted ${color}`,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -22,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0 8px',
              whiteSpace: 'nowrap',
            }}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setDraft(segment.label); setEditing(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: 100,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                }}
              />
            ) : (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                {segment.label || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Duration…</span>}
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />

        {!readOnly && !editing && selected && (
          <>
            <div
              onMouseEnter={() => !drag.dragging && setHoveredEdge('left')}
              onMouseLeave={() => !drag.dragging && setHoveredEdge((e) => e === 'left' ? null : e)}
              onMouseDown={(e) => drag.onEdgeDown(e, 'left')}
              style={resizeHandleStyle('left')}
            />
            <div
              onMouseEnter={() => !drag.dragging && setHoveredEdge('right')}
              onMouseLeave={() => !drag.dragging && setHoveredEdge((e) => e === 'right' ? null : e)}
              onMouseDown={(e) => drag.onEdgeDown(e, 'right')}
              style={resizeHandleStyle('right')}
            />
            {activeEdge && (
              <div
                style={{
                  position: 'absolute',
                  [activeEdge]: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 6,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <MoveHorizontal size={11} color="#fff" />
              </div>
            )}
          </>
        )}
      </div>

      {!readOnly && selected && !editing && !drag.dragging && (
        <>
          <SegmentColorPicker
            currentColor={color}
            hasOverride={segment.color !== undefined}
            onPick={(c) => updateTimelineSegment(laneId, segment.id, { color: c })}
            onReset={() => updateTimelineSegment(laneId, segment.id, { color: undefined })}
            anchorStyle={{ position: 'absolute', top: -6, right: 18, zIndex: 7 }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); removeTimelineSegment(laneId, segment.id); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Delete"
            style={{ ...iconBtnStyle, position: 'absolute', top: -6, right: -6, background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', zIndex: 7 }}
          >
            <Trash2 size={10} />
          </button>
        </>
      )}
    </div>
  );
});

// ─── Drag handle helper ───────────────────────────────────────────────────────
// Manages move + resize for a lane segment with click-vs-drag detection and
// neighbor-cascade resize.
//
// Click vs drag:
//   - Mousedown starts a "potential" drag. Only when the cursor moves > 4px
//     is it promoted to a real drag (history is pushed once at that moment).
//   - If mouseup fires before the threshold, fire `onClickWithoutDrag` instead
//     (used for select-on-click).
//
// Snap: resize/move snap to the column whose CENTER is closest to the cursor
// (`getColFromXSnap`), so shrinking and expanding require equal cursor travel.
//
// Overlap rules:
//   - Move: the segment's [start, end] cannot intersect any sibling's range —
//     hard-clamps against immediate neighbors.
//   - Resize: the dragged edge can PUSH neighbors. Each pushed neighbor's
//     opposite edge stays anchored, so it shrinks. If pushing would make it
//     width 0, the cascade stops there and our edge clamps one column short of
//     the neighbor's anchor.
//
// Every mousemove writes the full set of patches (self + cascades + any
// previously-touched siblings reset to their original) via `applyLaneDrag`,
// so dragging back unwinds the cascade correctly.

type Mode = 'move' | 'left' | 'right';
const DRAG_THRESHOLD = 4;  // px

function useDragHandle(opts: {
  rf: ReturnType<typeof useReactFlow>;
  totalColumns: number;
  segment: LaneSegment;
  siblings: LaneSegment[];
  readOnly: boolean;
  laneId: string;
  kind: 'status' | 'timeline';
  onClickWithoutDrag: () => void;
}) {
  const { rf, totalColumns, segment, siblings, readOnly, laneId, kind, onClickWithoutDrag } = opts;
  const beginLaneDrag = useBlueprintStore((s) => s.beginLaneDrag);
  const applyLaneDrag = useBlueprintStore((s) => s.applyLaneDrag);

  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  const start = useCallback((e: React.MouseEvent, m: Mode) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();

    const startScreenX = e.clientX;
    const flowX0 = rf.screenToFlowPosition({ x: startScreenX, y: 0 }).x;
    const anchorCol = getColFromXSnap(flowX0, totalColumns);
    const baseStart = segment.startCol;
    const baseEnd = segment.endCol;
    const len = baseEnd - baseStart;

    // Capture original positions of all siblings so we can reset them when the
    // drag unwinds.
    const origSiblings = siblings.map((s) => ({ id: s.id, startCol: s.startCol, endCol: s.endCol }));
    const touchedSiblings = new Set<string>();
    let started = false;

    // Hard clamps for MOVE (neighbors don't get pushed when moving)
    const leftNeighborEnd = origSiblings
      .filter((s) => s.endCol < baseStart)
      .reduce((acc, s) => Math.max(acc, s.endCol), -1);
    const rightNeighborStart = origSiblings
      .filter((s) => s.startCol > baseEnd)
      .reduce((acc, s) => Math.min(acc, s.startCol), totalColumns);

    const onMove = (ev: MouseEvent) => {
      // Promote to real drag only after threshold
      if (!started) {
        const dx = Math.abs(ev.clientX - startScreenX);
        if (dx < DRAG_THRESHOLD) return;
        started = true;
        setDragging(true);
        setMode(m);
        beginLaneDrag();
      }

      const flowX = rf.screenToFlowPosition({ x: ev.clientX, y: 0 }).x;
      const col = getColFromXSnap(flowX, totalColumns);
      const delta = col - anchorCol;

      let newStart = baseStart;
      let newEnd = baseEnd;
      const cascades: Record<string, Partial<LaneSegment>> = {};

      if (m === 'move') {
        newStart = baseStart + delta;
        newEnd = baseEnd + delta;
        if (newStart < 0) { newStart = 0; newEnd = len; }
        if (newEnd >= totalColumns) { newEnd = totalColumns - 1; newStart = newEnd - len; }
        if (newStart <= leftNeighborEnd) { newStart = leftNeighborEnd + 1; newEnd = newStart + len; }
        if (newEnd >= rightNeighborStart) { newEnd = rightNeighborStart - 1; newStart = newEnd - len; }
      } else if (m === 'right') {
        newEnd = baseEnd + delta;
        if (newEnd >= totalColumns) newEnd = totalColumns - 1;
        if (newEnd < baseStart) newEnd = baseStart;
        // Cascade: push right neighbors (sorted by startCol ascending)
        const rightN = origSiblings
          .filter((s) => s.startCol > baseEnd)
          .sort((a, b) => a.startCol - b.startCol);
        let limit = newEnd;
        for (const n of rightN) {
          if (n.startCol > limit) break;
          const proposedStart = limit + 1;
          if (proposedStart > n.endCol) {
            // Would squash neighbor — stop cascading and clamp our edge
            cascades[n.id] = { startCol: n.endCol, endCol: n.endCol };
            touchedSiblings.add(n.id);
            newEnd = Math.min(newEnd, n.endCol - 1);
            break;
          }
          cascades[n.id] = { startCol: proposedStart, endCol: n.endCol };
          touchedSiblings.add(n.id);
          limit = proposedStart;
        }
      } else { // 'left'
        newStart = baseStart + delta;
        if (newStart < 0) newStart = 0;
        if (newStart > baseEnd) newStart = baseEnd;
        // Cascade: push left neighbors (sorted by endCol descending)
        const leftN = origSiblings
          .filter((s) => s.endCol < baseStart)
          .sort((a, b) => b.endCol - a.endCol);
        let limit = newStart;
        for (const n of leftN) {
          if (n.endCol < limit) break;
          const proposedEnd = limit - 1;
          if (proposedEnd < n.startCol) {
            cascades[n.id] = { startCol: n.startCol, endCol: n.startCol };
            touchedSiblings.add(n.id);
            newStart = Math.max(newStart, n.startCol + 1);
            break;
          }
          cascades[n.id] = { startCol: n.startCol, endCol: proposedEnd };
          touchedSiblings.add(n.id);
          limit = proposedEnd;
        }
      }

      // Build full patch set: self + cascades + reset for any previously-touched
      // siblings that are no longer being pushed in this frame.
      const patches: Record<string, Partial<LaneSegment>> = {};
      patches[segment.id] = { startCol: newStart, endCol: newEnd };
      for (const sid of touchedSiblings) {
        if (cascades[sid]) {
          patches[sid] = cascades[sid];
        } else {
          // Reset to original
          const orig = origSiblings.find((o) => o.id === sid);
          if (orig) patches[sid] = { startCol: orig.startCol, endCol: orig.endCol };
        }
      }

      applyLaneDrag(laneId, kind, patches);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (started) {
        setDragging(false);
        setMode(null);
      } else {
        // Click without drag — fire callback (select-on-click)
        onClickWithoutDrag();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rf, totalColumns, readOnly, laneId, kind, segment.id, segment.startCol, segment.endCol, siblings, beginLaneDrag, applyLaneDrag, onClickWithoutDrag]);

  const onBodyDown = useCallback((e: React.MouseEvent) => start(e, 'move'), [start]);
  const onEdgeDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => start(e, side), [start]);

  const activeEdge: 'left' | 'right' | null =
    mode === 'left' ? 'left' : mode === 'right' ? 'right' : null;

  return { dragging, mode, activeEdge, onBodyDown, onEdgeDown };
}

// ─── Lane label controls (Trash + Color picker, outside left of label) ──────
// Rendered when a lane is selected. Positioned to the LEFT of the lane label
// (outside the highlighted ACTOR_LABEL_WIDTH region) so the controls don't sit
// on top of the lane name. Trash is outermost; color picker sits between trash
// and the label.

function LaneLabelControls({ color, onPickColor, onDelete }: {
  color: string;
  onPickColor: (color: string) => void;
  onDelete: () => void;
}) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: 8,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        pointerEvents: 'all',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete lane"
        style={laneCtrlBtnStyle('danger')}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; }}
      >
        <Trash2 size={12} />
      </button>
      <SegmentColorPicker
        currentColor={color}
        hasOverride={false}
        onPick={onPickColor}
        onReset={() => {}}
        anchorStyle={{ position: 'relative' }}
        popoverStyle={{ top: 'calc(100% + 6px)', right: 'auto', left: 0 }}
        buttonContent={<div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />}
        buttonStyleOverride={laneCtrlBtnStyle('neutral')}
      />
    </div>
  );
}

function laneCtrlBtnStyle(variant: 'danger' | 'neutral'): React.CSSProperties {
  if (variant === 'danger') {
    return {
      width: 24,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      color: 'var(--accent-danger)',
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.15)',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      transition: 'background 0.15s',
    };
  }
  return {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    background: 'var(--surface-bg)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
  };
}

// ─── Segment color picker ─────────────────────────────────────────────────────
// Small swatch button + 6-color popover. Click swatch → popover; click color →
// patch segment.color; click reset → patch segment.color = undefined (falls
// back to lane color via `seg.color ?? lane.color` in layout.ts).

const SEGMENT_PALETTE = ['#3B82F6', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#EF4444', '#6B7280'];

function SegmentColorPicker({ currentColor, hasOverride, onPick, onReset, anchorStyle, popoverStyle, buttonContent, buttonStyleOverride }: {
  currentColor: string;
  hasOverride: boolean;
  onPick: (color: string) => void;
  onReset: () => void;
  anchorStyle: React.CSSProperties;
  popoverStyle?: React.CSSProperties;
  buttonContent?: React.ReactNode;
  buttonStyleOverride?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Change colour"
        style={{
          ...iconBtnStyle,
          ...anchorStyle,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          color: currentColor,
          ...buttonStyleOverride,
        }}
      >
        {buttonContent ?? <Palette size={10} />}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: -36,
            right: -2,
            display: 'flex',
            gap: 4,
            padding: 6,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 12,
            ...popoverStyle,
          }}
        >
          {SEGMENT_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { onPick(c); setOpen(false); }}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: c,
                border: c === currentColor ? '2px solid var(--text-primary)' : 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
          {hasOverride && (
            <button
              onClick={() => { onReset(); setOpen(false); }}
              title="Reset to lane colour"
              style={{ ...iconBtnStyle, color: 'var(--text-muted)' }}
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  borderRadius: 4,
  cursor: 'pointer',
};

function resizeHandleStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 12,
    cursor: 'ew-resize',
    zIndex: 5,
    background: 'transparent',
  };
}
