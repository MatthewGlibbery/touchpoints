import { memo, useState, useCallback, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { Eye, EyeOff, Trash2, Plus, MoveHorizontal } from 'lucide-react';
import type { StatusLane, TimelineLane, LaneSegment } from '../../../types/blueprint';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { ACTOR_LABEL_WIDTH, PHASE_WIDTH, getColFromX, getColFromXSnap } from '../../../lib/layout';

// ─── Status lane label ────────────────────────────────────────────────────────

type StatusLaneLabelData = { lane: StatusLane; height: number };

export const StatusLaneLabelNode = memo(({ data }: NodeProps) => {
  const { lane, height } = data as StatusLaneLabelData;
  const updateStatusLane = useBlueprintStore((s) => s.updateStatusLane);
  const removeStatusLane = useBlueprintStore((s) => s.removeStatusLane);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const readOnly = presentMode || isGuestView;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setDraft(lane.name); }, [lane.name]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== lane.name) updateStatusLane(lane.id, { name: v });
    else setDraft(lane.name);
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 12,
        paddingLeft: 12,
        gap: 6,
        position: 'relative',
        userSelect: 'none',
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
            if (e.key === 'Escape') { setDraft(lane.name); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
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
          onDoubleClick={() => { if (!readOnly) setEditing(true); }}
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
      {!readOnly && hovered && !editing && (
        <div style={{ display: 'flex', gap: 4, position: 'absolute', right: -4, top: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); updateStatusLane(lane.id, { visible: !lane.visible }); }}
            title={lane.visible ? 'Hide lane' : 'Show lane'}
            style={iconBtnStyle}
          >
            {lane.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeStatusLane(lane.id); }}
            title="Delete lane"
            style={iconBtnStyle}
          >
            <Trash2 size={11} />
          </button>
        </div>
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
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const readOnly = presentMode || isGuestView;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setDraft(lane.name); }, [lane.name]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== lane.name) updateTimelineLane(lane.id, { name: v });
    else setDraft(lane.name);
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 12,
        paddingLeft: 12,
        position: 'relative',
        userSelect: 'none',
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
            if (e.key === 'Escape') { setDraft(lane.name); setEditing(false); }
          }}
          onClick={(e) => e.stopPropagation()}
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
          onDoubleClick={() => { if (!readOnly) setEditing(true); }}
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
      {!readOnly && hovered && !editing && (
        <div style={{ display: 'flex', gap: 4, position: 'absolute', right: -4, top: 2 }}>
          <button
            onClick={(e) => { e.stopPropagation(); updateTimelineLane(lane.id, { visible: !lane.visible }); }}
            title={lane.visible ? 'Hide lane' : 'Show lane'}
            style={iconBtnStyle}
          >
            {lane.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeTimelineLane(lane.id); }}
            title="Delete lane"
            style={iconBtnStyle}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Lane body (canvas-spanning click target for adding segments) ─────────────

type LaneBodyData = {
  laneId: string;
  kind: 'status' | 'timeline';
  width: number;
  height: number;
  totalColumns: number;
  segments: LaneSegment[];
};

export const LaneBodyNode = memo(({ data }: NodeProps) => {
  const { laneId, kind, width, height, totalColumns, segments } = data as LaneBodyData;
  const addStatusSegment = useBlueprintStore((s) => s.addStatusSegment);
  const addTimelineSegment = useBlueprintStore((s) => s.addTimelineSegment);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const readOnly = presentMode || isGuestView;
  const rf = useReactFlow();

  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const isOccupied = (col: number) =>
    segments.some((s) => col >= s.startCol && col <= s.endCol);

  const onMove = (e: React.MouseEvent) => {
    if (readOnly) return;
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const col = getColFromX(flowPos.x, totalColumns);
    setHoverCol(col);
  };

  const onClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const col = getColFromX(flowPos.x, totalColumns);
    if (isOccupied(col)) return;
    if (kind === 'status') addStatusSegment(laneId, col, col);
    else addTimelineSegment(laneId, col, col);
  };

  const blocked = hoverCol !== null && isOccupied(hoverCol);

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={() => setHoverCol(null)}
      onClick={onClick}
      style={{
        width,
        height,
        position: 'relative',
        cursor: readOnly ? 'default' : (blocked ? 'not-allowed' : 'copy'),
      }}
    >
      {hoverCol !== null && !readOnly && !blocked && (
        <div
          style={{
            position: 'absolute',
            left: hoverCol * PHASE_WIDTH,
            top: 4,
            width: PHASE_WIDTH,
            height: height - 8,
            background: 'var(--accent-primary-soft)',
            border: '1px dashed var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            opacity: 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            pointerEvents: 'none',
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
  const readOnly = presentMode || isGuestView;
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
      <div
        onMouseDown={(e) => drag.onBodyDown(e)}
        style={{
          width: width - 12,
          height: height - 12,
          background: 'var(--surface-bg)',
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--radius-lg)',
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
              color: 'var(--text-primary)',
              textAlign: 'center',
            }}
          />
        ) : (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
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

      {/* Delete button — only when SELECTED */}
      {!readOnly && selected && !editing && !drag.dragging && (
        <button
          onClick={(e) => { e.stopPropagation(); removeStatusSegment(laneId, segment.id); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete"
          style={{ ...iconBtnStyle, position: 'absolute', top: -2, right: -2, background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', zIndex: 7 }}
        >
          <Trash2 size={10} />
        </button>
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
  const readOnly = presentMode || isGuestView;
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
        <button
          onClick={(e) => { e.stopPropagation(); removeTimelineSegment(laneId, segment.id); }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete"
          style={{ ...iconBtnStyle, position: 'absolute', top: -6, right: -6, background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', zIndex: 7 }}
        >
          <Trash2 size={10} />
        </button>
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
