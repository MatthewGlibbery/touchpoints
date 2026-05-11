import { memo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { PHASE_HEADER_HEIGHT } from '../../../lib/layout';

export const PhaseAdderNode = memo(() => {
  const addPhase = useBlueprintStore((s) => s.addPhase);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const [hovered, setHovered] = useState(false);

  if (presentMode) return null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => addPhase('New Phase')}
      style={{
        height: PHASE_HEADER_HEIGHT - 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 14px',
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--surface-bg)' : 'transparent',
        border: `2px dashed ${hovered ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
        color: hovered ? 'var(--accent-primary)' : 'var(--text-muted)',
        transition: 'all var(--transition-fast)',
        whiteSpace: 'nowrap',
      }}
    >
      <Plus size={14} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Add phase</span>
    </div>
  );
});
