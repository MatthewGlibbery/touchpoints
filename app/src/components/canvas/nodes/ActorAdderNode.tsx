import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ACTOR_LABEL_WIDTH } from '../../../lib/layout';
import { useBlueprintStore } from '../../../store/blueprint.store';

export const ActorAdderNode = memo((_: NodeProps) => {
  const addActor = useBlueprintStore((s) => s.addActor);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => addActor('New actor')}
      style={{
        width: ACTOR_LABEL_WIDTH,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        border: `1px dashed ${hovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        background: hovered ? 'var(--surface-bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontSize: 12,
        fontWeight: 500,
        transition: 'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
        userSelect: 'none',
      }}
    >
      <Plus size={12} />
      Add actor
    </div>
  );
});
