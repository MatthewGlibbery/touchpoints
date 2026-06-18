import { useLayoutEffect, useCallback, useEffect } from 'react';
import { useBlueprintStore } from './store/blueprint.store';
import { AuthScreen } from './components/auth/AuthScreen';
import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay';
import { BlueprintCanvas } from './components/canvas/BlueprintCanvas';
import { SplitCanvas } from './components/canvas/SplitCanvas';
import { JourneyMapView } from './components/storyboard/StoryboardView';
import { FrameworksView } from './components/frameworks/FrameworksView';
import { ProjectBar } from './components/ui/ProjectBar';
import { ModeBar } from './components/ui/ModeBar';
import { ViewRail, ViewPanel_ } from './components/ui/ViewRail';
import { UserMenu } from './components/ui/UserMenu';
import { VersionBar } from './components/ui/VersionBar';
import { NodeInspector } from './components/ui/NodeInspector';
import { ActorPanel } from './components/ui/ActorPanel';
import { PhaseInspector } from './components/ui/PhaseInspector';
import { EdgeInspector } from './components/ui/EdgeInspector';
import { SlidePanel } from './components/ui/SlidePanel';
import { PresentationControls } from './components/ui/PresentationControls';
import { OverviewInspector } from './components/ui/OverviewInspector';
import { CommentThread } from './components/ui/CommentThread';
import { CommentFilterBar } from './components/ui/CommentFilterBar';
import { DetachedThreadsModal } from './components/ui/DetachedThreadsModal';
import { GuestNamePrompt } from './components/auth/GuestNamePrompt';

export default function App() {
  const mode                 = useBlueprintStore((s) => s.mode);
  const theme                = useBlueprintStore((s) => s.theme);
  const presentMode          = useBlueprintStore((s) => s.presentMode);
  const presentationEditMode = useBlueprintStore((s) => s.presentationEditMode);
  const compareMode          = useBlueprintStore((s) => s.compareMode);
  const storyboardMode       = useBlueprintStore((s) => s.storyboardMode);
  const frameworkMode        = useBlueprintStore((s) => s.frameworkMode);
  const inspectorOpen        = useBlueprintStore((s) => s.inspectorOpen);
  const overviewMode         = useBlueprintStore((s) => s.overviewMode);
  const selectedOverviewCell = useBlueprintStore((s) => s.selectedOverviewCell);
  const lightboxUrl          = useBlueprintStore((s) => s.lightboxUrl);
  const setLightboxUrl       = useBlueprintStore((s) => s.setLightboxUrl);
  const isGuestView          = useBlueprintStore((s) => s.isGuestView);
  const guestCanComment      = useBlueprintStore((s) => s.guestCanComment);
  const guestName            = useBlueprintStore((s) => s.guestName);
  const undo                 = useBlueprintStore((s) => s.undo);
  const redo                 = useBlueprintStore((s) => s.redo);
  const commentMode          = useBlueprintStore((s) => s.commentMode);

  // Toggle body class for comment-mode cursor + hover styles
  useEffect(() => {
    if (commentMode) document.body.classList.add('comment-mode');
    else document.body.classList.remove('comment-mode');
    return () => document.body.classList.remove('comment-mode');
  }, [commentMode]);

  const closeLightbox = useCallback(() => setLightboxUrl(null), [setLightboxUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput) return;

      const state = useBlueprintStore.getState();
      const { commentMode: cm, isGuestView: ig, isCollaboratorView: icv } = state;
      const lockedReadOnly = cm || ig || icv;

      const meta = e.metaKey || e.ctrlKey;
      if (meta) {
        if (lockedReadOnly) return;
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
        return;
      }

      // Arrow-key navigation across action cards. Works in normal canvas mode;
      // present mode is handled by PresentationControls. Skipped in storyboard /
      // overview / compare since those have their own UIs.
      const isArrow =
        e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp'   || e.key === 'ArrowDown';
      if (isArrow && state.mode === 'canvas' && !state.presentMode &&
          !state.storyboardMode && !state.overviewMode && !state.compareMode &&
          state.selectedNodeId && state.blueprint) {
        const bp = state.blueprint;
        const cur = bp.actions.find((a) => a.id === state.selectedNodeId);
        if (!cur) return;

        let next: { id: string } | null = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // Walk this actor's row sorted by (phase.order, action.order)
          const row = bp.actions
            .filter((a) => a.actorId === cur.actorId)
            .sort((a, b) => {
              const pa = bp.phases.find((p) => p.id === a.phaseId)?.order ?? 0;
              const pb = bp.phases.find((p) => p.id === b.phaseId)?.order ?? 0;
              if (pa !== pb) return pa - pb;
              return a.order - b.order;
            });
          const i = row.findIndex((a) => a.id === cur.id);
          next = e.key === 'ArrowRight' ? (row[i + 1] ?? null) : (row[i - 1] ?? null);
        } else {
          // Walk this column (same phase + order) sorted by actor.order
          const col = bp.actions
            .filter((a) => a.phaseId === cur.phaseId && a.order === cur.order)
            .sort((a, b) => {
              const ao = bp.actors.find((x) => x.id === a.actorId)?.order ?? 0;
              const bo = bp.actors.find((x) => x.id === b.actorId)?.order ?? 0;
              return ao - bo;
            });
          const i = col.findIndex((a) => a.id === cur.id);
          next = e.key === 'ArrowDown' ? (col[i + 1] ?? null) : (col[i - 1] ?? null);
        }

        if (next) {
          e.preventDefault();
          state.setSelectedNode(next.id);
          state.animateToNode(next.id);
        }
        return;
      }

      if (lockedReadOnly) return;

      // Backspace/Delete removes the currently selected lane segment.
      // (Action card deletion intentionally not bound — too easy to lose work
      // accidentally; deletion happens via the inspector's confirm dialog.)
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (state.selectedLaneSegmentId) {
          e.preventDefault();
          state.removeSelectedLaneSegment();
        }
      }

      // Escape closes the most-recently-opened inspector, then clears the
      // column / multi-select if no inspector was open.
      if (e.key === 'Escape') {
        if (state.inspectorOpen) state.setInspectorOpen(false);
        else if (state.actorPanelOpen) state.setSelectedActor(null);
        else if (state.phaseInspectorOpen) state.setSelectedPhase(null);
        else if (state.edgeInspectorOpen) state.setSelectedEdge(null);
        else if (state.selectedColumnKey) state.setSelectedColumnKey(null);
        else if (state.multiSelectedNodeIds.length > 0) state.setMultiSelectedNodeIds([]);
      }
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
      {inCanvas && frameworkMode
        ? <FrameworksView />
        : inCanvas && storyboardMode
        ? <JourneyMapView />
        : (inCanvas && compareMode) ? <SplitCanvas /> : <BlueprintCanvas />
      }

      {mode === 'onboarding' && <OnboardingOverlay />}

      {/* ── Guest name prompt (shown once if can comment and no name yet) ── */}
      {isGuestView && guestCanComment && !guestName && <GuestNamePrompt />}

      {inCanvas && !storyboardMode && !frameworkMode && (
        <>
          {/* ── Standard edit UI — hidden in present and compare modes ── */}
          {!presentMode && !compareMode && (
            <>
              {/* ModeBar (top center) + ViewRail (left side) + UserMenu (top right) */}
              <ModeBar />
              <ViewRail />
              <ViewPanel_ />

              {/* Owner-only UI */}
              {!isGuestView && (
                <>
                  <ProjectBar />
                  <UserMenu />
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
        </>
      )}

      {/* ── Comment thread popover (mode-agnostic) ── */}
      <CommentThread />

      {/* ── Comment filter bar (visible only in comment mode) ── */}
      <CommentFilterBar />

      {/* ── Detached threads modal ── */}
      <DetachedThreadsModal />

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
