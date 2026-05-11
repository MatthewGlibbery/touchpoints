import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';
import type { PainPoint } from '../../../types/blueprint';

type PainPointData = { painPoint: PainPoint };

const severityColor: Record<PainPoint['severity'], { bg: string; color: string; border: string }> = {
  low: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  medium: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  high: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
};

export const PainPointNode = memo(({ data }: NodeProps) => {
  const { painPoint } = data as PainPointData;
  const colors = severityColor[painPoint.severity];

  return (
    <div
      style={{
        maxWidth: 200,
        padding: '3px 8px',
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
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
      <AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{painPoint.description}</span>
    </div>
  );
});
