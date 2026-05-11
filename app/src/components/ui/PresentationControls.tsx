import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { animateToViewport } from '../../lib/viewportBridge';
import type { PresentationKeyframe } from '../../types/blueprint';

export function PresentationControls() {
  const blueprint              = useBlueprintStore((s) => s.blueprint);
  const activePresentationId   = useBlueprintStore((s) => s.activePresentationId);
  const currentKfIdx           = useBlueprintStore((s) => s.currentKeyframeIndex);
  const setCurrentKeyframeIndex = useBlueprintStore((s) => s.setCurrentKeyframeIndex);
  const applyKeyframeState     = useBlueprintStore((s) => s.applyKeyframeState);

  const presentations = blueprint?.presentations ?? [];
  const activePresentation = presentations.find((p) => p.id === activePresentationId) ?? presentations[0] ?? null;
  const keyframes = activePresentation?.keyframes ?? [];
  const total = keyframes.length;

  // On mount: apply the starting keyframe's state
  useEffect(() => {
    const kf = keyframes[currentKfIdx];
    if (!kf) return;
    applyKeyframeState(kf);
    if (!kf.compareMode) animateToViewport(kf.viewport, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    const kf = keyframes[clamped];
    if (!kf) return;

    // Check if we're leaving compare mode (canvas needs to re-mount)
    const wasInCompare = useBlueprintStore.getState().compareMode;

    setCurrentKeyframeIndex(clamped);
    applyKeyframeState(kf);

    if (!kf.compareMode) {
      if (wasInCompare) {
        // BlueprintCanvas unmounts/remounts when compareMode changes — wait for it
        setTimeout(() => animateToViewport(kf.viewport, 600), 350);
      } else {
        animateToViewport(kf.viewport);
      }
    }
  };

  const handleExit = () => {
    useBlueprintStore.setState({ presentMode: false, presentationEditMode: true });
  };

  if (total === 0) {
    return (
      <div style={containerStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No slides</span>
        <button onClick={handleExit} style={exitBtnStyle}>Exit</button>
      </div>
    );
  }

  const currentKf: PresentationKeyframe | undefined = keyframes[currentKfIdx];

  return (
    <div style={containerStyle}>
      <button
        onClick={() => goTo(currentKfIdx - 1)}
        disabled={currentKfIdx === 0}
        style={navBtnStyle(currentKfIdx === 0)}
      >
        <ChevronLeft size={15} />
      </button>

      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', minWidth: 44, textAlign: 'center' }}>
        {currentKfIdx + 1} / {total}
      </span>

      {currentKf?.label && (
        <span style={{
          fontSize: 12, color: 'var(--text-muted)',
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {currentKf.label}
        </span>
      )}

      <button
        onClick={() => goTo(currentKfIdx + 1)}
        disabled={currentKfIdx === total - 1}
        style={navBtnStyle(currentKfIdx === total - 1)}
      >
        <ChevronRight size={15} />
      </button>

      <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />

      <button onClick={handleExit} style={exitBtnStyle}>
        <X size={12} style={{ marginRight: 3 }} />
        Exit
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 72,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-pill)',
  padding: '6px 10px',
  boxShadow: 'var(--shadow-md)',
};

const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-bg-muted)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
});

const exitBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--accent-primary)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};
