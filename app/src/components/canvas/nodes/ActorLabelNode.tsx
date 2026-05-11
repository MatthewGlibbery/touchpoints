import { memo, useState, useCallback, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { GripVertical } from 'lucide-react';
import type { Actor } from '../../../types/blueprint';
import { ACTOR_LABEL_WIDTH } from '../../../lib/layout';
import { useBlueprintStore } from '../../../store/blueprint.store';

type ActorLabelData = { actor: Actor; height: number };

export const ActorLabelNode = memo(({ data }: NodeProps) => {
  const { actor, height } = data as ActorLabelData;
  const setSelectedActor = useBlueprintStore((s) => s.setSelectedActor);
  const moveActor = useBlueprintStore((s) => s.moveActor);
  const setActorDragOffset = useBlueprintStore((s) => s.setActorDragOffset);
  const actorDragOffset = useBlueprintStore((s) => s.actorDragOffset);
  const presentMode = useBlueprintStore((s) => s.presentMode);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const didDrag = useRef(false);
  const threshold = height * 0.5;

  const onDivMouseDown = useCallback((e: React.MouseEvent) => {
    if (presentMode) return;
    e.stopPropagation();
    dragStartY.current = e.clientY;
    didDrag.current = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartY.current;
      setActorDragOffset({ actorId: actor.id, offsetY: delta });
      if (delta > threshold) {
        didDrag.current = true;
        moveActor(actor.id, 'down');
        dragStartY.current = ev.clientY;
        setActorDragOffset({ actorId: actor.id, offsetY: 0 });
      } else if (delta < -threshold) {
        didDrag.current = true;
        moveActor(actor.id, 'up');
        dragStartY.current = ev.clientY;
        setActorDragOffset({ actorId: actor.id, offsetY: 0 });
      }
    };

    const onUp = () => {
      setDragging(false);
      setActorDragOffset(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [actor.id, moveActor, setActorDragOffset, threshold, presentMode]);

  const showGrip = hovered || dragging;

  return (
    <div
      onClick={() => { if (!presentMode && !didDrag.current) setSelectedActor(actor.id); }}
      onMouseEnter={() => { if (!actorDragOffset) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onDivMouseDown}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        background: hovered ? `${actor.color}0A` : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        borderRight: `2px solid ${hovered ? actor.color + '55' : 'transparent'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        paddingLeft: 28,
        paddingRight: 'var(--space-3)',
        userSelect: 'none',
        cursor: dragging ? 'grabbing' : 'pointer',
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
        position: 'relative',
      }}
    >
      {/* Drag grip — left side */}
      <div
        title="Drag to reorder actor"
        style={{
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          cursor: dragging ? 'grabbing' : 'grab',
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

      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: actor.color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: hovered ? actor.color : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: 'color var(--transition-fast)',
        }}
      >
        {actor.name}
      </span>
    </div>
  );
});
