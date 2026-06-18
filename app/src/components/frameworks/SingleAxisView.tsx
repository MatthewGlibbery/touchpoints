import { useState, useCallback } from 'react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { FrameworkCard, getCardId, type CardItem } from './FrameworkCard';
import type { FrameworkAxis } from '../../types/blueprint';

const SNAP_POINTS = 10;

export function SingleAxisView({
  axis,
  cards,
}: {
  axis: FrameworkAxis;
  cards: CardItem[];
}) {
  const setCardAxisPosition = useBlueprintStore((s) => s.setCardAxisPosition);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  // Group cards by their position on this axis
  const slotCards = new Map<number, CardItem[]>();
  for (let i = 0; i < SNAP_POINTS; i++) slotCards.set(i, []);

  for (const card of cards) {
    const pos = (axis.cardPositions ?? {})[getCardId(card)];
    if (pos !== undefined) {
      slotCards.get(pos)?.push(card);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent, slotIdx: number) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      setCardAxisPosition(axis.id, cardId, slotIdx);
    }
    setDragOverSlot(null);
  }, [axis.id, setCardAxisPosition]);

  const handleDragOver = useCallback((e: React.DragEvent, slotIdx: number) => {
    e.preventDefault();
    setDragOverSlot(slotIdx);
  }, []);

  const MAX_VISIBLE = 3;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 40px 60px', overflow: 'auto' }}>
      {/* Axis title */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{axis.title}</h3>
      </div>

      {/* Axis visual */}
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Axis line */}
        <div style={{ position: 'relative', height: 2, background: 'var(--border-strong)', borderRadius: 1, marginTop: 200 }}>
          {/* End labels */}
          <span style={{ position: 'absolute', left: 0, top: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            {axis.lowLabel}
          </span>
          <span style={{ position: 'absolute', right: 0, top: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            {axis.highLabel}
          </span>
        </div>

        {/* Snap slots */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, height: 220 }}>
          {Array.from({ length: SNAP_POINTS }, (_, i) => {
            const slotItems = slotCards.get(i) ?? [];
            const isOver = dragOverSlot === i;
            const isExpanded = expandedSlot === i;
            const visibleItems = isExpanded ? slotItems : slotItems.slice(0, MAX_VISIBLE);
            const hiddenCount = slotItems.length - MAX_VISIBLE;

            return (
              <div
                key={i}
                onDrop={(e) => handleDrop(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={() => setDragOverSlot(null)}
                onMouseEnter={() => { if (slotItems.length > MAX_VISIBLE) setExpandedSlot(i); }}
                onMouseLeave={() => setExpandedSlot(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: 12,
                  position: 'relative',
                  borderRadius: 'var(--radius-sm)',
                  background: isOver ? 'var(--accent-primary-soft)' : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                {/* Tick mark */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 1,
                  height: 8,
                  background: 'var(--border-strong)',
                }} />

                {/* Slot number */}
                <div style={{
                  position: 'absolute',
                  bottom: -24,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                  {i + 1}
                </div>

                {/* Stacked cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', maxHeight: isExpanded ? 'none' : 180, overflow: isExpanded ? 'visible' : 'hidden' }}>
                  {visibleItems.map((card) => (
                    <FrameworkCard
                      key={getCardId(card)}
                      card={card}
                      compact
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', getCardId(card));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                    />
                  ))}
                  {!isExpanded && hiddenCount > 0 && (
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-bg-muted)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>
                      +{hiddenCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
