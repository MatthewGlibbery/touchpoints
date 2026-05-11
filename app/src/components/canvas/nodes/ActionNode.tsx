import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  User, Globe, Building2, Users, Activity,
  AlertCircle, Lightbulb, HelpCircle, Diamond,
} from 'lucide-react';
import type { Action } from '../../../types/blueprint';
import { useBlueprintStore } from '../../../store/blueprint.store';
import { ACTION_NODE_WIDTH, OVERVIEW_CARD_HEIGHT } from '../../../lib/layout';

type ActionNodeData = { action: Action; actorColor: string; actorOrder: number };

const ACTOR_ICONS = [User, Globe, Building2, Users];

const HIGHLIGHT_COLORS: Record<string, string> = {
  'pain-points':   'var(--accent-danger)',
  'opportunities': 'var(--accent-success)',
  'questions':     'var(--accent-warning)',
};

const HIGHLIGHT_SOFT: Record<string, string> = {
  'pain-points':   'rgba(239,68,68,0.22)',
  'opportunities': 'rgba(34,197,94,0.22)',
  'questions':     'rgba(245,158,11,0.22)',
};

const HIGHLIGHT_GLOW: Record<string, string> = {
  'pain-points':   '0 0 0 3px rgba(239,68,68,0.18)',
  'opportunities': '0 0 0 3px rgba(34,197,94,0.18)',
  'questions':     '0 0 0 3px rgba(245,158,11,0.18)',
};

export const ActionNode = memo(({ data }: NodeProps) => {
  const { action, actorColor, actorOrder } = data as ActionNodeData;
  const updateAction = useBlueprintStore((s) => s.updateAction);
  const setSelectedNode = useBlueprintStore((s) => s.setSelectedNode);
  const openInspectorToTab = useBlueprintStore((s) => s.openInspectorToTab);
  const animateToNode = useBlueprintStore((s) => s.animateToNode);
  const setSelectedOverviewCell = useBlueprintStore((s) => s.setSelectedOverviewCell);
  const setLightboxUrl = useBlueprintStore((s) => s.setLightboxUrl);
  const canvasView = useBlueprintStore((s) => s.canvasView);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const overviewMode = useBlueprintStore((s) => s.overviewMode);
  const selectedNodeId = useBlueprintStore((s) => s.selectedNodeId);
  const selected = selectedNodeId === action.id;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.label);
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const overviewInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const HANDLE_PROXIMITY = 18; // px from edge midpoint to reveal handle

  // Attach proximity tracking to the ReactFlow wrapper so handles don't
  // disappear when cursor moves from the card onto a handle element.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // Walk up from the inner card to find the outer ReactFlow node wrapper.
    // We must attach to the wrapper (not the card) so the listener fires even
    // when the cursor is on a handle element positioned outside the card bounds.
    let wrapper: HTMLElement | null = el.parentElement;
    while (wrapper && !wrapper.classList.contains('react-flow__node')) {
      wrapper = wrapper.parentElement;
    }
    if (!wrapper) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX;
      const my = e.clientY;
      const midTop    = { x: rect.left + rect.width / 2, y: rect.top };
      const midBottom = { x: rect.left + rect.width / 2, y: rect.bottom };
      const midLeft   = { x: rect.left,  y: rect.top + rect.height / 2 };
      const midRight  = { x: rect.right, y: rect.top + rect.height / 2 };
      const dist = (p: { x: number; y: number }) => Math.hypot(mx - p.x, my - p.y);
      const nearest = [
        { id: 'top',    d: dist(midTop) },
        { id: 'bottom', d: dist(midBottom) },
        { id: 'left',   d: dist(midLeft) },
        { id: 'right',  d: dist(midRight) },
      ].sort((a, b) => a.d - b.d)[0];
      if (nearest.d <= HANDLE_PROXIMITY) {
        wrapper!.setAttribute('data-handle-near', nearest.id);
      } else {
        wrapper!.removeAttribute('data-handle-near');
      }
    };

    const onLeave = () => wrapper!.removeAttribute('data-handle-near');

    wrapper.addEventListener('mousemove', onMove);
    wrapper.addEventListener('mouseleave', onLeave);
    return () => {
      wrapper!.removeEventListener('mousemove', onMove);
      wrapper!.removeEventListener('mouseleave', onLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setDraft(action.label); }, [action.label]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== action.label) updateAction(action.id, { label: trimmed });
    else setDraft(action.label);
    setEditing(false);
  }, [draft, action.id, action.label, updateAction]);

  const painCount = action.painPointIds.length;
  const oppCount = action.opportunityIds.length;
  const qCount = (action.questionIds ?? []).length;
  const isDecisionPoint = (action.tags ?? []).includes('decision-point');
  const hasBadges = painCount > 0 || oppCount > 0 || qCount > 0;

  const ActorIcon = ACTOR_ICONS[actorOrder % ACTOR_ICONS.length] ?? Activity;

  // View highlighting
  const isFiltered = canvasView !== 'edit';
  const isMatch =
    (canvasView === 'pain-points'   && painCount > 0) ||
    (canvasView === 'opportunities' && oppCount > 0)  ||
    (canvasView === 'questions'     && qCount > 0);
  const dimmed = isFiltered && !isMatch;
  const highlighted = isFiltered && isMatch;

  const hColor = HIGHLIGHT_COLORS[canvasView] ?? '';
  const hBg    = HIGHLIGHT_SOFT[canvasView]   ?? '';
  const hGlow  = HIGHLIGHT_GLOW[canvasView]   ?? '';

  const borderColor = selected
    ? 'var(--accent-primary)'
    : highlighted
    ? hColor
    : 'var(--border-subtle)';

  const borderWidth = selected || highlighted ? 2 : 1;

  const bgColor = selected
    ? `linear-gradient(rgba(59,130,246,0.12), rgba(59,130,246,0.12)), var(--surface-bg)`
    : highlighted
    ? `linear-gradient(${hBg}, ${hBg}), var(--surface-bg)`
    : 'var(--surface-bg)';

  const shadow = selected
    ? `0 0 0 4px rgba(59,130,246,0.12), var(--shadow-md)`
    : highlighted
    ? `${hGlow}, var(--shadow-md)`
    : 'var(--shadow-sm)';

  const firstMedia = action.media?.[0];

  // ─── Overview (semantic zoom) rendering ────────────────────────────────────
  if (overviewMode) {
    const overviewLabel = action.labelAbstract || action.label;
    const overviewBorder = selected ? 'var(--accent-primary)' : 'var(--border-subtle)';
    const overviewBorderW = selected ? 2 : 1;
    const overviewBg = selected
      ? `linear-gradient(rgba(59,130,246,0.12), rgba(59,130,246,0.12)), var(--surface-bg)`
      : highlighted
      ? `linear-gradient(${hBg}, ${hBg}), var(--surface-bg)`
      : 'var(--surface-bg)';
    const overviewShadow = selected
      ? `0 0 0 4px rgba(59,130,246,0.12), var(--shadow-md)`
      : highlighted
      ? `${hGlow}, var(--shadow-md)`
      : 'var(--shadow-sm)';

    return (
      <>
        <Handle id="left"   type="target" position={Position.Left}   style={handleStyle} />
        <Handle id="right"  type="source" position={Position.Right}  style={handleStyle} />
        <Handle id="top"    type="target" position={Position.Top}    style={handleStyle} />
        <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />
        <div
          ref={cardRef}
          className="action-drag-handle"
          onClick={() => { if (!presentMode && !editingOverview) setSelectedOverviewCell(action.actorId, action.phaseId, action.id); }}
          onDoubleClick={(e) => {
            if (presentMode) return;
            e.stopPropagation();
            setOverviewDraft(overviewLabel);
            setEditingOverview(true);
          }}
          style={{
            width: ACTION_NODE_WIDTH,
            height: OVERVIEW_CARD_HEIGHT,
            boxSizing: 'border-box',
            background: overviewBg,
            border: `${overviewBorderW}px solid ${highlighted ? hColor : overviewBorder}`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: overviewShadow,
            padding: '0 14px',
            overflow: 'hidden',
            cursor: presentMode ? 'default' : 'pointer',
            opacity: dimmed ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `${actorColor}18`,
              border: `1px solid ${actorColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ActorIcon size={13} color={actorColor} />
          </div>
          {editingOverview ? (
            <input
              ref={overviewInputRef}
              autoFocus
              value={overviewDraft}
              onChange={(e) => setOverviewDraft(e.target.value)}
              onBlur={() => {
                const v = overviewDraft.trim();
                if (v) updateAction(action.id, { labelAbstract: v });
                setEditingOverview(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditingOverview(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: 0,
                lineHeight: 1.35,
              }}
            />
          ) : (
            <p style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: 0,
              flex: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {overviewLabel}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Handle id="left"   type="target" position={Position.Left}   style={handleStyle} />
      <Handle id="right"  type="source" position={Position.Right}  style={handleStyle} />
      <Handle id="top"    type="target" position={Position.Top}    style={handleStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />

      <div
        ref={cardRef}
        className="action-drag-handle"
        data-selected={selected}
        style={{
          width: ACTION_NODE_WIDTH,
          background: bgColor,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 'var(--radius-lg)',
          boxShadow: shadow,
          padding: '14px',
          overflow: 'hidden',
          cursor: presentMode ? 'default' : 'grab',
          opacity: dimmed ? 0.3 : 1,
          transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s',
        }}
        onDoubleClick={(e) => { if (presentMode || overviewMode) return; e.stopPropagation(); setEditing(true); }}
        onClick={() => { if (!presentMode) { setSelectedNode(action.id); animateToNode(action.id); } }}
      >
        {/* Icon + label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${actorColor}18`,
              border: `1px solid ${actorColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ActorIcon size={15} color={actorColor} />
          </div>

          {isDecisionPoint && (
            <Diamond size={11} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
          )}
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') { setDraft(action.label); setEditing(false); }
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                padding: 0,
                lineHeight: 1.35,
              }}
            />
          ) : (
            <p style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              margin: 0,
              flex: 1,
            }}>
              {action.label}
            </p>
          )}
        </div>

        {/* Description */}
        {action.labelDetailed && (
          <p style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '8px 0 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {action.labelDetailed}
          </p>
        )}

        {/* Media preview — edge-to-edge */}
        {firstMedia && (
          <div
            style={{
              margin: hasBadges ? '8px -14px 0' : '8px -14px -14px',
              lineHeight: 0,
              cursor: firstMedia.type !== 'video' ? 'zoom-in' : undefined,
            }}
            onClick={(e) => {
              if (firstMedia.type !== 'video') {
                e.stopPropagation();
                setLightboxUrl(firstMedia.url);
              }
            }}
          >
            {firstMedia.type === 'video' ? (
              <video
                src={firstMedia.url}
                style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
                muted preload="metadata"
              />
            ) : (
              <img
                src={firstMedia.url}
                alt={firstMedia.caption ?? ''}
                style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>
        )}

        {/* Divider + badges — skip divider when media is present */}
        {hasBadges && (
          <>
            {!firstMedia && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px 0' }} />}
            {firstMedia && <div style={{ margin: '8px 0 0' }} />}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {painCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'pains'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <AlertCircle size={12} color="var(--accent-danger)" />
                  {painCount}
                </button>
              )}
              {oppCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'opportunities'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <Lightbulb size={12} color="var(--accent-success)" />
                  {oppCount}
                </button>
              )}
              {qCount > 0 && (
                <button
                  className="badge-pill"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openInspectorToTab(action.id, 'questions'); animateToNode(action.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <HelpCircle size={12} color="var(--accent-warning)" />
                  {qCount}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
});

const handleStyle: React.CSSProperties = { width: 12, height: 12 };
