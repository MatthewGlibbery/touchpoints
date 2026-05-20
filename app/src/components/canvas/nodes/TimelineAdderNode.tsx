import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ACTOR_LABEL_WIDTH } from '../../../lib/layout';
import { useBlueprintStore } from '../../../store/blueprint.store';

type Data = { height: number };

export const TimelineAdderNode = memo(({ data }: NodeProps) => {
  const { height } = data as Data;
  const addTimelineLane = useBlueprintStore((s) => s.addTimelineLane);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const [hovered, setHovered] = useState(false);

  const onAdd = () => {
    const count = (blueprint?.timelineLanes?.length ?? 0) + 1;
    addTimelineLane(`Timeline ${count}`);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onAdd}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        border: `1px dashed ${hovered ? 'var(--border-strong)' : 'transparent'}`,
        background: hovered ? 'var(--surface-bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontSize: 12,
        fontWeight: 500,
        opacity: hovered ? 1 : 0.6,
        transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast)',
        userSelect: 'none',
      }}
    >
      <Plus size={12} />
      Add timeline
    </div>
  );
});
