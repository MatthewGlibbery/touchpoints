import { useState } from 'react';
import { AlertTriangle, Lightbulb, HelpCircle, Filter } from 'lucide-react';
import { FrameworkCard, getCardId, type CardItem } from './FrameworkCard';
import type { FrameworkAxis } from '../../types/blueprint';

type TypeFilter = 'pain' | 'opportunity' | 'question';
type SeverityFilter = 'low' | 'medium' | 'high';

export function CardDugout({
  cards,
  axes,
}: {
  cards: CardItem[];
  /** The axis or axes currently being viewed. Cards placed on ALL of them are considered "placed". */
  axes: FrameworkAxis[];
}) {
  const [typeFilters, setTypeFilters] = useState<Set<TypeFilter>>(new Set(['pain', 'opportunity', 'question']));
  const [severityFilter, setSeverityFilter] = useState<Set<SeverityFilter>>(new Set(['low', 'medium', 'high']));
  const [showFilters, setShowFilters] = useState(false);

  // Find unplaced cards — a card is "placed" if it has a position on all active axes
  const unplacedCards = cards.filter((card) => {
    const id = getCardId(card);
    return !axes.every((axis) => (axis.cardPositions ?? {})[id] !== undefined);
  });

  // Apply filters
  const filteredCards = unplacedCards.filter((card) => {
    if (!typeFilters.has(card.type)) return false;
    if (card.type === 'pain' && !severityFilter.has(card.item.severity)) return false;
    return true;
  });

  const toggleType = (type: TypeFilter) => {
    const next = new Set(typeFilters);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (next.size > 0) setTypeFilters(next);
  };

  const toggleSeverity = (sev: SeverityFilter) => {
    const next = new Set(severityFilter);
    if (next.has(sev)) next.delete(sev);
    else next.add(sev);
    if (next.size > 0) setSeverityFilter(next);
  };

  const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 'var(--radius-pill)',
    border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
    background: active ? `${color}11` : 'transparent',
    color: active ? color : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.12s',
  });

  return (
    <div style={{
      width: 260,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--surface-bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Unplaced ({filteredCards.length})
          </span>
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: showFilters ? 'var(--accent-primary-soft)' : 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              color: showFilters ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <Filter size={14} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => toggleType('pain')} style={chipStyle(typeFilters.has('pain'), '#EF4444')}>
                <AlertTriangle size={10} style={{ marginRight: 3 }} />Pains
              </button>
              <button onClick={() => toggleType('opportunity')} style={chipStyle(typeFilters.has('opportunity'), '#22C55E')}>
                <Lightbulb size={10} style={{ marginRight: 3 }} />Opps
              </button>
              <button onClick={() => toggleType('question')} style={chipStyle(typeFilters.has('question'), '#F59E0B')}>
                <HelpCircle size={10} style={{ marginRight: 3 }} />Questions
              </button>
            </div>
            {typeFilters.has('pain') && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => toggleSeverity('low')} style={chipStyle(severityFilter.has('low'), '#C2410C')}>Low</button>
                <button onClick={() => toggleSeverity('medium')} style={chipStyle(severityFilter.has('medium'), '#92400E')}>Med</button>
                <button onClick={() => toggleSeverity('high')} style={chipStyle(severityFilter.has('high'), '#991B1B')}>High</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredCards.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            {unplacedCards.length === 0 ? 'All cards placed!' : 'No cards match filters'}
          </p>
        )}
        {filteredCards.map((card) => (
          <FrameworkCard
            key={getCardId(card)}
            card={card}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', getCardId(card));
              e.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}
      </div>
    </div>
  );
}
