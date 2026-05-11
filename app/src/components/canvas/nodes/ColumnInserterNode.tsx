import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useBlueprintStore } from '../../../store/blueprint.store';

type ColumnInserterData = {
  phaseId: string;
  atOrder: number;
  canvasHeight: number;
  lineStart: number;
  lineEnd: number;
};

export const ColumnInserterNode = memo(({ data }: NodeProps) => {
  const { phaseId, atOrder, canvasHeight, lineStart, lineEnd } = data as ColumnInserterData;
  const insertSubstep = useBlueprintStore((s) => s.insertSubstep);
  const dragOverInserterId = useBlueprintStore((s) => s.dragOverInserterId);
  const [hovered, setHovered] = useState(false);

  const isDragNearby = dragOverInserterId === `inserter-${phaseId}-${atOrder}`;

  const active = hovered || isDragNearby;

  const lineHeight = Math.max(0, lineEnd - lineStart);
  const midY = lineStart + lineHeight / 2;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => insertSubstep(phaseId, atOrder)}
      style={{
        width: 24,
        height: canvasHeight,
        position: 'relative',
        cursor: 'pointer',
        zIndex: 20,
      }}
    >
      {/* Vertical guide line — spans from lineStart to lineEnd */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: lineStart,
          height: lineHeight,
          width: active ? 2 : 1,
          background: 'var(--accent-primary)',
          opacity: active ? 0.6 : 0,
          transition: 'opacity var(--transition-fast), width var(--transition-fast)',
          borderRadius: 1,
        }}
      />

      {/* + circle at vertical midpoint of the line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: midY,
          transform: 'translate(-50%, -50%)',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: active ? 'var(--accent-primary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          opacity: active ? 1 : 0,
          transition: 'background var(--transition-fast), opacity var(--transition-fast)',
          flexShrink: 0,
        }}
      >
        <Plus size={11} />
      </div>
    </div>
  );
});
