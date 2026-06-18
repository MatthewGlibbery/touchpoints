import { useState, useCallback } from 'react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { FrameworkCard, getCardId, type CardItem } from './FrameworkCard';
import type { FrameworkAxis } from '../../types/blueprint';

const SNAP_POINTS = 10;

export function DualAxisView({
  axes,
  cards,
}: {
  axes: [FrameworkAxis, FrameworkAxis];
  cards: CardItem[];
}) {
  const setCardAxisPosition = useBlueprintStore((s) => s.setCardAxisPosition);
  const [dragOverCell, setDragOverCell] = useState<{ x: number; y: number } | null>(null);
  const [expandedCell, setExpandedCell] = useState<{ x: number; y: number } | null>(null);

  const [xAxis, yAxis] = axes;

  // Build grid: cards grouped by (x, y) position — read from each axis directly
  const grid = new Map<string, CardItem[]>();
  for (const card of cards) {
    const id = getCardId(card);
    const xPos = (xAxis.cardPositions ?? {})[id];
    const yPos = (yAxis.cardPositions ?? {})[id];
    if (xPos !== undefined && yPos !== undefined) {
      const key = `${xPos}-${yPos}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(card);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      setCardAxisPosition(xAxis.id, cardId, x);
      setCardAxisPosition(yAxis.id, cardId, y);
    }
    setDragOverCell(null);
  }, [xAxis.id, yAxis.id, setCardAxisPosition]);

  const MAX_VISIBLE = 2;

  // The axes cross in the middle: X runs left-right, Y runs bottom-top.
  // We render a 10x10 grid with the origin (0,0) at bottom-left, but the
  // visual center (where axes cross) is at position 4.5 (between slots 4 and 5).
  // Axis lines are drawn crossing through the center.

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 32px 52px 72px', overflow: 'auto' }}>
      <div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 500 }}>
        {/* Y-axis title (left, rotated) */}
        <div style={{
          position: 'absolute',
          left: -56,
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}>
          {yAxis.title}
        </div>

        {/* Y-axis end labels */}
        <div style={{ position: 'absolute', left: -44, top: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
          {yAxis.highLabel}
        </div>
        <div style={{ position: 'absolute', left: -44, bottom: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
          {yAxis.lowLabel}
        </div>

        {/* Grid area */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${SNAP_POINTS}, 1fr)`,
          gridTemplateRows: `repeat(${SNAP_POINTS}, 1fr)`,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-bg-muted)',
          overflow: 'visible',
          position: 'relative',
        }}>
          {/* Crossing axis lines */}
          {/* Horizontal axis (X) — at vertical center */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 2,
            background: 'var(--border-strong)',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
          {/* Vertical axis (Y) — at horizontal center */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 2,
            background: 'var(--border-strong)',
            zIndex: 1,
            pointerEvents: 'none',
          }} />

          {/* Grid cells: row 0 = top = high Y, so reverse Y */}
          {Array.from({ length: SNAP_POINTS }, (_, rowIdx) => {
            const y = SNAP_POINTS - 1 - rowIdx; // Y value (high at top)
            return Array.from({ length: SNAP_POINTS }, (_, x) => {
              const key = `${x}-${y}`;
              const cellCards = grid.get(key) ?? [];
              const isOver = dragOverCell?.x === x && dragOverCell?.y === y;
              const isExpanded = expandedCell?.x === x && expandedCell?.y === y;
              const visibleItems = isExpanded ? cellCards : cellCards.slice(0, MAX_VISIBLE);
              const hiddenCount = cellCards.length - MAX_VISIBLE;

              return (
                <div
                  key={key}
                  onDrop={(e) => handleDrop(e, x, y)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCell({ x, y }); }}
                  onDragLeave={() => setDragOverCell(null)}
                  onMouseEnter={() => { if (cellCards.length > MAX_VISIBLE) setExpandedCell({ x, y }); }}
                  onMouseLeave={() => setExpandedCell(null)}
                  style={{
                    borderRight: x < SNAP_POINTS - 1 ? '1px solid var(--border-subtle)' : undefined,
                    borderBottom: rowIdx < SNAP_POINTS - 1 ? '1px solid var(--border-subtle)' : undefined,
                    padding: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    minHeight: 54,
                    background: isOver ? 'var(--accent-primary-soft)' : 'transparent',
                    transition: 'background 0.12s',
                    position: 'relative',
                    overflow: isExpanded ? 'visible' : 'hidden',
                    zIndex: isExpanded ? 100 : undefined,
                  }}
                >
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
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-bg)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>
                      +{hiddenCount}
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>

        {/* X-axis title (bottom center) */}
        <div style={{
          position: 'absolute',
          bottom: -36,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          {xAxis.title}
        </div>

        {/* X-axis end labels */}
        <div style={{ position: 'absolute', bottom: -36, left: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
          {xAxis.lowLabel}
        </div>
        <div style={{ position: 'absolute', bottom: -36, right: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
          {xAxis.highLabel}
        </div>
      </div>
    </div>
  );
}
