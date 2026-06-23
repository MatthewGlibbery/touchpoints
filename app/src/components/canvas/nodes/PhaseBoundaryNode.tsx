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
        overflow: 'visible',
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
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: visible ? 'var(--accent-primary)' : 'transparent',
            opacity: visible ? 1 : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background var(--transition-fast), opacity var(--transition-fast)',
          }}
        >
          {visible && <MoveHorizontal size={12} color="#fff" />}
        </div>
      </div>

      {/* Body zone — hidden; gap between phases provides visual separation */}
      <div
        style={{
          width: 0,
          flex: 1,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});
