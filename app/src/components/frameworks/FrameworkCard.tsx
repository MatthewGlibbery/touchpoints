import { memo } from 'react';
import { AlertTriangle, Lightbulb, HelpCircle } from 'lucide-react';
import type { PainPoint, Opportunity, Question } from '../../types/blueprint';

export type CardItem =
  | { type: 'pain'; item: PainPoint }
  | { type: 'opportunity'; item: Opportunity }
  | { type: 'question'; item: Question };

const typeStyles = {
  pain: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    color: 'var(--accent-danger)',
    icon: AlertTriangle,
  },
  opportunity: {
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    color: 'var(--accent-success)',
    icon: Lightbulb,
  },
  question: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    color: 'var(--accent-warning)',
    icon: HelpCircle,
  },
};

export function getCardText(card: CardItem): string {
  if (card.type === 'question') return card.item.text;
  return card.item.description;
}

export function getCardId(card: CardItem): string {
  return card.item.id;
}

export const FrameworkCard = memo(function FrameworkCard({
  card,
  compact,
  draggable = true,
  onDragStart,
  style: extraStyle,
}: {
  card: CardItem;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
}) {
  const s = typeStyles[card.type];
  const Icon = s.icon;
  const text = getCardText(card);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      style={{
        padding: compact ? '4px 8px' : '8px 12px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: compact ? 11 : 12,
        fontWeight: 500,
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        cursor: draggable ? 'grab' : 'default',
        maxWidth: compact ? 160 : 220,
        userSelect: 'none',
        ...extraStyle,
      }}
    >
      <Icon size={compact ? 10 : 12} color={s.color} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: compact ? 1 : 3 }}>
        {text}
      </span>
    </div>
  );
});
