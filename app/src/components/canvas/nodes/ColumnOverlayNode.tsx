import { memo, useState, useCallback, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { GripHorizontal, X } from 'lucide-react';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { PHASE_WIDTH } from '../../../lib/layout';
import { ConfirmDeleteModal } from '../../ui/ConfirmDeleteModal';

type ColumnOverlayData = { phaseId: string; order: number; colCount: number; height: number };

export const ColumnOverlayNode = memo(({ data }: NodeProps) => {
  const { phaseId, order, colCount, height } = data as ColumnOverlayData;
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const setSelectedColumnKey = useBlueprintStore((s) => s.setSelectedColumnKey);
  const selectedColumnKey = useBlueprintStore((s) => s.selectedColumnKey);
  const deleteSubstep = useBlueprintStore((s) => s.deleteSubstep);
  const moveSubstep = useBlueprintStore((s) => s.moveSubstep);

  const [colDragging, setColDragging] = useState(false);
  const [colDragOffset, setColDragOffset] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragStartX = useRef(0);
  const threshold = PHASE_WIDTH * 0.5;

  const colKey = `${phaseId}-${order}`;
  const selected = selectedColumnKey === colKey;
  const showControls = selected && colCount > 1;

  const onGripMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragStartX.current = e.clientX;
    setColDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      setColDragOffset(delta);
      if (delta > threshold) {
        moveSubstep(phaseId, order, 'right');
        dragStartX.current = ev.clientX;
        setColDragOffset(0);
      } else if (delta < -threshold) {
        moveSubstep(phaseId, order, 'left');
        dragStartX.current = ev.clientX;
        setColDragOffset(0);
      }
    };

    const onUp = () => {
      setColDragging(false);
      setColDragOffset(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [phaseId, order, moveSubstep, threshold]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setSelectedColumnKey(selected ? null : colKey);
      }}
      style={{
        width: PHASE_WIDTH,
        height,
        position: 'relative',
        background: selected ? 'rgba(59,130,246,0.03)' : 'transparent',
        cursor: 'default',
        transition: 'background 0.15s',
        boxSizing: 'border-box',
        borderLeft: selected ? '2px solid rgba(59,130,246,0.25)' : '2px solid transparent',
        borderRight: selected ? '2px solid rgba(59,130,246,0.25)' : '2px solid transparent',
      }}
    >
      {/* Control bar — grip + delete, shown only when selected and multi-column */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'all' : 'none',
          transition: 'opacity 0.15s',
          background: showControls ? 'rgba(59,130,246,0.06)' : 'transparent',
          borderBottom: showControls ? '1px solid rgba(59,130,246,0.12)' : 'none',
          transform: `translateX(${colDragOffset}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onMouseDown={onGripMouseDown}
          title="Drag to reorder column"
          style={{
            cursor: colDragging ? 'grabbing' : 'grab',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 4,
            opacity: 0.7,
          }}
        >
          <GripHorizontal size={11} />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const hasActions = (blueprint?.actions ?? []).some(
              (a) => a.phaseId === phaseId && a.order === order
            );
            if (hasActions) {
              setConfirmDelete(true);
            } else {
              deleteSubstep(phaseId, order);
            }
          }}
          title="Delete column"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 4,
            opacity: 0.7,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-danger)';
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
          }}
        >
          <X size={11} />
        </button>
      </div>
      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete this column?"
          description="This will permanently remove the column and all steps in it."
          onConfirm={() => { setConfirmDelete(false); deleteSubstep(phaseId, order); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
});
