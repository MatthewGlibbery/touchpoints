import { useLayoutEffect, useCallback, useEffect } from 'react';
import { useBlueprintStore } from './store/blueprint.store';
import { AuthScreen } from './components/auth/AuthScreen';
import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay';
import { BlueprintCanvas } from './components/canvas/BlueprintCanvas';
import { SplitCanvas } from './components/canvas/SplitCanvas';
import { JourneyMapView } from './components/storyboard/StoryboardView';
import { ProjectBar } from './components/ui/ProjectBar';
import { ModeBar } from './components/ui/ModeBar';
import { ViewBar } from './components/ui/ViewBar';
import { VersionBar } from './components/ui/VersionBar';
import { NodeInspector } from './components/ui/NodeInspector';
import { ActorPanel } from './components/ui/ActorPanel';
import { PhaseInspector } from './components/ui/PhaseInspector';
import { EdgeInspector } from './components/ui/EdgeInspector';
import { DebugPanel } from './components/ui/DebugPanel';
import { SlidePanel } from './components/ui/SlidePanel';
import { PresentationControls } from './components/ui/PresentationControls';
import { OverviewInspector } from './components/ui/OverviewInspector';
import { Sun, Moon } from 'lucide-react';
import { GuestNamePrompt } from './components/auth/GuestNamePrompt';

export default function App() {
  const mode                 = useBlueprintStore((s) => s.mode);
  const theme                = useBlueprintStore((s) => s.theme);
  const presentMode          = useBlueprintStore((s) => s.presentMode);
  const presentationEditMode = useBlueprintStore((s) => s.presentationEditMode);
  const compareMode          = useBlueprintStore((s) => s.compareMode);
  const storyboardMode       = useBlueprintStore((s) => s.storyboardMode);
  const inspectorOpen        = useBlueprintStore((s) => s.inspectorOpen);
  const overviewMode         = useBlueprintStore((s) => s.overviewMode);
  const selectedOverviewCell = useBlueprintStore((s) => s.selectedOverviewCell);
  const toggleTheme          = useBlueprintStore((s) => s.toggleTheme);
  const lightboxUrl          = useBlueprintStore((s) => s.lightboxUrl);
  const setLightboxUrl       = useBlueprintStore((s) => s.setLightboxUrl);
  const isGuestView          = useBlueprintStore((s) => s.isGuestView);
  const guestCanComment      = useBlueprintStore((s) => s.guestCanComment);
  const guestName            = useBlueprintStore((s) => s.guestName);
  const undo                 = useBlueprintStore((s) => s.undo);
  const redo                 = useBlueprintStore((s) => s.redo);

  const closeLightbox = useCallback(() => setLightboxUrl(null), [setLightboxUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // useLayoutEffect fires before children's useEffect, ensuring data-theme is
  // set on the root before DotBackground reads the --canvas-grid CSS variable.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const inCanvas = mode === 'canvas';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'var(--canvas-bg)' }}>

      {/* ── Auth gate ── */}
      {mode === 'auth' && <AuthScreen />}

      {/* ── Full-screen canvas layer ── */}
      {inCanvas && storyboardMode
        ? <JourneyMapView />
        : (inCanvas && compareMode) ? <SplitCanvas /> : <BlueprintCanvas />
      }

      {mode === 'onboarding' && <OnboardingOverlay />}

      {/* ── Guest name prompt (shown once if can comment and no name yet) ── */}
      {isGuestView && guestCanComment && !guestName && <GuestNamePrompt />}

      {inCanvas && !storyboardMode && (
        <>
          {/* ── Standard edit UI — hidden in present and compare modes ── */}
          {!presentMode && !compareMode && (
            <>
              {/* ModeBar + ViewBar visible to all including guests */}
              <ModeBar />
              <ViewBar />

              {/* Owner-only UI */}
              {!isGuestView && (
                <>
                  <ProjectBar />
                  <VersionBar />
                  {overviewMode && selectedOverviewCell ? <OverviewInspector /> : <NodeInspector />}
                  <ActorPanel />
                  <PhaseInspector />
                  <EdgeInspector />
                </>
              )}
            </>
          )}

          {/* ── Guest view: read-only inspector (if open) ── */}
          {isGuestView && !presentMode && !compareMode && inspectorOpen && <NodeInspector />}

          {/* ── Compare mode (not presenting) — overlay extras only, no ModeBar ── */}
          {compareMode && !presentMode && (
            <>
              {/* SlidePanel rendered below when presentationEditMode */}
            </>
          )}

          {/* ── Present mode — clean canvas, inspector only if slide requested it ── */}
          {presentMode && inspectorOpen && <NodeInspector />}

          {/* ── Slide editor — visible regardless of compare mode ── */}
          {presentationEditMode && <SlidePanel />}

          {/* ── Playback controls — visible regardless of compare mode ── */}
          {presentMode && <PresentationControls />}

          <DebugPanel />
        </>
      )}

      {/* ── Theme toggle — always visible ── */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 50,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1px solid var(--border-strong)',
          background: 'var(--surface-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* ── Global lightbox ── */}
      {lightboxUrl && (
        <div
          onClick={closeLightbox}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxUrl}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 0,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </div>
  );
}
