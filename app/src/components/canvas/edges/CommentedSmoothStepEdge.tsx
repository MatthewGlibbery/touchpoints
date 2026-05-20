import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { CommentBadge } from '../../ui/CommentBadge';
import { useBlueprintStore } from '../../../store/blueprint.store';

type EdgeData = { labelOffset?: number };

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

  const updateEdgeMeta = useBlueprintStore((s) => s.updateEdgeMeta);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const dragLocked = presentMode || isGuestView || commentMode || isCollaboratorView;

  const rf = useReactFlow();

  const [path, defaultLabelX, defaultLabelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
  });

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
            cx={sourceX} cy={sourceY} r={6}
            fill="var(--accent-primary)" fillOpacity={0.95}
            stroke="var(--surface-bg)" strokeWidth={2}
            pointerEvents="none"
          />
          <circle
            cx={targetX} cy={targetY} r={6}
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
