import { memo, useState, useRef, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { MoveHorizontal } from 'lucide-react';
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
        zIndex: 5,
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
          cursor: 'ew-resize',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: visible ? 22 : 6,
            height: visible ? 22 : 26,
            borderRadius: visible ? '50%' : 3,
            background: visible ? 'var(--accent-primary)' : 'var(--border-strong)',
            opacity: visible ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background var(--transition-fast), opacity var(--transition-fast), width var(--transition-fast), height var(--transition-fast), border-radius var(--transition-fast)',
          }}
        >
          {visible && <MoveHorizontal size={12} color="#fff" />}
        </div>
      </div>

      {/* Body zone — visual divider only, no interaction */}
      <div
        style={{
          width: visible ? 2 : 1,
          flex: 1,
          background: visible ? 'var(--accent-primary)' : 'var(--border-strong)',
          opacity: visible ? 0.6 : 0.55,
          transition: 'background var(--transition-fast), opacity var(--transition-fast), width var(--transition-fast)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});
