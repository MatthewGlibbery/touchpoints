import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { GripHorizontal, GitBranch } from 'lucide-react';
import type { Phase } from '../../../types/blueprint';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { useCommentsStore } from '../../../store/comments.store';
import { PHASE_HEADER_HEIGHT } from '../../../lib/layout';
import { CommentBadge } from '../../ui/CommentBadge';

type PhaseHeaderData = { phase: Phase; width: number; colCount: number };
// colCount kept in data for layout reference; column selection now handled by ColumnOverlayNode

export const PhaseHeaderNode = memo(({ data }: NodeProps) => {
  const { phase, width } = data as PhaseHeaderData;
  const updatePhase = useBlueprintStore((s) => s.updatePhase);
  const movePhase = useBlueprintStore((s) => s.movePhase);
  const setPhaseDragOffset = useBlueprintStore((s) => s.setPhaseDragOffset);
  const setSelectedPhase = useBlueprintStore((s) => s.setSelectedPhase);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const openThread = useCommentsStore((s) => s.openThread);
  const headerRef = useRef<HTMLDivElement>(null);
  const headerCenterPos = useCallback((): { x: number; y: number } | null => {
    const el = headerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom };
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(phase.name);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);
  const threshold = width * 0.55;

  useEffect(() => { setDraft(phase.name); }, [phase.name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commitEdit = useCallback(() => {
    const v = draft.trim();
    if (v && v !== phase.name) updatePhase(phase.id, { name: v });
    else setDraft(phase.name);
    setEditing(false);
  }, [draft, phase.id, phase.name, updatePhase]);

  const onDivMouseDown = useCallback((e: React.MouseEvent) => {
    if (presentMode || editing || commentMode) return;
    e.stopPropagation();
    dragStartX.current = e.clientX;
    didDrag.current = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      setPhaseDragOffset({ phaseId: phase.id, offsetX: delta });
      if (delta > threshold) {
        movePhase(phase.id, 'right');
        dragStartX.current = ev.clientX;
        setPhaseDragOffset({ phaseId: phase.id, offsetX: 0 });
      } else if (delta < -threshold) {
        movePhase(phase.id, 'left');
        dragStartX.current = ev.clientX;
        setPhaseDragOffset({ phaseId: phase.id, offsetX: 0 });
      }
    };

    const onUp = () => {
      setDragging(false);
      setPhaseDragOffset(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [phase.id, movePhase, setPhaseDragOffset, threshold, presentMode, editing, commentMode]);

  const showGrip = (hovered || dragging) && !editing;

  return (
    <div
      ref={headerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onDivMouseDown}
      onClick={(e) => {
        if (presentMode || editing || didDrag.current) return;
        e.stopPropagation();
        if (commentMode) {
          openThread({ type: 'phase', id: phase.id }, headerCenterPos());
          return;
        }
        setSelectedPhase(phase.id);
      }}
      style={{
        width,
        height: PHASE_HEADER_HEIGHT,
        background: phase.conditional ? 'rgba(245,158,11,0.05)' : 'var(--surface-bg)',
        borderBottom: phase.conditional ? '2px dashed rgba(245,158,11,0.5)' : '2px solid var(--border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        userSelect: 'none',
        position: 'relative',
        cursor: dragging ? 'grabbing' : (editing ? 'text' : 'pointer'),
      }}
    >
      {/* Drag grip — visual affordance */}
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          cursor: dragging ? 'grabbing' : 'grab',
          color: 'var(--text-muted)',
          opacity: showGrip ? 1 : 0,
          transition: 'opacity var(--transition-fast)',
          display: 'flex',
          alignItems: 'center',
          padding: 4,
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        <GripHorizontal size={14} />
      </div>

      {phase.conditional && (
        <div style={{
          position: 'absolute',
          top: 5,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '1px 5px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 'var(--radius-pill)',
          fontSize: 9,
          fontWeight: 700,
          color: '#D97706',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}>
          <GitBranch size={8} />
          {phase.conditionLabel ? `IF: ${phase.conditionLabel}` : 'OPTIONAL'}
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') { setDraft(phase.name); setEditing(false); }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 6,
            padding: '2px 8px',
            outline: 'none',
            textAlign: 'center',
            width: Math.min(width - 60, 200),
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => { if (presentMode) return; e.stopPropagation(); setEditing(true); }}
          title="Double-click to rename"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            cursor: 'text',
            padding: '2px 4px',
            borderRadius: 4,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {phase.name}
        </span>
      )}

      {/* Comment badge — half-off the TOP, kept inside the right edge so it
          doesn't get clipped by the next phase header's wrapper. */}
      <CommentBadge
        anchor={{ type: 'phase', id: phase.id }}
        getAnchorPos={headerCenterPos}
        style={{ position: 'absolute', right: 8, top: -10, zIndex: 5 }}
      />
    </div>
  );
});
