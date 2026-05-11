import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { ACTION_NODE_WIDTH, ACTION_NODE_HEIGHT } from '../../../lib/layout';

type EmptyCellData = { actorId: string; phaseId: string; order: number; actorColor: string };

export const EmptyCellNode = memo(({ data }: NodeProps) => {
  const { actorId, phaseId, order, actorColor } = data as EmptyCellData;
  const addAction = useBlueprintStore((s) => s.addAction);
  const dragTarget = useBlueprintStore((s) => s.dragTarget);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const [hovered, setHovered] = useState(false);

  const isDragTarget =
    dragTarget?.actorId === actorId &&
    dragTarget?.phaseId === phaseId &&
    dragTarget?.order === order;

  const actor = blueprint?.actors.find((a) => a.id === actorId);
  const showDash = hovered || isDragTarget;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); addAction(actorId, phaseId, order); }}
      style={{
        width: ACTION_NODE_WIDTH,
        height: ACTION_NODE_HEIGHT,
        borderRadius: 'var(--radius-lg)',
        // Always render transparent dashed border so transition is color-only (no flash)
        border: `2px dashed ${showDash ? (isDragTarget ? actorColor : actorColor + '88') : 'transparent'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragTarget ? 'copy' : 'pointer',
        transition: 'border-color 0.12s, background 0.12s',
        background: showDash ? `${actorColor}0A` : 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          opacity: showDash ? 1 : 0,
          transition: 'opacity 0.12s',
          color: actorColor,
        }}
      >
        {isDragTarget ? (
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: actorColor,
            textAlign: 'center',
            lineHeight: 1.3,
          }}>
            Move to {actor?.name ?? 'here'}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={13} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              Add step to {actor?.name ?? 'here'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
