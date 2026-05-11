import { memo } from 'react';
import { Lightbulb } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import type { Opportunity } from '../../../types/blueprint';

type OpportunityData = { opportunity: Opportunity };

export const OpportunityNode = memo(({ data }: NodeProps) => {
  const { opportunity } = data as OpportunityData;

  return (
    <div
      style={{
        maxWidth: 200,
        padding: '3px 8px',
        background: 'var(--accent-success-soft)',
        color: 'var(--accent-success)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        opacity: 0.9,
      }}
    >
      <Lightbulb size={10} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{opportunity.description}</span>
    </div>
  );
});
