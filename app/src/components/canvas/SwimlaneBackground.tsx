import { memo } from 'react';
import type { Blueprint } from '../../types/blueprint';
import {
  ACTOR_LABEL_WIDTH,
  PHASE_HEADER_HEIGHT,
  PHASE_WIDTH,
  ROW_HEIGHT as CELL_HEIGHT,
} from '../../lib/layout';

type Props = { blueprint: Blueprint };

export const SwimlaneBackground = memo(({ blueprint }: Props) => {
  const sortedActors = [...blueprint.actors].sort((a, b) => a.order - b.order);
  const sortedPhases = [...blueprint.phases].sort((a, b) => a.order - b.order);

  const totalWidth = ACTOR_LABEL_WIDTH + sortedPhases.length * PHASE_WIDTH;
  const totalHeight = PHASE_HEADER_HEIGHT + sortedActors.length * CELL_HEIGHT;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      width={totalWidth}
      height={totalHeight}
    >
      {/* Horizontal swimlane bands */}
      {sortedActors.map((actor, i) => (
        <rect
          key={actor.id}
          x={ACTOR_LABEL_WIDTH}
          y={PHASE_HEADER_HEIGHT + i * CELL_HEIGHT}
          width={sortedPhases.length * PHASE_WIDTH}
          height={CELL_HEIGHT}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(243,244,246,0.4)'}
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
        />
      ))}

      {/* Vertical phase dividers */}
      {sortedPhases.map((_, i) => (
        <line
          key={i}
          x1={ACTOR_LABEL_WIDTH + (i + 1) * PHASE_WIDTH}
          y1={PHASE_HEADER_HEIGHT}
          x2={ACTOR_LABEL_WIDTH + (i + 1) * PHASE_WIDTH}
          y2={totalHeight}
          stroke="var(--border-subtle)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      ))}

      {/* Actor color stripe on left */}
      {sortedActors.map((actor, i) => (
        <rect
          key={`stripe-${actor.id}`}
          x={ACTOR_LABEL_WIDTH}
          y={PHASE_HEADER_HEIGHT + i * CELL_HEIGHT}
          width={3}
          height={CELL_HEIGHT}
          fill={actor.color}
          opacity={0.4}
        />
      ))}
    </svg>
  );
});
