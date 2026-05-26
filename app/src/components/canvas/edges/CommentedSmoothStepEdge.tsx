import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { CommentBadge } from '../../ui/CommentBadge';
import { useBlueprintStore } from '../../../store/blueprint.store';

type EdgeData = { labelOffset?: number; sourceOffset?: number; targetOffset?: number };

// Wraps the standard smoothstep edge and renders:
//   - the edge path itself
//   - the existing string label (now draggable along the path) + comment badge
//   - visible endpoint markers when the edge is selected (the underlying
//     ReactFlow EdgeAnchor handles the actual reconnect drag — our circles are
//     pointer-events:none visual hints sitting on top of those anchors)
export const CommentedSmoothStepEdge = memo((props: EdgeProps) => {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    style, markerEnd, label, selected, data,
  } = props;

  const labelOffset = (data as EdgeData | undefined)?.labelOffset ?? 0.5;
  const sourceHandleOffset = (data as EdgeData | undefined)?.sourceOffset ?? 0;
  const targetHandleOffset = (data as EdgeData | undefined)?.targetOffset ?? 0;

  // Apply perpendicular offsets to avoid overlapping edges at shared handles
  // Right/Left handles: offset is vertical (Y); Top/Bottom handles: offset is horizontal (X)
  const sX = sourceX + (sourcePosition === 'top' || sourcePosition === 'bottom' ? sourceHandleOffset : 0);
  const sY = sourceY + (sourcePosition === 'left' || sourcePosition === 'right' ? sourceHandleOffset : 0);
  const tX = targetX + (targetPosition === 'top' || targetPosition === 'bottom' ? targetHandleOffset : 0);
  const tY = targetY + (targetPosition === 'left' || targetPosition === 'right' ? targetHandleOffset : 0);

  const updateEdgeMeta = useBlueprintStore((s) => s.updateEdgeMeta);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const dragLocked = presentMode || isGuestView || commentMode || isCollaboratorView;

  const rf = useReactFlow();

  // Custom path builder: produces clean paths with at most 2 turns.
  // Rules:
  //   - Straight line when source/target are aligned on the relevant axis
  //   - 1 turn (L-shape) when one axis is shared
  //   - 2 turns (Z/S-shape) when routing across then up/down then across
  // The path always leaves perpendicular to the source handle and arrives
  // perpendicular to the target handle.
  const buildPath = (): [string, number, number] => {
    const r = 8; // corner radius
    const dy = tY - sY;
    const dx = tX - sX;

    // Determine if this is a horizontal edge (right→left) or vertical (bottom→top)
    const leavesHorizontal = sourcePosition === 'right' || sourcePosition === 'left';
    const arrivesHorizontal = targetPosition === 'right' || targetPosition === 'left';

    // Case 1: Both horizontal (right→left) — most common (same-row sequential)
    if (leavesHorizontal && arrivesHorizontal) {
      // Straight horizontal if same Y
      if (Math.abs(dy) < 1) {
        const path = `M ${sX} ${sY} L ${tX} ${tY}`;
        return [path, (sX + tX) / 2, sY];
      }
      // Z-shape: across → vertical → across (2 turns)
      const midX = (sX + tX) / 2;
      const signY = dy > 0 ? 1 : -1;
      const absR = Math.min(r, Math.abs(dx) / 4, Math.abs(dy) / 2);
      const path = [
        `M ${sX} ${sY}`,
        `L ${midX - absR} ${sY}`,
        `Q ${midX} ${sY} ${midX} ${sY + signY * absR}`,
        `L ${midX} ${tY - signY * absR}`,
        `Q ${midX} ${tY} ${midX + (dx > 0 ? absR : -absR)} ${tY}`,
        `L ${tX} ${tY}`,
      ].join(' ');
      return [path, midX, (sY + tY) / 2];
    }

    // Case 2: Both vertical (bottom→top) — same-column adjacent actors
    if (!leavesHorizontal && !arrivesHorizontal) {
      // Straight vertical if same X
      if (Math.abs(dx) < 1) {
        const path = `M ${sX} ${sY} L ${tX} ${tY}`;
        return [path, sX, (sY + tY) / 2];
      }
      // Z-shape: down → horizontal → down (2 turns)
      const midY = (sY + tY) / 2;
      const signX = dx > 0 ? 1 : -1;
      const absR = Math.min(r, Math.abs(dy) / 4, Math.abs(dx) / 2);
      const path = [
        `M ${sX} ${sY}`,
        `L ${sX} ${midY - (dy > 0 ? absR : -absR)}`,
        `Q ${sX} ${midY} ${sX + signX * absR} ${midY}`,
        `L ${tX - signX * absR} ${midY}`,
        `Q ${tX} ${midY} ${tX} ${midY + (dy > 0 ? absR : -absR)}`,
        `L ${tX} ${tY}`,
      ].join(' ');
      return [path, (sX + tX) / 2, midY];
    }

    // Case 3: Mixed — horizontal source, vertical target (or vice versa)
    // L-shape: one turn
    if (leavesHorizontal && !arrivesHorizontal) {
      // Goes horizontal then turns vertical into target
      const absR = Math.min(r, Math.abs(dx), Math.abs(dy));
      const signX = dx > 0 ? 1 : -1;
      const signY = dy > 0 ? 1 : -1;
      const path = [
        `M ${sX} ${sY}`,
        `L ${tX - signX * absR} ${sY}`,
        `Q ${tX} ${sY} ${tX} ${sY + signY * absR}`,
        `L ${tX} ${tY}`,
      ].join(' ');
      return [path, tX, (sY + tY) / 2];
    }

    // Vertical source, horizontal target
    const absR = Math.min(r, Math.abs(dx), Math.abs(dy));
    const signX = dx > 0 ? 1 : -1;
    const signY = dy > 0 ? 1 : -1;
    const path = [
      `M ${sX} ${sY}`,
      `L ${sX} ${tY - signY * absR}`,
      `Q ${sX} ${tY} ${sX + signX * absR} ${tY}`,
      `L ${tX} ${tY}`,
    ].join(' ');
    return [path, (sX + tX) / 2, tY];
  };

  const [path, defaultLabelX, defaultLabelY] = buildPath();

  // Hidden path used to measure points along the rendered edge for label
  // positioning + cursor projection during drag.
  const measurePathRef = useRef<SVGPathElement>(null);
  const [labelXY, setLabelXY] = useState<{ x: number; y: number }>({ x: defaultLabelX, y: defaultLabelY });

  // Live preview of where the label will land while dragging — drives the
  // visible label position without committing to the store on every move.
  const [previewOffset, setPreviewOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const effectiveOffset = previewOffset ?? labelOffset;

  // Recompute label position whenever the path or offset changes.
  useEffect(() => {
    const p = measurePathRef.current;
    if (!p) return;
    try {
      const total = p.getTotalLength();
      const pt = p.getPointAtLength(total * effectiveOffset);
      setLabelXY({ x: pt.x, y: pt.y });
    } catch {
      // Some browsers throw if the path is empty — fall back to default.
      setLabelXY({ x: defaultLabelX, y: defaultLabelY });
    }
  }, [path, effectiveOffset, defaultLabelX, defaultLabelY]);

  // Project a flow-coord point onto the rendered path, returning a fraction in [0,1].
  const projectToOffset = useCallback((flowX: number, flowY: number): number => {
    const p = measurePathRef.current;
    if (!p) return 0.5;
    const total = p.getTotalLength();
    if (total === 0) return 0.5;
    let bestT = 0;
    let bestDist = Infinity;
    // Coarse pass at 1% resolution.
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const pt = p.getPointAtLength(total * t);
      const d = (pt.x - flowX) ** 2 + (pt.y - flowY) ** 2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    // Fine pass within ±1%.
    const lo = Math.max(0, bestT - 0.01);
    const hi = Math.min(1, bestT + 0.01);
    for (let t = lo; t <= hi; t += 0.001) {
      const pt = p.getPointAtLength(total * t);
      const d = (pt.x - flowX) ** 2 + (pt.y - flowY) ** 2;
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    return bestT;
  }, []);

  const onLabelMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragLocked) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    let didDrag = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const flow = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const t = projectToOffset(flow.x, flow.y);
      setPreviewOffset(t);
      didDrag = true;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragging(false);
      if (didDrag && previewOffsetRef.current !== null) {
        // Round to 4 decimals to keep storage tidy.
        const t = Math.round(previewOffsetRef.current * 10000) / 10000;
        updateEdgeMeta(id, { labelOffset: t });
      }
      setPreviewOffset(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dragLocked, rf, projectToOffset, id, updateEdgeMeta]);

  // Keep a ref of previewOffset so the mouseup handler reads the latest value
  // without having to re-attach the listener on every state change.
  const previewOffsetRef = useRef<number | null>(null);
  useEffect(() => { previewOffsetRef.current = previewOffset; }, [previewOffset]);

  const showEndpointMarkers = !!selected && !dragLocked;
  const hasLabel = !!label;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd as any} />
      {/* Hidden path used purely for measurement (getPointAtLength). */}
      <path ref={measurePathRef} d={path} fill="none" stroke="none" pointerEvents="none" />

      {/* Visible endpoint markers — pointer-events:none so ReactFlow's
          underlying EdgeAnchor (sibling, not child) still grabs the drag. */}
      {showEndpointMarkers && (
        <>
          <circle
            cx={sX} cy={sY} r={6}
            fill="var(--accent-primary)" fillOpacity={0.95}
            stroke="var(--surface-bg)" strokeWidth={2}
            pointerEvents="none"
          />
          <circle
            cx={tX} cy={tY} r={6}
            fill="var(--accent-primary)" fillOpacity={0.95}
            stroke="var(--surface-bg)" strokeWidth={2}
            pointerEvents="none"
          />
        </>
      )}

      <EdgeLabelRenderer>
        <div
          onMouseDown={hasLabel ? onLabelMouseDown : undefined}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelXY.x}px, ${labelXY.y}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            zIndex: 5,
            cursor: hasLabel && !dragLocked ? (dragging ? 'grabbing' : 'grab') : 'default',
            userSelect: 'none',
            transition: dragging ? 'none' : 'transform 0.08s linear',
          }}
          className="nodrag nopan"
        >
          {label && (
            <span
              title={dragLocked ? undefined : 'Drag to reposition along edge'}
              style={{
                padding: '2px 6px',
                background: 'var(--surface-bg)',
                border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                boxShadow: dragging ? 'var(--shadow-md)' : 'none',
              }}
            >
              {String(label)}
            </span>
          )}
          <CommentBadge anchor={{ type: 'edge', id }} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
