import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { Touchpoint } from '../../../types/blueprint';

type TouchpointData = { touchpoint: Touchpoint };

const typeIcon: Record<Touchpoint['type'], string> = {
  interface: '⬡',
  system: '⚙',
  human: '◎',
};

export const TouchpointNode = memo(({ data }: NodeProps) => {
  const { touchpoint } = data as TouchpointData;

  return (
    <div
      style={{
        padding: '3px 8px',
        background: 'var(--accent-primary-soft)',
        color: 'var(--accent-primary)',
        border: '1px solid var(--accent-primary)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        opacity: 0.85,
      }}
    >
      <span style={{ fontSize: 9 }}>{typeIcon[touchpoint.type]}</span>
      {touchpoint.label}
    </div>
  );
});
