import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

type SwimlaneData = { color: string; width: number; height: number; even: boolean };

export const SwimlaneNode = memo(({ data }: NodeProps) => {
  const { width, height } = data as SwimlaneData;

  return (
    <div
      style={{
        width,
        height,
        background: 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    />
  );
});
