import { memo, useState, useRef, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { PHASE_HEADER_HEIGHT } from '../../../lib/layout';

type PhaseBoundaryData = {
  leftPhaseId: string;
  rightPhaseId: string;
  canvasHeight: number;
};

export const PhaseBoundaryNode = memo(({ data }: NodeProps) => {
  const { leftPhaseId, rightPhaseId, canvasHeight } = data as PhaseBoundaryData;
  const movePhaseBoundary = useBlueprintStore((s) => s.movePhaseBoundary);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const threshold = 80;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragStartX.current = e.clientX;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      if (delta > threshold) {
        movePhaseBoundary(leftPhaseId, rightPhaseId, 'right');
        dragStartX.current = ev.clientX;
      } else if (delta < -threshold) {
        movePhaseBoundary(leftPhaseId, rightPhaseId, 'left');
        dragStartX.current = ev.clientX;
      }
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftPhaseId, rightPhaseId, movePhaseBoundary]);

  const visible = hovered || dragging;

  return (
    <div
      style={{
        width: 16,
        height: canvasHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        zIndex: 25,
        position: 'relative',
      }}
    >
      {/* Header zone — draggable */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={onMouseDown}
        title="Drag to move substeps between phases"
        style={{
          width: '100%',
          height: PHASE_HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging ? 'ew-resize' : 'col-resize',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 28,
            borderRadius: 6,
            background: visible ? 'var(--accent-primary)' : 'var(--border-strong)',
            opacity: visible ? 1 : 0.45,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            transition: 'background var(--transition-fast), opacity var(--transition-fast)',
          }}
        >
          {visible && (
            <>
              <ChevronLeft size={8} color="#fff" style={{ marginBottom: -2 }} />
              <ChevronRight size={8} color="#fff" style={{ marginTop: -2 }} />
            </>
          )}
        </div>
      </div>

      {/* Body zone — visual divider only, no interaction */}
      <div
        style={{
          width: visible ? 2 : 1,
          flex: 1,
          background: visible ? 'var(--accent-primary)' : 'var(--border-strong)',
          opacity: visible ? 0.6 : 0.25,
          transition: 'background var(--transition-fast), opacity var(--transition-fast), width var(--transition-fast)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});
