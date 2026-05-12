import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Sparkles, Settings2, RefreshCw, Trash2, Plus,
  ChevronDown, Loader2, ImageOff, Film, Download, Play, X, ChevronLeft, ChevronRight,
  BookMarked,
} from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { buildImagePrompt } from '../../lib/storyboard';
import { loadPresets, savePreset, deletePreset } from '../../lib/styleLibrary';
import type { StylePreset } from '../../lib/styleLibrary';
import type { StoryboardStyleGuide, StoryboardFrame } from '../../types/blueprint';

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadFrameImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, '_blank');
  }
}

// ─── Journey Map Presenter overlay ────────────────────────────────────────────

function JourneyMapPresenter({
  frames,
  startIdx,
  onClose,
}: {
  frames: StoryboardFrame[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const frame = frames[idx];

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx((i) => Math.min(frames.length - 1, i + 1)), [frames.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onClose]);

  if (!frame) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
        }}
      >
        <X size={16} />
      </button>

      {/* Counter */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {idx + 1} / {frames.length}
      </div>

      {/* Image */}
      <div
        style={{
          maxWidth: '80vw',
          maxHeight: '70vh',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {frame.imageUrl ? (
          <img
            src={frame.imageUrl}
            alt=""
            style={{
              display: 'block',
              maxWidth: '80vw',
              maxHeight: '70vh',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              width: 640,
              height: 360,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-lg)',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            <ImageOff size={40} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Caption */}
      {frame.caption && (
        <p
          style={{
            marginTop: 24,
            maxWidth: 640,
            textAlign: 'center',
            fontSize: 16,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {frame.caption}
        </p>
      )}

      {/* Prev / Next */}
      <button
        onClick={prev}
        disabled={idx === 0}
        style={{
          position: 'absolute',
          left: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: idx === 0 ? 'not-allowed' : 'pointer',
          color: idx === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
          transition: 'background 0.15s',
        }}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        disabled={idx === frames.length - 1}
        style={{
          position: 'absolute',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: idx === frames.length - 1 ? 'not-allowed' : 'pointer',
          color: idx === frames.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff',
          transition: 'background 0.15s',
        }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function JourneyMapView() {
  const blueprint               = useBlueprintStore((s) => s.blueprint);
  const setStoryboardMode       = useBlueprintStore((s) => s.setStoryboardMode);
  const storyboards             = blueprint?.storyboards ?? [];
  const activeStoryboardId      = useBlueprintStore((s) => s.activeStoryboardId);
  const storyboardGenerating    = useBlueprintStore((s) => s.storyboardGenerating);
  const storyboardGeneratingFrameId = useBlueprintStore((s) => s.storyboardGeneratingFrameId);
  const generateStoryboard      = useBlueprintStore((s) => s.generateStoryboard);
  const createStoryboard        = useBlueprintStore((s) => s.createStoryboard);
  const deleteStoryboard        = useBlueprintStore((s) => s.deleteStoryboard);
  const setActiveStoryboard     = useBlueprintStore((s) => s.setActiveStoryboard);
  const updateStoryboardFrame   = useBlueprintStore((s) => s.updateStoryboardFrame);
  const updateStoryboardStyleGuide = useBlueprintStore((s) => s.updateStoryboardStyleGuide);
  const deleteStoryboardFrame   = useBlueprintStore((s) => s.deleteStoryboardFrame);
  const regenerateFrame         = useBlueprintStore((s) => s.regenerateFrame);
  const reorderStoryboardFrames = useBlueprintStore((s) => s.reorderStoryboardFrames);
  const regenerateAllFrames     = useBlueprintStore((s) => s.regenerateAllFrames);
  const setLightboxUrl          = useBlueprintStore((s) => s.setLightboxUrl);
  const isGuestView             = useBlueprintStore((s) => s.isGuestView);

  const activeStoryboard = storyboards.find((s) => s.id === activeStoryboardId) ?? storyboards[0] ?? null;
  const frames = activeStoryboard?.frames ?? [];

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(frames[0]?.id ?? null);
  const [showStyleGuide, setShowStyleGuide] = useState(false);
  const [showSbSelector, setShowSbSelector] = useState(false);
  const [newSbName, setNewSbName] = useState('');
  const [addingSb, setAddingSb] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  // Presentation state
  const [presenting, setPresenting] = useState(false);
  const [presentStartIdx, setPresentStartIdx] = useState(0);

  // Drag-to-reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const filmstripRef = useRef<HTMLDivElement>(null);
  // Auto-select first frame when frames load
  useEffect(() => {
    if (frames.length && !frames.find((f) => f.id === selectedFrameId)) {
      setSelectedFrameId(frames[0].id);
    }
  }, [frames, selectedFrameId]);

  const selectedFrame = frames.find((f) => f.id === selectedFrameId) ?? null;
  const generatingIdx = frames.findIndex((f) => f.id === storyboardGeneratingFrameId);

  const handleGenerate = async () => {
    await generateStoryboard();
    const sb = useBlueprintStore.getState().blueprint?.storyboards?.find(
      (s) => s.id === (useBlueprintStore.getState().activeStoryboardId ?? storyboards[0]?.id)
    );
    if (sb?.frames.length) setSelectedFrameId(sb.frames[0].id);
  };

  const handleCreateStoryboard = () => {
    const name = newSbName.trim() || `Journey Map ${storyboards.length + 1}`;
    createStoryboard(name);
    setAddingSb(false);
    setNewSbName('');
    setShowSbSelector(false);
  };

  const handleExportAll = async () => {
    const withImages = frames.filter((f) => f.imageUrl);
    if (!withImages.length) return;
    setExportingAll(true);
    for (let i = 0; i < withImages.length; i++) {
      const f = withImages[i];
      await downloadFrameImage(f.imageUrl!, `frame-${String(i + 1).padStart(2, '0')}.jpg`);
      if (i < withImages.length - 1) await new Promise((r) => setTimeout(r, 120));
    }
    setExportingAll(false);
  };

  const handlePresent = () => {
    const startIdx = frames.findIndex((f) => f.id === selectedFrameId);
    setPresentStartIdx(startIdx >= 0 ? startIdx : 0);
    setPresenting(true);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (idx: number) => setDragOverIdx(idx);
  const handleDrop = (toIdx: number) => {
    if (dragIdx !== null && dragIdx !== toIdx && activeStoryboard) {
      reorderStoryboardFrames(activeStoryboard.id, dragIdx, toIdx);
      const movedId = frames[dragIdx]?.id;
      if (movedId === selectedFrameId) setSelectedFrameId(movedId);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  if (!blueprint) return null;

  const framesWithImages = frames.filter((f) => f.imageUrl).length;

  return (
    <>
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas-bg)',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          height: 56,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-bg)',
          flexShrink: 0,
          zIndex: 10,
        }}>
          <button
            onClick={() => setStoryboardMode(false)}
            title="Back to blueprint"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            <ArrowLeft size={14} />
            Blueprint
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

          <Film size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {blueprint.name}
          </span>

          <div style={{ flex: 1 }} />

          {/* Present */}
          {frames.length > 0 && (
            <button
              onClick={handlePresent}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}
            >
              <Play size={13} />
              Present
            </button>
          )}

          {/* Export all */}
          {framesWithImages > 0 && !isGuestView && (
            <button
              onClick={handleExportAll}
              disabled={exportingAll}
              title={`Download ${framesWithImages} frame${framesWithImages !== 1 ? 's' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: exportingAll ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: exportingAll ? 'not-allowed' : 'pointer', fontSize: 13,
              }}
            >
              {exportingAll
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Download size={13} />
              }
              Export all
            </button>
          )}

          {/* Journey map selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSbSelector((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
                color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {activeStoryboard?.name ?? 'No journey map'}
              <ChevronDown size={13} />
            </button>

            {showSbSelector && (
              <SbDropdown
                storyboards={storyboards}
                activeId={activeStoryboard?.id ?? null}
                addingSb={addingSb}
                newSbName={newSbName}
                onSelect={(id) => { setActiveStoryboard(id); setShowSbSelector(false); }}
                onDelete={(id) => { deleteStoryboard(id); setShowSbSelector(false); }}
                onStartAdd={() => setAddingSb(true)}
                onNameChange={setNewSbName}
                onConfirmAdd={handleCreateStoryboard}
                onCancelAdd={() => { setAddingSb(false); setNewSbName(''); }}
                onClose={() => setShowSbSelector(false)}
              />
            )}
          </div>

          {/* Style guide button */}
          {activeStoryboard && !isGuestView && (
            <button
              onClick={() => setShowStyleGuide(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}
            >
              <Settings2 size={14} />
              Style Guide
            </button>
          )}

          {/* Generate button */}
          {!isGuestView && <button
            onClick={handleGenerate}
            disabled={storyboardGenerating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--accent-primary)',
              color: '#fff', cursor: storyboardGenerating ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: storyboardGenerating ? 0.7 : 1,
            }}
          >
            {storyboardGenerating ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                {generatingIdx >= 0 ? `Frame ${generatingIdx + 1} of ${frames.length}` : 'Generating…'}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>}
        </div>

        {/* ── Main content ── */}
        {frames.length === 0 && !storyboardGenerating ? (
          <EmptyState onGenerate={handleGenerate} />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Filmstrip */}
            <div
              ref={filmstripRef}
              style={{
                padding: '24px 24px 16px',
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                flexShrink: 0,
                scrollbarWidth: 'thin',
              }}
            >
              {frames.map((frame, idx) => (
                <FrameCard
                  key={frame.id}
                  frame={frame}
                  index={idx}
                  isSelected={frame.id === selectedFrameId}
                  isGenerating={frame.id === storyboardGeneratingFrameId}
                  isDragging={dragIdx === idx}
                  isDragOver={dragOverIdx === idx && dragIdx !== null && dragIdx !== idx}
                  onClick={() => setSelectedFrameId(frame.id)}
                  onImageClick={() => frame.imageUrl && setLightboxUrl(frame.imageUrl)}
                  onPresent={() => { setPresentStartIdx(idx); setPresenting(true); }}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={() => handleDragOver(idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                />
              ))}

              {/* Add frame placeholder */}
              {activeStoryboard && <AddFrameCard storyboardId={activeStoryboard.id} />}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />

            {/* Detail panel */}
            {selectedFrame && activeStoryboard && (
              <FrameDetail
                frame={selectedFrame}
                storyboardId={activeStoryboard.id}
                actors={blueprint.actors}
                phases={blueprint.phases}
                isGenerating={selectedFrame.id === storyboardGeneratingFrameId}
                onCaptionChange={(text) =>
                  updateStoryboardFrame(activeStoryboard.id, selectedFrame.id, { caption: text })
                }
                onPromptChange={(text) =>
                  updateStoryboardFrame(activeStoryboard.id, selectedFrame.id, { imagePrompt: text })
                }
                onRegenerate={() => regenerateFrame(activeStoryboard.id, selectedFrame.id)}
                onDelete={() => {
                  const idx = frames.findIndex((f) => f.id === selectedFrame.id);
                  deleteStoryboardFrame(activeStoryboard.id, selectedFrame.id);
                  const next = frames[idx + 1] ?? frames[idx - 1];
                  setSelectedFrameId(next?.id ?? null);
                }}
                onImageClick={() => selectedFrame.imageUrl && setLightboxUrl(selectedFrame.imageUrl)}
              />
            )}
          </div>
        )}

        {/* Style guide modal */}
        {showStyleGuide && activeStoryboard && (
          <StyleGuideModal
            storyboard={activeStoryboard}
            actors={blueprint.actors}
            frames={activeStoryboard.frames}
            onUpdate={(guide) => updateStoryboardStyleGuide(activeStoryboard.id, guide)}
            onRegenerateAll={() => regenerateAllFrames(activeStoryboard.id)}
            onClose={() => setShowStyleGuide(false)}
          />
        )}
      </div>

      {/* Journey map presenter */}
      {presenting && (
        <JourneyMapPresenter
          frames={frames}
          startIdx={presentStartIdx}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  );
}

// ─── Frame card (filmstrip) ───────────────────────────────────────────────────

function FrameCard({
  frame, index, isSelected, isGenerating, isDragging, isDragOver,
  onClick, onImageClick, onPresent, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  frame: StoryboardFrame;
  index: number;
  isSelected: boolean;
  isGenerating: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onImageClick: () => void;
  onPresent: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const W = 240;
  const H = Math.round(W * 9 / 16);
  const [imgBroken, setImgBroken] = useState(false);

  // Reset broken state when imageUrl changes (e.g. after regeneration)
  useEffect(() => { setImgBroken(false); }, [frame.imageUrl]);

  const showImg = frame.imageUrl && !imgBroken;

  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      style={{
        flexShrink: 0,
        width: W,
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Image box */}
      <div style={{
        width: W,
        height: H,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: isDragOver
          ? '2px dashed var(--accent-primary)'
          : `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        background: isDragOver ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
        position: 'relative',
        boxShadow: isSelected ? '0 0 0 3px var(--accent-primary-soft)' : 'var(--shadow-sm)',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
      }}>
        {isGenerating ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: 'var(--text-muted)',
          }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 11 }}>Generating…</span>
          </div>
        ) : showImg ? (
          <img
            src={frame.imageUrl!}
            alt=""
            onClick={(e) => { e.stopPropagation(); onImageClick(); }}
            onError={() => setImgBroken(true)}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              cursor: 'zoom-in',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <ImageOff size={18} />
          </div>
        )}

        {/* Frame number badge */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700,
          backdropFilter: 'blur(4px)',
        }}>
          {index + 1}
        </div>

        {/* Present button (shown on selected frame) */}
        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); onPresent(); }}
            title="Present from this frame"
            style={{
              position: 'absolute', bottom: 6, right: 6,
              background: 'rgba(0,0,0,0.55)',
              border: 'none', borderRadius: 4,
              padding: '3px 7px', cursor: 'pointer',
              color: '#fff', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
              backdropFilter: 'blur(4px)',
            }}
          >
            <Play size={10} />
            Present
          </button>
        )}
      </div>

      {/* Caption preview */}
      <p style={{
        margin: 0, fontSize: 12,
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
        fontWeight: isSelected ? 500 : 400,
      }}>
        {frame.caption}
      </p>
    </div>
  );
}

// ─── Add frame card ───────────────────────────────────────────────────────────

function AddFrameCard({ storyboardId }: { storyboardId: string }) {
  const addBlankStoryboardFrame = useBlueprintStore((s) => s.addBlankStoryboardFrame);

  const W = 240;
  const H = Math.round(W * 9 / 16);

  const handleAdd = () => {
    if (!storyboardId) return;
    addBlankStoryboardFrame(storyboardId);
  };

  return (
    <button
      onClick={handleAdd}
      style={{
        flexShrink: 0,
        width: W,
        height: H,
        borderRadius: 'var(--radius-md)',
        border: '2px dashed var(--border-subtle)',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--text-muted)',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-primary)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
      }}
    >
      <Plus size={20} />
      <span style={{ fontSize: 12 }}>Add frame</span>
    </button>
  );
}

// ─── Frame detail panel ───────────────────────────────────────────────────────

function FrameDetail({
  frame, storyboardId: _storyboardId, actors, phases,
  isGenerating,
  onCaptionChange, onPromptChange, onRegenerate, onDelete, onImageClick,
}: {
  frame: StoryboardFrame;
  storyboardId: string;
  actors: import('../../types/blueprint').Actor[];
  phases: import('../../types/blueprint').Phase[];
  isGenerating: boolean;
  onCaptionChange: (text: string) => void;
  onPromptChange: (text: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onImageClick: () => void;
}) {
  const [caption, setCaption] = useState(frame.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [promptDraft, setPromptDraft] = useState(frame.imagePrompt);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCaption(frame.caption);
    setPromptDraft(frame.imagePrompt);
    setImgBroken(false);
  }, [frame.id, frame.caption, frame.imagePrompt]);

  const handleCaptionBlur = () => {
    setEditingCaption(false);
    if (caption !== frame.caption) onCaptionChange(caption);
  };

  const handlePromptBlur = () => {
    setEditingPrompt(false);
    if (promptDraft !== frame.imagePrompt) onPromptChange(promptDraft);
  };

  const frameActors = actors.filter((a) => frame.actorIds.includes(a.id));
  const framePhases = phases.filter((p) => frame.phaseIds.includes(p.id));

  const IMG_W = 320;
  const IMG_H = Math.round(IMG_W * 9 / 16);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      gap: 32,
      padding: '20px 24px',
      overflow: 'hidden',
    }}>
      {/* Left: image */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          width: IMG_W,
          height: IMG_H,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-bg-muted)',
          position: 'relative',
        }}>
          {isGenerating ? (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: 'var(--text-muted)',
            }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12 }}>Generating image…</span>
            </div>
          ) : frame.imageUrl && !imgBroken ? (
            <img
              src={frame.imageUrl}
              alt=""
              onClick={onImageClick}
              onError={() => setImgBroken(true)}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                cursor: 'zoom-in',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: 'var(--text-muted)',
            }}>
              <ImageOff size={22} />
            </div>
          )}
        </div>

        {/* Image actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: isGenerating ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            {isGenerating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
            Regenerate
          </button>
          {frame.imageUrl && (
            <button
              onClick={() => downloadFrameImage(frame.imageUrl!, 'frame.jpg')}
              title="Download image"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
              }}
            >
              <Download size={13} />
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--accent-danger)', cursor: 'pointer', fontSize: 12,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Right: text + metadata */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflow: 'auto',
        minWidth: 0,
      }}>
        {/* Caption */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Caption
          </label>
          {editingCaption ? (
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={handleCaptionBlur}
              onKeyDown={(e) => { if (e.key === 'Escape') { setCaption(frame.caption); setEditingCaption(false); } }}
              rows={3}
              style={{
                width: '100%', padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-primary)',
                background: 'var(--surface-bg)', color: 'var(--text-primary)',
                fontSize: 14, lineHeight: 1.55, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              autoFocus
            />
          ) : (
            <p
              onClick={() => { setEditingCaption(true); setTimeout(() => captionRef.current?.focus(), 0); }}
              style={{
                margin: 0, padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-bg)', color: 'var(--text-primary)',
                fontSize: 14, lineHeight: 1.55, cursor: 'text', minHeight: 64,
              }}
            >
              {caption || <span style={{ color: 'var(--text-muted)' }}>Click to edit caption…</span>}
            </p>
          )}
        </div>

        {/* Scene description */}
        {frame.sceneDescription && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Scene
            </label>
            <p style={{
              margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-bg-muted)',
            }}>
              {frame.sceneDescription}
            </p>
          </div>
        )}

        {/* Image prompt (editable) */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Image Prompt
          </label>
          {editingPrompt ? (
            <textarea
              ref={promptRef}
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              onBlur={handlePromptBlur}
              onKeyDown={(e) => { if (e.key === 'Escape') { setPromptDraft(frame.imagePrompt); setEditingPrompt(false); } }}
              rows={3}
              style={{
                width: '100%', padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-primary)',
                background: 'var(--surface-bg)', color: 'var(--text-primary)',
                fontSize: 12, lineHeight: 1.5, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              autoFocus
            />
          ) : (
            <p
              onClick={() => { setEditingPrompt(true); setTimeout(() => promptRef.current?.focus(), 0); }}
              style={{
                margin: 0, padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-bg-muted)', color: 'var(--text-secondary)',
                fontSize: 12, lineHeight: 1.5, cursor: 'text',
              }}
            >
              {promptDraft || <span style={{ color: 'var(--text-muted)' }}>Click to edit prompt…</span>}
            </p>
          )}
        </div>

        {/* Actors + phases */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {frameActors.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Characters
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {frameActors.map((a) => (
                  <span key={a.id} style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                    fontSize: 12, fontWeight: 500,
                    background: `${a.color}22`, color: a.color,
                    border: `1px solid ${a.color}44`,
                  }}>
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {framePhases.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Phase
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {framePhases.map((p) => (
                  <span key={p.id} style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                    fontSize: 12, fontWeight: 500,
                    background: 'var(--surface-bg-muted)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Journey map selector dropdown ───────────────────────────────────────────

function SbDropdown({
  storyboards, activeId, addingSb, newSbName,
  onSelect, onDelete, onStartAdd, onNameChange, onConfirmAdd, onCancelAdd, onClose,
}: {
  storyboards: import('../../types/blueprint').Storyboard[];
  activeId: string | null;
  addingSb: boolean;
  newSbName: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartAdd: () => void;
  onNameChange: (n: string) => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4,
        background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
        zIndex: 100, minWidth: 200, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {storyboards.map((sb) => (
          <div
            key={sb.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', borderRadius: 'var(--radius-sm)',
              background: sb.id === activeId ? 'var(--surface-bg-muted)' : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(sb.id)}
          >
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{sb.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(sb.id); }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', opacity: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

        {addingSb ? (
          <div style={{ display: 'flex', gap: 6, padding: '4px 8px' }}>
            <input
              autoFocus
              value={newSbName}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onConfirmAdd(); if (e.key === 'Escape') onCancelAdd(); }}
              placeholder="Journey map name…"
              style={{
                flex: 1, fontSize: 13, padding: '4px 6px',
                border: '1px solid var(--border-subtle)', borderRadius: 4,
                background: 'var(--surface-bg)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button onClick={onConfirmAdd} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer' }}>Add</button>
          </div>
        ) : (
          <button
            onClick={onStartAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, width: '100%',
            }}
          >
            <Plus size={13} />
            New journey map
          </button>
        )}
      </div>
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 40,
      color: 'var(--text-muted)',
    }}>
      <Film size={48} strokeWidth={1} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          No frames yet
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, maxWidth: 320 }}>
          Generate a journey map from your blueprint. Claude will create scenes and captions;
          {' DALL-E 3 will illustrate each frame.'}
        </p>
      </div>
      <button
        onClick={onGenerate}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 'var(--radius-md)',
          border: 'none', background: 'var(--accent-primary)',
          color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}
      >
        <Sparkles size={16} />
        Generate journey map
      </button>
    </div>
  );
}

// ─── Style guide modal ────────────────────────────────────────────────────────

function StyleGuideModal({
  storyboard, actors, frames, onUpdate, onRegenerateAll, onClose,
}: {
  storyboard: import('../../types/blueprint').Storyboard;
  actors: import('../../types/blueprint').Actor[];
  frames: StoryboardFrame[];
  onUpdate: (guide: StoryboardStyleGuide) => void;
  onRegenerateAll: () => void;
  onClose: () => void;
}) {
  const [guide, setGuide] = useState<StoryboardStyleGuide>({ ...storyboard.styleGuide });
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const [presets, setPresets] = useState<StylePreset[]>(() => loadPresets());
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const presetInputRef = useRef<HTMLInputElement>(null);

  const updateChar = (actorId: string, text: string) => {
    setGuide((g) => ({
      ...g,
      characterDescriptions: { ...g.characterDescriptions, [actorId]: text },
    }));
  };

  const handleSave = () => {
    onUpdate(guide);
    onClose();
  };

  const handleSaveAndRegenerate = () => {
    onUpdate(guide);
    onClose();
    onRegenerateAll();
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const preset = savePreset(name, guide.baseStyle);
    setPresets((prev) => [...prev, preset]);
    setPresetName('');
    setSavingPreset(false);
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const handleApplyPreset = (preset: StylePreset) => {
    setGuide((g) => ({ ...g, baseStyle: preset.baseStyle }));
  };

  const previewFrame = frames[previewFrameIdx];
  const previewPrompt = previewFrame
    ? buildImagePrompt(previewFrame, guide, actors)
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-bg)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          width: 580,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Style Guide
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Visual style and character descriptions used for image generation
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Base style + presets */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Base Style
              </label>
              {!savingPreset ? (
                <button
                  onClick={() => { setSavingPreset(true); setTimeout(() => presetInputRef.current?.focus(), 0); }}
                  title="Save current base style as a reusable preset"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  <BookMarked size={11} />
                  Save as preset
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input
                    ref={presetInputRef}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePreset();
                      if (e.key === 'Escape') { setSavingPreset(false); setPresetName(''); }
                    }}
                    placeholder="Preset name…"
                    style={{
                      fontSize: 12, padding: '3px 7px', width: 140,
                      borderRadius: 4, border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-bg)', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSavePreset}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4,
                      border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setSavingPreset(false); setPresetName(''); }}
                    style={{
                      fontSize: 11, padding: '3px 6px', borderRadius: 4,
                      border: '1px solid var(--border-subtle)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <textarea
              value={guide.baseStyle}
              onChange={(e) => setGuide((g) => ({ ...g, baseStyle: e.target.value }))}
              rows={2}
              style={{
                width: '100%', padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-bg-muted)', color: 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.5, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />

            {/* Saved presets */}
            {presets.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BookMarked size={10} />
                  Saved presets — click to apply
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${preset.baseStyle === guide.baseStyle ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        background: preset.baseStyle === guide.baseStyle ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => handleApplyPreset(preset)}
                        title={preset.baseStyle}
                        style={{
                          fontSize: 12, padding: '4px 10px',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: preset.baseStyle === guide.baseStyle ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          fontWeight: preset.baseStyle === guide.baseStyle ? 600 : 400,
                        }}
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Delete preset"
                        style={{
                          padding: '4px 7px 4px 2px',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Character descriptions */}
          <div>
            <label style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'block', marginBottom: 12,
            }}>
              Character Descriptions
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {actors.map((actor) => (
                <div key={actor.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: actor.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {actor.name}
                    </span>
                  </div>
                  <textarea
                    value={guide.characterDescriptions[actor.id] ?? ''}
                    onChange={(e) => updateChar(actor.id, e.target.value)}
                    placeholder={`Visual description for ${actor.name}…`}
                    rows={2}
                    style={{
                      width: '100%', padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-bg-muted)', color: 'var(--text-primary)',
                      fontSize: 13, lineHeight: 1.5, resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Prompt preview */}
          {frames.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Prompt Preview
                </label>
                {frames.length > 1 && (
                  <select
                    value={previewFrameIdx}
                    onChange={(e) => setPreviewFrameIdx(Number(e.target.value))}
                    style={{
                      fontSize: 12, padding: '3px 6px',
                      borderRadius: 4, border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-bg)', color: 'var(--text-secondary)',
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {frames.map((f, i) => (
                      <option key={f.id} value={i}>Frame {i + 1}</option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                readOnly
                value={previewPrompt ?? ''}
                rows={4}
                style={{
                  width: '100%', padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--canvas-bg)', color: 'var(--text-secondary)',
                  fontSize: 12, lineHeight: 1.5, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  cursor: 'default',
                }}
              />
              <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Live preview of how this style guide assembles into a DALL-E prompt.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {frames.length > 0 && (
              <button
                onClick={handleSaveAndRegenerate}
                title="Save style guide, rebuild all prompts, and regenerate all images"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                }}
              >
                <RefreshCw size={13} />
                Save &amp; Regenerate All
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                border: 'none', background: 'var(--accent-primary)',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
