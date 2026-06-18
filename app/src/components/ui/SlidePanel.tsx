import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Play, X, Check, Columns2, PanelLeft, Eye } from 'lucide-react';
import type { Node } from '@xyflow/react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { captureViewport, animateToViewport } from '../../lib/viewportBridge';
import { blueprintToFlow, getBlueprintForVersion } from '../../lib/layout';
import type { Blueprint, PresentationKeyframe } from '../../types/blueprint';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

// ─── Thumbnail canvas ─────────────────────────────────────────────────────────

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: Node[],
  bounds: { minX: number; minY: number; scale: number },
  clipX: number, _clipW: number,
  theme: string,
) {
  const { minX, minY, scale } = bounds;
  const PAD = 6;
  const sx = (wx: number) => clipX + PAD + (wx - minX) * scale;
  const sy = (wy: number) => PAD + (wy - minY) * scale;

  for (const n of nodes) {
    const nw = ((n.type === 'swimlane' ? (n.data as any).width : n.width) ?? 220) as number;
    const nh = ((n.type === 'swimlane' ? (n.data as any).height : n.height) ?? 140) as number;
    const px = sx(n.position.x);
    const py = sy(n.position.y);
    const pw = nw * scale;
    const ph = nh * scale;

    if (n.type === 'swimlane') {
      ctx.fillStyle = theme === 'dark' ? 'rgba(35,40,52,0.9)' : 'rgba(215,220,230,0.7)';
      ctx.fillRect(px, py, pw, ph);
    } else if (n.type === 'action') {
      const color = (n.data as any).actorColor ?? '#3B82F6';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.roundRect(px, py, Math.max(pw, 2), Math.max(ph, 2), 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function computeBounds(nodes: Node[], W: number, H: number) {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const nw = ((n.type === 'swimlane' ? (n.data as any).width : n.width) ?? 220) as number;
    const nh = ((n.type === 'swimlane' ? (n.data as any).height : n.height) ?? 140) as number;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + nw);
    maxY = Math.max(maxY, n.position.y + nh);
  }
  const PAD = 6;
  const scale = Math.min((W - PAD * 2) / (maxX - minX || 1), (H - PAD * 2) / (maxY - minY || 1));
  return { minX, minY, maxX, maxY, scale };
}

function drawViewportRect(
  ctx: CanvasRenderingContext2D,
  vp: { x: number; y: number; zoom: number },
  bounds: { minX: number; minY: number; scale: number },
  clipX: number, H: number,
) {
  const { minX, minY, scale } = bounds;
  const PAD = 6;
  const DISP_W = 1400, DISP_H = 900;
  const flowLeft   = -vp.x / vp.zoom;
  const flowTop    = -vp.y / vp.zoom;
  const flowRight  = flowLeft + DISP_W / vp.zoom;
  const flowBottom = flowTop  + DISP_H / vp.zoom;

  const rx = clipX + PAD + (flowLeft  - minX) * scale;
  const ry =         PAD + (flowTop   - minY) * scale;
  const rw = (flowRight  - flowLeft)  * scale;
  const rh = (flowBottom - flowTop)   * scale;

  // Clamp to avoid drawing outside valid area
  const clampedRx = Math.max(clipX, rx);
  const clampedRy = Math.max(0, ry);
  const clampedRw = Math.min(rw - (clampedRx - rx), clipX + (H * 16 / 9) - clampedRx);
  const clampedRh = Math.min(rh - (clampedRy - ry), H - clampedRy);

  if (clampedRw <= 0 || clampedRh <= 0) return;

  ctx.fillStyle = '#3B82F6';
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.roundRect(clampedRx, clampedRy, clampedRw, clampedRh, 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(clampedRx, clampedRy, clampedRw, clampedRh, 2);
  ctx.stroke();
}

function KeyframeThumbnail({
  keyframe,
  blueprint,
  theme,
  active,
}: {
  keyframe: PresentationKeyframe;
  blueprint: Blueprint;
  theme: string;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { primaryNodes, leftNodes, rightNodes } = useMemo(() => {
    if (keyframe.compareMode) {
      const [v0, v1] = keyframe.compareVersionIds ?? [null, null];
      return {
        primaryNodes: [],
        leftNodes:  blueprintToFlow(getBlueprintForVersion(blueprint, v0)).nodes,
        rightNodes: blueprintToFlow(getBlueprintForVersion(blueprint, v1)).nodes,
      };
    }
    return {
      primaryNodes: blueprintToFlow(getBlueprintForVersion(blueprint, keyframe.versionId ?? null)).nodes,
      leftNodes: [],
      rightNodes: [],
    };
  }, [keyframe, blueprint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = theme === 'dark' ? '#111318' : '#F5F6F8';
    ctx.fillRect(0, 0, W, H);

    if (keyframe.compareMode) {
      // Split view: left half / right half
      const half = W / 2;

      // Divider
      ctx.fillStyle = theme === 'dark' ? '#2B303B' : '#D1D5DB';
      ctx.fillRect(half - 0.5, 0, 1, H);

      const allNodes = [...leftNodes, ...rightNodes];
      const bounds = computeBounds(allNodes, half, H);
      if (!bounds) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, half, H);
      ctx.clip();
      drawNodes(ctx, leftNodes, bounds, 0, half, theme);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(half, 0, half, H);
      ctx.clip();
      drawNodes(ctx, rightNodes, bounds, half, half, theme);
      ctx.restore();

      // No viewport rect for compare mode
    } else {
      const bounds = computeBounds(primaryNodes, W, H);
      if (!bounds) return;
      drawNodes(ctx, primaryNodes, bounds, 0, W, theme);
      drawViewportRect(ctx, keyframe.viewport, bounds, 0, H);
    }
  }, [keyframe, primaryNodes, leftNodes, rightNodes, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={156}
      height={88}
      style={{
        display: 'block',
        borderRadius: 6,
        border: `2px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        boxSizing: 'border-box',
      }}
    />
  );
}

// ─── State badges ─────────────────────────────────────────────────────────────

const VIEW_COLORS: Record<string, string> = {
  'pain-points':   '#EF4444',
  'opportunities': '#22C55E',
  'questions':     '#F59E0B',
};

const VIEW_LABELS: Record<string, string> = {
  'pain-points':   'Pains',
  'opportunities': 'Opps',
  'questions':     'Q&A',
};

function KeyframeBadges({ keyframe, blueprint }: { keyframe: PresentationKeyframe; blueprint: Blueprint }) {
  const versions = blueprint.versions ?? [];
  const versionName = keyframe.versionId
    ? (versions.find((v) => v.id === keyframe.versionId)?.name ?? 'Version')
    : 'Current';

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      {/* Version badge — only show if not base */}
      {keyframe.versionId && (
        <span style={badgeStyle('var(--accent-primary)', '#fff')}>
          {versionName}
        </span>
      )}

      {/* Compare mode */}
      {keyframe.compareMode && (
        <span style={badgeStyle('#6366F1', '#fff')}>
          <Columns2 size={9} style={{ marginRight: 2 }} />Compare
        </span>
      )}

      {/* Canvas view filter */}
      {keyframe.canvasView && keyframe.canvasView !== 'edit' && (
        <span style={badgeStyle(VIEW_COLORS[keyframe.canvasView], '#fff')}>
          <Eye size={9} style={{ marginRight: 2 }} />
          {VIEW_LABELS[keyframe.canvasView]}
        </span>
      )}

      {/* Inspector open */}
      {keyframe.selectedNodeId && (
        <span style={badgeStyle('var(--text-muted)', 'var(--surface-bg)')}>
          <PanelLeft size={9} style={{ marginRight: 2 }} />Panel
        </span>
      )}
    </div>
  );
}

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 9, fontWeight: 600, padding: '2px 5px',
    borderRadius: 4, background: bg, color,
    whiteSpace: 'nowrap',
  };
}

// ─── Keyframe card ────────────────────────────────────────────────────────────

function KeyframeCard({
  keyframe, index, total, blueprint, theme, presentationId,
  isActive, isDragOver, onDragStart, onDragOver, onDrop,
}: {
  keyframe: PresentationKeyframe;
  index: number;
  total: number;
  blueprint: Blueprint;
  theme: string;
  presentationId: string;
  isActive: boolean;
  isDragOver: boolean;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
}) {
  const removeKeyframe         = useBlueprintStore((s) => s.removeKeyframe);
  const updateKeyframe         = useBlueprintStore((s) => s.updateKeyframe);
  const applyKeyframeState     = useBlueprintStore((s) => s.applyKeyframeState);
  const setCurrentKeyframeIndex = useBlueprintStore((s) => s.setCurrentKeyframeIndex);

  const [editingLabel, setEditingLabel]     = useState(false);
  const [labelDraft, setLabelDraft]         = useState(keyframe.label ?? '');
  const [hovered, setHovered]               = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  const commitLabel = () => {
    updateKeyframe(presentationId, keyframe.id, { label: labelDraft.trim() || undefined });
    setEditingLabel(false);
  };

  const jumpToKeyframe = () => {
    setCurrentKeyframeIndex(index);
    applyKeyframeState(keyframe);
    if (!keyframe.compareMode) animateToViewport(keyframe.viewport);
  };

  const startPresent = () => {
    setCurrentKeyframeIndex(index);
    applyKeyframeState(keyframe);
    useBlueprintStore.setState({ presentMode: true, presentationEditMode: false });
    if (!keyframe.compareMode) {
      setTimeout(() => animateToViewport(keyframe.viewport, 500), 50);
    }
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', flexShrink: 0, width: 156,
        cursor: 'grab', opacity: isDragOver ? 0.5 : 1, transition: 'opacity 0.15s',
      }}
    >
      {isDragOver && (
        <div style={{
          position: 'absolute', left: -3, top: 0, bottom: 0, width: 3,
          background: 'var(--accent-primary)', borderRadius: 2, zIndex: 2,
        }} />
      )}

      <div onClick={jumpToKeyframe} style={{ cursor: 'pointer' }}>
        <KeyframeThumbnail keyframe={keyframe} blueprint={blueprint} theme={theme} active={isActive} />
      </div>

      {hovered && total > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          title="Delete slide"
          style={{
            position: 'absolute', top: 4, right: 4, width: 18, height: 18,
            borderRadius: '50%', background: 'var(--accent-danger)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', zIndex: 2,
          }}
        >
          <X size={10} />
        </button>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete slide"
          description={`Delete slide ${index + 1}${keyframe.label ? ` ("${keyframe.label}")` : ''}? This cannot be undone.`}
          onConfirm={() => { removeKeyframe(presentationId, keyframe.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); startPresent(); }}
          title="Present from this slide"
          style={{
            position: 'absolute', top: 4, left: 4, width: 18, height: 18,
            borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', zIndex: 2,
          }}
        >
          <Play size={9} style={{ marginLeft: 1 }} />
        </button>
      )}

      {/* Index + label */}
      <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 14 }}>
          {index + 1}
        </span>
        {editingLabel ? (
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
            style={{
              fontSize: 11, color: 'var(--text-primary)', background: 'var(--surface-bg-muted)',
              border: '1px solid var(--accent-primary)', borderRadius: 4,
              padding: '1px 4px', width: '100%', outline: 'none',
            }}
            autoFocus
          />
        ) : (
          <span
            onClick={() => { setLabelDraft(keyframe.label ?? ''); setEditingLabel(true); }}
            style={{
              fontSize: 11, color: 'var(--text-secondary)', cursor: 'text',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 120, flex: 1,
            }}
            title="Click to rename"
          >
            {keyframe.label || 'Slide'}
          </span>
        )}
      </div>

      <KeyframeBadges keyframe={keyframe} blueprint={blueprint} />
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SlidePanel() {
  const blueprint              = useBlueprintStore((s) => s.blueprint);
  const theme                  = useBlueprintStore((s) => s.theme);
  const activePresId           = useBlueprintStore((s) => s.activePresentationId);
  const currentKfIdx           = useBlueprintStore((s) => s.currentKeyframeIndex);
  const addKeyframe            = useBlueprintStore((s) => s.addKeyframe);
  const reorderKeyframes       = useBlueprintStore((s) => s.reorderKeyframes);
  const createPresentation     = useBlueprintStore((s) => s.createPresentation);
  const deletePresentation     = useBlueprintStore((s) => s.deletePresentation);
  const renamePresentation     = useBlueprintStore((s) => s.renamePresentation);
  const setActivePresentationId = useBlueprintStore((s) => s.setActivePresentationId);
  const setPresentationEditMode = useBlueprintStore((s) => s.setPresentationEditMode);
  const setCurrentKeyframeIndex = useBlueprintStore((s) => s.setCurrentKeyframeIndex);

  const presentations   = blueprint?.presentations ?? [];
  const activePresentation = presentations.find((p) => p.id === activePresId) ?? presentations[0] ?? null;
  const keyframes       = activePresentation?.keyframes ?? [];

  const [editingName, setEditingName]           = useState(false);
  const [nameDraft, setNameDraft]               = useState('');
  const [dragFromIdx, setDragFromIdx]           = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx]           = useState<number | null>(null);
  const [addingPresentation, setAddingPresentation] = useState(false);
  const [newPresName, setNewPresName]           = useState('');
  const [confirmDeletePresId, setConfirmDeletePresId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const commitName = () => {
    if (activePresentation && nameDraft.trim()) renamePresentation(activePresentation.id, nameDraft.trim());
    setEditingName(false);
  };

  const handleAddSlide = () => {
    if (!activePresentation) return;
    const { activeVersionId, canvasView, selectedNodeId, inspectorOpen, compareMode, compareVersionIds, overviewMode, multiSelectedNodeIds } =
      useBlueprintStore.getState();

    const viewport = compareMode
      ? { x: 0, y: 0, zoom: 0.8 }
      : (captureViewport() ?? { x: 0, y: 0, zoom: 1 });

    addKeyframe(activePresentation.id, {
      viewport,
      versionId:         compareMode ? null : (activeVersionId ?? null),
      canvasView:        (!compareMode && canvasView !== 'edit') ? canvasView : undefined,
      selectedNodeId:    (!compareMode && inspectorOpen && selectedNodeId) ? selectedNodeId : undefined,
      compareMode:       compareMode || undefined,
      compareVersionIds: compareMode ? compareVersionIds : undefined,
      overviewMode:      overviewMode || undefined,
      multiSelectedNodeIds: multiSelectedNodeIds.length > 0 ? multiSelectedNodeIds : undefined,
    });

    requestAnimationFrame(() => {
      if (stripRef.current) stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    });
  };

  const handlePlay = () => {
    if (!activePresentation || keyframes.length === 0) return;
    const kf = keyframes[currentKfIdx] ?? keyframes[0];
    useBlueprintStore.setState({ presentMode: true, presentationEditMode: false });
    if (!kf.compareMode) setTimeout(() => animateToViewport(kf.viewport, 500), 50);
  };

  // Drag reorder
  const handleDragStart = (idx: number) => setDragFromIdx(idx);
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragFromIdx !== null && activePresentation && dragFromIdx !== toIdx) {
      reorderKeyframes(activePresentation.id, dragFromIdx, toIdx);
      setCurrentKeyframeIndex(toIdx);
    }
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  if (!blueprint) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(calc(100vw - 48px), 920px)',
      background: 'var(--surface-bg)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      zIndex: 55,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Presentation pills */}
        <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {presentations.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActivePresentationId(p.id); setCurrentKeyframeIndex(0); }}
              style={{
                flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                fontWeight: p.id === activePresId ? 600 : 400,
                color: p.id === activePresId ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: p.id === activePresId ? 'var(--surface-bg-muted)' : 'transparent',
                border: '1px solid ' + (p.id === activePresId ? 'var(--border-strong)' : 'transparent'),
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {editingName && p.id === activePresId ? (
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 12, fontWeight: 600, width: Math.max(60, nameDraft.length * 8),
                    border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              ) : (
                <span onDoubleClick={(e) => { e.stopPropagation(); setNameDraft(p.name); setEditingName(true); }}>
                  {p.name}
                </span>
              )}
              {presentations.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); setConfirmDeletePresId(p.id); }}
                  style={{ color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 2, lineHeight: 1 }}
                >
                  <X size={10} />
                </span>
              )}
            </button>
          ))}

          {addingPresentation ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={newPresName}
                onChange={(e) => setNewPresName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPresName.trim()) {
                    createPresentation(newPresName.trim());
                    setNewPresName(''); setAddingPresentation(false);
                  }
                  if (e.key === 'Escape') { setAddingPresentation(false); setNewPresName(''); }
                }}
                placeholder="Name…"
                style={{
                  fontSize: 12, border: '1px solid var(--accent-primary)', borderRadius: 6,
                  padding: '2px 8px', background: 'var(--surface-bg)', color: 'var(--text-primary)',
                  outline: 'none', width: 100,
                }}
                autoFocus
              />
              <button
                onClick={() => { if (newPresName.trim()) { createPresentation(newPresName.trim()); setNewPresName(''); setAddingPresentation(false); } }}
                style={{ color: 'var(--accent-success)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingPresentation(true)}
              title="Add presentation"
              style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '1px dashed var(--border-strong)',
                background: 'transparent', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleAddSlide}
            disabled={!activePresentation}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 500,
              background: 'var(--surface-bg-muted)', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)', cursor: 'pointer',
              opacity: !activePresentation ? 0.4 : 1,
            }}
          >
            <Plus size={12} />
            Add slide
          </button>

          <button
            onClick={handlePlay}
            disabled={!activePresentation || keyframes.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px',
              borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600,
              background: 'var(--accent-primary)', color: '#fff',
              border: 'none', cursor: 'pointer',
              opacity: (!activePresentation || keyframes.length === 0) ? 0.4 : 1,
            }}
          >
            <Play size={11} style={{ marginLeft: 1 }} />
            Play
          </button>

          <button
            onClick={() => setPresentationEditMode(false)}
            title="Close slide editor"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {confirmDeletePresId && (() => {
        const presName = presentations.find((p) => p.id === confirmDeletePresId)?.name ?? '';
        return (
          <ConfirmDeleteModal
            title={`Delete "${presName}"`}
            description="This presentation and all its slides will be permanently removed."
            onConfirm={() => { deletePresentation(confirmDeletePresId); setConfirmDeletePresId(null); }}
            onCancel={() => setConfirmDeletePresId(null)}
          />
        );
      })()}

      {/* Keyframe strip */}
      <div
        ref={stripRef}
        onDragEnd={() => { setDragFromIdx(null); setDragOverIdx(null); }}
        style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '14px 16px', overflowX: 'auto', minHeight: 140,
        }}
      >
        {keyframes.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13, minHeight: 100,
          }}>
            Pan, zoom, or set up a view — then click <strong style={{ margin: '0 4px' }}>Add slide</strong> to capture it
          </div>
        ) : keyframes.map((kf, idx) => (
          <KeyframeCard
            key={kf.id}
            keyframe={kf}
            index={idx}
            total={keyframes.length}
            blueprint={blueprint}
            theme={theme}
            presentationId={activePresentation!.id}
            isActive={idx === currentKfIdx}
            isDragOver={dragOverIdx === idx && dragFromIdx !== idx}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
