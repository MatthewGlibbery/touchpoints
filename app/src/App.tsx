import { useEffect, useLayoutEffect, useCallback } from 'react';
import { useBlueprintStore } from './store/blueprint.store';
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

  const closeLightbox = useCallback(() => setLightboxUrl(null), [setLightboxUrl]);

  // useLayoutEffect fires before children's useEffect, ensuring data-theme is
  // set on the root before DotBackground reads the --canvas-grid CSS variable.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const inCanvas = mode === 'canvas';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* ── Full-screen canvas layer ── */}
      {inCanvas && storyboardMode
        ? <JourneyMapView />
        : (inCanvas && compareMode) ? <SplitCanvas /> : <BlueprintCanvas />
      }

      {mode === 'onboarding' && <OnboardingOverlay />}

      {inCanvas && !storyboardMode && (
        <>
          {/* ── Standard edit UI — hidden in present and compare modes ── */}
          {!presentMode && !compareMode && (
            <>
              <ProjectBar />
              <ModeBar />
              <VersionBar />
              <ViewBar />
              {overviewMode && selectedOverviewCell ? <OverviewInspector /> : <NodeInspector />}
              <ActorPanel />
              <PhaseInspector />
              <EdgeInspector />
            </>
          )}

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
