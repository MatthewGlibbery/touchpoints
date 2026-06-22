import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { animateToViewport, captureViewport } from '../../lib/viewportBridge';
import type { PresentationKeyframe } from '../../types/blueprint';

// Threshold for considering the viewport "moved" from the slide position
const VP_THRESHOLD = 8; // px
const ZOOM_THRESHOLD = 0.02;

function hasViewportDrifted(
  current: [number, number, number],
  target: { x: number; y: number; zoom: number }
): boolean {
  const [tx, ty, zoom] = current;
  return (
    Math.abs(tx - target.x) > VP_THRESHOLD ||
    Math.abs(ty - target.y) > VP_THRESHOLD ||
    Math.abs(zoom - target.zoom) > ZOOM_THRESHOLD
  );
}

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

  // Track viewport drift from the current slide via polling (avoids needing
  // to be inside a ReactFlowProvider — PresentationControls is rendered as an
  // overlay sibling, not inside the ReactFlow tree).
  const currentKf: PresentationKeyframe | undefined = keyframes[currentKfIdx];
  const [drifted, setDrifted] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!currentKf || currentKf.compareMode) {
      setDrifted(false);
      return;
    }
    const check = () => {
      const vp = captureViewport();
      if (vp) {
        const transform: [number, number, number] = [vp.x, vp.y, vp.zoom];
        setDrifted(hasViewportDrifted(transform, currentKf.viewport));
      }
      rafRef.current = requestAnimationFrame(check);
    };
    rafRef.current = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentKf]);

  // Reset drift flag when slide changes
  useEffect(() => {
    setDrifted(false);
  }, [currentKfIdx]);

  // On mount: apply the starting keyframe's state
  useEffect(() => {
    const kf = keyframes[currentKfIdx];
    if (!kf) return;
    applyKeyframeState(kf);
    if (!kf.compareMode) animateToViewport(kf.viewport, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard slide navigation: ←/→ steps, Home/End jump, Esc exits.
  // Skipped while focus is inside an editable field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(useBlueprintStore.getState().currentKeyframeIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(useBlueprintStore.getState().currentKeyframeIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

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

  const handleReset = useCallback(() => {
    if (!currentKf || currentKf.compareMode) return;
    animateToViewport(currentKf.viewport, 400);
  }, [currentKf]);

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

      {/* Reset viewport button — visible only when user has panned/zoomed away */}
      {drifted && (
        <button
          onClick={handleReset}
          title="Reset to slide position"
          style={resetBtnStyle}
        >
          <RotateCcw size={13} />
        </button>
      )}

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

const resetBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-bg-muted)',
  color: 'var(--accent-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

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
