import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';
import type { Blueprint, BlueprintVersion, Action, Actor, Phase, PainPoint, Opportunity, Question, EdgeMeta, CustomEdge, Presentation, PresentationKeyframe, Storyboard, StoryboardFrame, StoryboardStyleGuide, ServiceStatus } from '../types/blueprint';
import { generateStyleGuide, generateFrameStructure, buildImagePrompt, generateImage } from '../lib/storyboard';
import { blueprintToFlow, computeColumnData, getBlueprintForVersion, ACTION_NODE_WIDTH, estimateActionHeight } from '../lib/layout';
import { saveBlueprint, loadBlueprint, loadAllBlueprints, switchBlueprint, fetchBlueprintsFromCloud, migrateLocalBlueprints, importBlueprintsToCloud } from '../lib/storage';
import { centerOnPoint } from '../lib/viewportBridge';
import { getSession, onAuthStateChange, signOut as authSignOut } from '../lib/auth';
import { supabase } from '../lib/supabase';

type AppMode = 'onboarding' | 'canvas' | 'auth';
type CanvasView = 'edit' | 'pain-points' | 'opportunities' | 'questions' | 'status';

type DragTarget = { actorId: string; phaseId: string; order: number };
type ActorDragOffset = { actorId: string; offsetY: number };
type PhaseDragOffset = { phaseId: string; offsetX: number };
type Theme = 'light' | 'dark';

type ContentData = {
  actions?: Action[];
  painPoints?: PainPoint[];
  opportunities?: Opportunity[];
  questions?: Question[];
};

type AppState = {
  mode: AppMode;
  canvasView: CanvasView;
  userId: string | null;
  userEmail: string | null;
  pendingMigration: Blueprint[] | null;
  // Guest / share view
  isGuestView: boolean;
  guestCanComment: boolean;
  guestName: string | null;
  guestSessionId: string;
  guestShareId: string | null;
  guestBlueprintRowId: string | null;
  shareToken: string | null;
  blueprint: Blueprint | null;
  rfNodes: Node[];
  rfEdges: Edge[];
  selectedNodeId: string | null;
  inspectorOpen: boolean;
  inspectorRequestedTab: string | null;
  selectedActorId: string | null;
  actorPanelOpen: boolean;
  selectedPhaseId: string | null;
  phaseInspectorOpen: boolean;
  dragTarget: DragTarget | null;
  draggingNodeId: string | null;
  actorDragOffset: ActorDragOffset | null;
  phaseDragOffset: PhaseDragOffset | null;
  selectedEdgeId: string | null;
  edgeInspectorOpen: boolean;
  theme: Theme;
  activeVersionId: string | null;
  compareMode: boolean;
  compareVersionIds: [string | null, string | null];
  compareSyncViewport: boolean;
  presentMode: boolean;
  presentationEditMode: boolean;
  activePresentationId: string | null;
  currentKeyframeIndex: number;

  // Navigation
  setMode: (mode: AppMode) => void;
  setCanvasView: (view: CanvasView) => void;
  setUser: (id: string, email: string) => void;
  signOut: () => Promise<void>;
  confirmMigration: () => Promise<void>;
  skipMigration: () => Promise<void>;
  setBlueprint: (blueprint: Blueprint) => void;
  loadAllBlueprints: () => Record<string, Blueprint>;
  switchToBlueprint: (id: string) => void;
  startFromScratch: () => void;

  // Guest / share
  loadBlueprintByShareToken: (token: string) => Promise<void>;
  setGuestName: (name: string | null) => void;
  addGuestPainPoint: (actionId: string, description: string, severity: PainPoint['severity']) => Promise<void>;
  addGuestOpportunity: (actionId: string, description: string) => Promise<void>;
  addGuestQuestion: (actionId: string, text: string) => Promise<void>;
  loadGuestComments: () => Promise<void>;

  // Actions
  updateAction: (id: string, patch: Partial<Action>) => void;
  addAction: (actorId: string, phaseId: string, order: number) => void;
  removeAction: (id: string) => void;
  insertSubstep: (phaseId: string, atOrder: number) => void;

  // Pain points
  addPainPoint: (actionId: string, description: string, severity: PainPoint['severity']) => void;
  updatePainPoint: (id: string, patch: Partial<Pick<PainPoint, 'description' | 'severity'>>) => void;
  removePainPoint: (id: string) => void;

  // Opportunities
  addOpportunity: (actionId: string, description: string) => void;
  updateOpportunity: (id: string, patch: Partial<Pick<Opportunity, 'description' | 'effort'>>) => void;
  removeOpportunity: (id: string) => void;

  // Questions
  addQuestion: (actionId: string, text: string) => void;
  updateQuestion: (id: string, patch: Partial<Pick<Question, 'text' | 'type'>>) => void;
  removeQuestion: (id: string) => void;

  // Actors / Phases
  addActor: (name: string) => void;
  updateActor: (id: string, patch: Partial<Pick<Actor, 'name' | 'bio' | 'goals'>>) => void;
  removeActor: (id: string) => void;
  moveActor: (id: string, direction: 'up' | 'down') => void;
  addPhase: (name: string) => void;
  updatePhase: (id: string, patch: Partial<Pick<Phase, 'name' | 'description' | 'conditional' | 'conditionLabel'>>) => void;
  removePhase: (id: string) => void;
  movePhase: (id: string, direction: 'left' | 'right') => void;
  movePhaseBoundary: (leftPhaseId: string, rightPhaseId: string, direction: 'left' | 'right') => void;

  // Edges
  updateEdgeMeta: (edgeId: string, patch: Partial<EdgeMeta>) => void;
  removeEdge: (edgeId: string) => void;
  addCustomEdge: (sourceActionId: string, targetActionId: string, sourceHandle?: string, targetHandle?: string) => void;

  // Touchpoint tags
  addTouchpointTag: (name: string) => void;
  removeTouchpointTag: (name: string) => void;
  toggleActionTouchpointLabel: (actionId: string, tag: string) => void;

  // Versions
  createVersion: (name: string) => void;
  switchVersion: (versionId: string | null) => void;
  deleteVersion: (versionId: string) => void;
  renameVersion: (versionId: string, name: string) => void;

  // UI
  setSelectedNode: (id: string | null) => void;
  openInspectorToTab: (id: string, tab: string) => void;
  clearInspectorRequestedTab: () => void;
  animateToNode: (actionId: string) => void;
  setInspectorOpen: (open: boolean) => void;
  setSelectedActor: (id: string | null) => void;
  setSelectedPhase: (id: string | null) => void;
  setDragTarget: (target: DragTarget | null) => void;
  setDraggingNode: (id: string | null) => void;
  setActorDragOffset: (offset: ActorDragOffset | null) => void;
  setPhaseDragOffset: (offset: PhaseDragOffset | null) => void;
  setSelectedEdge: (id: string | null) => void;
  toggleTheme: () => void;
  togglePresentMode: () => void;
  toggleCompareMode: () => void;
  setPresentationEditMode: (on: boolean) => void;
  setCurrentKeyframeIndex: (idx: number) => void;
  createPresentation: (name: string) => void;
  deletePresentation: (id: string) => void;
  renamePresentation: (id: string, name: string) => void;
  setActivePresentationId: (id: string | null) => void;
  addKeyframe: (presentationId: string, data: Omit<PresentationKeyframe, 'id'>) => void;
  applyKeyframeState: (kf: PresentationKeyframe) => void;
  updateKeyframe: (presentationId: string, keyframeId: string, updates: Partial<Pick<PresentationKeyframe, 'label' | 'viewport'>>) => void;
  removeKeyframe: (presentationId: string, keyframeId: string) => void;
  reorderKeyframes: (presentationId: string, fromIdx: number, toIdx: number) => void;
  setCompareVersionIds: (ids: [string | null, string | null]) => void;
  setCompareSyncViewport: (on: boolean) => void;
  refreshLayout: () => void;
  lightboxUrl: string | null;
  setLightboxUrl: (url: string | null) => void;
  dragOverInserterId: string | null;
  setDragOverInserterId: (id: string | null) => void;
  selectedColumnKey: string | null;
  setSelectedColumnKey: (key: string | null) => void;
  multiSelectedNodeIds: string[];
  setMultiSelectedNodeIds: (ids: string[]) => void;

  // Overview / semantic zoom
  overviewMode: boolean;
  overviewGenerating: boolean;
  selectedOverviewCell: { actorId: string; phaseId: string; actionId: string } | null;
  overviewCellGenerating: boolean;
  setOverviewMode: (on: boolean) => void;
  generateOverview: () => Promise<void>;
  setSelectedOverviewCell: (actorId: string, phaseId: string, actionId: string) => void;
  clearOverviewCell: () => void;
  generateCellDescription: (actorId: string, phaseId: string) => Promise<void>;
  updateCellDescription: (actorId: string, phaseId: string, text: string) => void;

  // Extended mutations
  deleteSubstep: (phaseId: string, order: number) => void;
  moveSubstep: (phaseId: string, fromOrder: number, direction: 'left' | 'right') => void;
  renameBlueprint: (name: string) => void;
  renameBaseVersion: (name: string) => void;
  actorPortraitGenerating: string | null;
  generateActorPortrait: (actorId: string) => Promise<void>;

  // Storyboard
  storyboardMode: boolean;
  storyboardGenerating: boolean;
  storyboardGeneratingFrameId: string | null;
  activeStoryboardId: string | null;
  setStoryboardMode: (on: boolean) => void;
  createStoryboard: (name: string) => void;
  deleteStoryboard: (id: string) => void;
  setActiveStoryboard: (id: string) => void;
  updateStoryboardFrame: (storyboardId: string, frameId: string, patch: Partial<StoryboardFrame>) => void;
  updateStoryboardStyleGuide: (storyboardId: string, guide: StoryboardStyleGuide) => void;
  addBlankStoryboardFrame: (storyboardId: string) => void;
  deleteStoryboardFrame: (storyboardId: string, frameId: string) => void;
  generateStoryboard: () => Promise<void>;
  regenerateFrame: (storyboardId: string, frameId: string) => Promise<void>;
  regenerateAllFrames: (storyboardId: string) => Promise<void>;
  reorderStoryboardFrames: (storyboardId: string, fromIdx: number, toIdx: number) => void;

  // Undo / Redo
  undoStack: Blueprint[];
  redoStack: Blueprint[];
  undo: () => void;
  redo: () => void;

  // Statuses
  addStatus: (label: string, color: string) => void;
  updateStatus: (id: string, patch: Partial<Pick<ServiceStatus, 'label' | 'color'>>) => void;
  removeStatus: (id: string) => void;
};

// Returns a blueprint filtered to only overview actions, with substep columns collapsed.
// Empty phases (no overview actions) are filtered out. Orders are remapped to be contiguous.
export function buildOverviewBlueprint(bp: Blueprint): Blueprint {
  if (!bp.overviewActionIds?.length) return bp;
  const ids = new Set(bp.overviewActionIds);
  const overviewActions = bp.actions.filter((a) => ids.has(a.id));

  // For each phase, remap the substep orders that appear in the overview to 0-based contiguous
  const phaseOrderRemap = new Map<string, Map<number, number>>();
  for (const phase of bp.phases) {
    const inPhase = overviewActions.filter((a) => a.phaseId === phase.id);
    if (inPhase.length === 0) continue;
    const uniqueOrders = [...new Set(inPhase.map((a) => a.order))].sort((a, b) => a - b);
    const remap = new Map<number, number>();
    uniqueOrders.forEach((orig, newIdx) => remap.set(orig, newIdx));
    phaseOrderRemap.set(phase.id, remap);
  }

  const normalizedActions = overviewActions.map((a) => {
    const remap = phaseOrderRemap.get(a.phaseId);
    if (!remap) return a;
    return { ...a, order: remap.get(a.order) ?? 0 };
  });

  // Keep only phases that have overview actions; renumber orders and set substepCount
  const phasesWithActions = new Set(phaseOrderRemap.keys());
  const sortedOrigPhases = [...bp.phases].sort((a, b) => a.order - b.order);
  let newPhaseOrder = 0;
  const overviewPhases = sortedOrigPhases
    .filter((p) => phasesWithActions.has(p.id))
    .map((p) => ({
      ...p,
      order: newPhaseOrder++,
      substepCount: phaseOrderRemap.get(p.id)!.size,
    }));

  return { ...bp, actions: normalizedActions, phases: overviewPhases };
}

// Suppression window: after exiting overview, ignore zoom-threshold re-entry for 2 seconds.
// Module-level so it can be read from BlueprintCanvas without prop drilling.
let overviewSuppressUntil = 0;
export function isOverviewSuppressed(): boolean {
  return Date.now() < overviewSuppressUntil;
}

function nextColor(actors: Actor[]): string {
  const palette = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];
  return palette[actors.length % palette.length];
}

function updatedAt(bp: Blueprint): Blueprint {
  return { ...bp, updatedAt: new Date().toISOString() };
}

// Singleton promise for the post-auth boot sequence. Hoisted to module scope so both
// the store's signOut action and the module-level SIGNED_OUT handler can reset it.
let _bootPromise: Promise<void> | null = null;

export const useBlueprintStore = create<AppState>()(
  subscribeWithSelector((set, get) => {

    // ─── Version-aware helpers ──────────────────────────────────────────────
    // Read effective content (from active version or base)
    const vRead = (): { actions: Action[]; painPoints: PainPoint[]; opportunities: Opportunity[]; questions: Question[] } => {
      const { blueprint, activeVersionId } = get();
      if (!blueprint) return { actions: [], painPoints: [], opportunities: [], questions: [] };
      if (!activeVersionId) return {
        actions: blueprint.actions,
        painPoints: blueprint.painPoints,
        opportunities: blueprint.opportunities,
        questions: blueprint.questions ?? [],
      };
      const v = blueprint.versions?.find((v) => v.id === activeVersionId);
      if (!v) return {
        actions: blueprint.actions,
        painPoints: blueprint.painPoints,
        opportunities: blueprint.opportunities,
        questions: blueprint.questions ?? [],
      };
      return { actions: v.actions, painPoints: v.painPoints, opportunities: v.opportunities, questions: v.questions };
    };

    // Write content to active version or base
    const vWrite = (bp: Blueprint, data: ContentData): Blueprint => {
      const { activeVersionId } = get();
      if (!activeVersionId) return { ...bp, ...data };
      return {
        ...bp,
        versions: (bp.versions ?? []).map((v) =>
          v.id === activeVersionId ? { ...v, ...data } : v
        ),
      };
    };

    // Post-auth boot: load blueprints from cloud, then switch to canvas or onboarding
    // Uses the module-level _bootPromise singleton — see declaration above create().
    const completeBoot = (): Promise<void> => {
      if (_bootPromise) return _bootPromise;
      _bootPromise = (async () => {
        try {
          const all = await fetchBlueprintsFromCloud();
          const bps = Object.values(all).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          if (bps.length > 0) {
            // Prefer the last-used blueprint (CURRENT_KEY in localStorage)
            const saved = loadBlueprint();
            const bp = saved ?? bps[0];
            get().setBlueprint(bp);
            setTimeout(() => useBlueprintStore.getState().loadGuestComments(), 0);
          } else {
            set({ mode: 'onboarding' });
          }
        } catch (err) {
          console.error('[boot] completeBoot failed:', err);
          _bootPromise = null; // Allow retry after error
          set({ mode: 'onboarding' });
        }
      })();
      return _bootPromise;
    };

    // Push current blueprint to undo stack before a mutation; clears redo stack
    const pushHistory = () => {
      const { blueprint, undoStack } = get();
      if (!blueprint) return;
      set({ undoStack: [...undoStack, blueprint].slice(-50), redoStack: [] });
    };

    // Compute layout using active version's data and save
    const apply = (bp: Blueprint) => {
      const { activeVersionId, overviewMode } = get();
      const effectiveBp = getBlueprintForVersion(bp, activeVersionId);
      const displayBp = overviewMode ? buildOverviewBlueprint(effectiveBp) : effectiveBp;
      const { nodes, edges } = blueprintToFlow(displayBp, { overviewMode });
      saveBlueprint(bp);
      set({ blueprint: bp, rfNodes: nodes, rfEdges: edges });
    };

    return {
      mode: 'auth',
      canvasView: 'edit',
      userId: null,
      userEmail: null,
      pendingMigration: null,
      isGuestView: false,
      guestCanComment: false,
      guestName: null,
      guestSessionId: '',
      guestShareId: null,
      guestBlueprintRowId: null,
      shareToken: null,
      blueprint: null,
      rfNodes: [],
      rfEdges: [],
      selectedNodeId: null,
      inspectorOpen: false,
      inspectorRequestedTab: null,
      selectedActorId: null,
      actorPanelOpen: false,
      selectedPhaseId: null,
      phaseInspectorOpen: false,
      dragTarget: null,
      draggingNodeId: null,
      actorDragOffset: null,
      phaseDragOffset: null,
      selectedEdgeId: null,
      edgeInspectorOpen: false,
      theme: (localStorage.getItem('theme') as Theme) ?? 'light',
      activeVersionId: null,
      compareMode: false,
      compareVersionIds: [null, null],
      compareSyncViewport: true,
      presentMode: false,
      presentationEditMode: false,
      activePresentationId: null,
      currentKeyframeIndex: 0,
      lightboxUrl: null,
      dragOverInserterId: null,
      selectedColumnKey: null,
      multiSelectedNodeIds: [],
      overviewMode: false,
      overviewGenerating: false,
      selectedOverviewCell: null,
      overviewCellGenerating: false,
      storyboardMode: false,
      storyboardGenerating: false,
      storyboardGeneratingFrameId: null,
      activeStoryboardId: null,
      actorPortraitGenerating: null,
      undoStack: [],
      redoStack: [],

      setMode: (mode) => set({ mode }),

      undo: () => {
        const { undoStack, blueprint } = get();
        if (undoStack.length === 0 || !blueprint) return;
        const prev = undoStack[undoStack.length - 1];
        const newRedoStack = [blueprint, ...get().redoStack].slice(0, 50);
        set({ undoStack: undoStack.slice(0, -1), redoStack: newRedoStack });
        apply(prev);
      },

      redo: () => {
        const { redoStack, blueprint } = get();
        if (redoStack.length === 0 || !blueprint) return;
        const next = redoStack[0];
        const newUndoStack = [...get().undoStack, blueprint].slice(-50);
        set({ undoStack: newUndoStack, redoStack: redoStack.slice(1) });
        apply(next);
      },

      setCanvasView: (canvasView) => set({ canvasView }),

      setBlueprint: (blueprint) => {
        const versionId = blueprint.activeVersionId ?? null;
        const effectiveBp = getBlueprintForVersion(blueprint, versionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(blueprint);
        set({ blueprint, rfNodes: nodes, rfEdges: edges, mode: 'canvas', activeVersionId: versionId, overviewMode: false });
      },

      loadAllBlueprints: () => loadAllBlueprints(),

      startFromScratch: () => {
        const bp: Blueprint = {
          id: `bp-${Date.now()}`,
          name: 'Untitled Service',
          actors: [
            { id: 'actor-1', name: 'Customer', color: '#3B82F6', order: 0 },
          ],
          phases: [
            { id: 'phase-1', name: 'Phase 1', order: 0 },
          ],
          actions: [],
          touchpoints: [],
          painPoints: [],
          opportunities: [],
          questions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const { nodes, edges } = blueprintToFlow(bp);
        saveBlueprint(bp);
        set({
          blueprint: bp, rfNodes: nodes, rfEdges: edges, mode: 'canvas', activeVersionId: null,
          selectedNodeId: null, inspectorOpen: false,
          selectedActorId: null, actorPanelOpen: false,
          selectedPhaseId: null, phaseInspectorOpen: false,
          selectedEdgeId: null, edgeInspectorOpen: false,
          compareMode: false, compareVersionIds: [null, null] as [null, null],
          presentMode: false, presentationEditMode: false,
          activePresentationId: null, currentKeyframeIndex: 0,
          storyboardMode: false,
          overviewMode: false, selectedOverviewCell: null,
          multiSelectedNodeIds: [], selectedColumnKey: null,
          undoStack: [], redoStack: [],
        });
      },

      setUser: (userId, userEmail) => {
        set({ userId, userEmail });
        // Async bootstrap: check for migration, then load from cloud
        (async () => {
          try {
            const toMigrate = await migrateLocalBlueprints();
            if (toMigrate.length > 0) {
              set({ pendingMigration: toMigrate }); // stay in 'auth' — AuthScreen shows prompt
              return;
            }
            await completeBoot();
          } catch (err) {
            console.error('[boot] setUser bootstrap failed:', err);
            set({ mode: 'onboarding' });
          }
        })();
      },

      signOut: async () => {
        await authSignOut();
        _bootPromise = null; // Reset so next login boots fresh
        set({ mode: 'auth', userId: null, userEmail: null, pendingMigration: null, blueprint: null,
          rfNodes: [], rfEdges: [], activeVersionId: null });
      },

      confirmMigration: async () => {
        const { pendingMigration } = get();
        if (pendingMigration && pendingMigration.length > 0) {
          await importBlueprintsToCloud(pendingMigration);
        }
        set({ pendingMigration: null });
        await completeBoot();
      },

      skipMigration: async () => {
        set({ pendingMigration: null });
        await completeBoot();
      },

      loadBlueprintByShareToken: async (token) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-shared-blueprint', {
            body: { token },
          });
          if (error || !data?.blueprint) return;
          const bp = data.blueprint as Blueprint;
          const { nodes, edges } = blueprintToFlow(bp);
          const sessionId = sessionStorage.getItem('guest-session-id') ||
            `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem('guest-session-id', sessionId);
          const storedName = sessionStorage.getItem('guest-name') || null;
          set({
            blueprint: bp, rfNodes: nodes, rfEdges: edges, mode: 'canvas',
            isGuestView: true, shareToken: token,
            guestCanComment: data.canComment ?? true,
            guestShareId: data.shareId ?? null,
            guestBlueprintRowId: data.blueprintRowId ?? null,
            guestSessionId: sessionId, guestName: storedName,
            activeVersionId: bp.activeVersionId ?? null,
          });
          // Load any previously submitted guest comments for this session
          setTimeout(() => useBlueprintStore.getState().loadGuestComments(), 0);
        } catch {
          // Stay in auth mode on failure
        }
      },

      setGuestName: (name) => {
        if (name) sessionStorage.setItem('guest-name', name);
        else sessionStorage.removeItem('guest-name');
        set({ guestName: name });
      },

      addGuestPainPoint: async (actionId, description, severity) => {
        const { blueprint, guestShareId, guestBlueprintRowId, guestSessionId, guestName, activeVersionId } = get();
        if (!blueprint) return;
        const id = `guest-pp-${Date.now()}`;
        const pp: PainPoint = { id, description, severity, actionIds: [actionId], guestContributed: true, guestName: guestName ?? undefined };
        const newBp = {
          ...blueprint,
          painPoints: [...blueprint.painPoints, pp],
          actions: blueprint.actions.map((a) =>
            a.id === actionId ? { ...a, painPointIds: [...a.painPointIds, id] } : a
          ),
        };
        const effectiveBp = getBlueprintForVersion(newBp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges });
        if (guestShareId && guestBlueprintRowId) {
          try {
            await supabase.from('guest_comments').insert({
              share_id: guestShareId, blueprint_id: guestBlueprintRowId,
              type: 'pain', data: pp, guest_name: guestName, guest_session: guestSessionId,
            });
          } catch {}
        }
      },

      addGuestOpportunity: async (actionId, description) => {
        const { blueprint, guestShareId, guestBlueprintRowId, guestSessionId, guestName, activeVersionId } = get();
        if (!blueprint) return;
        const id = `guest-opp-${Date.now()}`;
        const opp: Opportunity = { id, description, actionIds: [actionId], painPointIds: [], guestContributed: true, guestName: guestName ?? undefined };
        const newBp = {
          ...blueprint,
          opportunities: [...blueprint.opportunities, opp],
          actions: blueprint.actions.map((a) =>
            a.id === actionId ? { ...a, opportunityIds: [...a.opportunityIds, id] } : a
          ),
        };
        const effectiveBp = getBlueprintForVersion(newBp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges });
        if (guestShareId && guestBlueprintRowId) {
          try {
            await supabase.from('guest_comments').insert({
              share_id: guestShareId, blueprint_id: guestBlueprintRowId,
              type: 'opportunity', data: opp, guest_name: guestName, guest_session: guestSessionId,
            });
          } catch {}
        }
      },

      addGuestQuestion: async (actionId, text) => {
        const { blueprint, guestShareId, guestBlueprintRowId, guestSessionId, guestName, activeVersionId } = get();
        if (!blueprint) return;
        const id = `guest-q-${Date.now()}`;
        const q: Question = { id, text, actionIds: [actionId], guestContributed: true, guestName: guestName ?? undefined };
        const newBp = {
          ...blueprint,
          questions: [...(blueprint.questions ?? []), q],
          actions: blueprint.actions.map((a) =>
            a.id === actionId ? { ...a, questionIds: [...(a.questionIds ?? []), id] } : a
          ),
        };
        const effectiveBp = getBlueprintForVersion(newBp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges });
        if (guestShareId && guestBlueprintRowId) {
          try {
            await supabase.from('guest_comments').insert({
              share_id: guestShareId, blueprint_id: guestBlueprintRowId,
              type: 'question', data: q, guest_name: guestName, guest_session: guestSessionId,
            });
          } catch {}
        }
      },

      loadGuestComments: async () => {
        const { blueprint, isGuestView, activeVersionId } = get();
        if (!blueprint) return;

        if (isGuestView) {
          // In guest view: load only this session's comments (anon insert only; can't SELECT normally)
          // Comments from this session are already in-memory; just re-merge from sessionStorage if needed.
          return;
        }

        // Owner: load all guest comments for this blueprint via foreign key join
        try {
          const { data } = await supabase
            .from('blueprints')
            .select('id, guest_comments!blueprint_id(type, data, guest_name, guest_session)')
            .eq('data->>id', blueprint.id)
            .maybeSingle();

          if (!data?.guest_comments?.length) return;

          type GuestRow = { type: 'pain' | 'opportunity' | 'question'; data: PainPoint | Opportunity | Question; guest_name: string | null; guest_session: string };
          const rows = data.guest_comments as GuestRow[];

          let newBp = { ...blueprint };
          for (const row of rows) {
            const item = { ...row.data, guestContributed: true as const, guestName: row.guest_name ?? undefined };
            if (row.type === 'pain') {
              const pp = item as PainPoint;
              if (!newBp.painPoints.find((p) => p.id === pp.id)) {
                newBp = {
                  ...newBp,
                  painPoints: [...newBp.painPoints, pp],
                  actions: newBp.actions.map((a) =>
                    pp.actionIds.includes(a.id) && !a.painPointIds.includes(pp.id)
                      ? { ...a, painPointIds: [...a.painPointIds, pp.id] }
                      : a
                  ),
                };
              }
            } else if (row.type === 'opportunity') {
              const opp = item as Opportunity;
              if (!newBp.opportunities.find((o) => o.id === opp.id)) {
                newBp = {
                  ...newBp,
                  opportunities: [...newBp.opportunities, opp],
                  actions: newBp.actions.map((a) =>
                    opp.actionIds.includes(a.id) && !a.opportunityIds.includes(opp.id)
                      ? { ...a, opportunityIds: [...a.opportunityIds, opp.id] }
                      : a
                  ),
                };
              }
            } else if (row.type === 'question') {
              const q = item as Question;
              if (!(newBp.questions ?? []).find((qe) => qe.id === q.id)) {
                newBp = {
                  ...newBp,
                  questions: [...(newBp.questions ?? []), q],
                  actions: newBp.actions.map((a) =>
                    q.actionIds.includes(a.id) && !(a.questionIds ?? []).includes(q.id)
                      ? { ...a, questionIds: [...(a.questionIds ?? []), q.id] }
                      : a
                  ),
                };
              }
            }
          }

          const effectiveBp = getBlueprintForVersion(newBp, activeVersionId);
          const { nodes, edges } = blueprintToFlow(effectiveBp);
          set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges });
        } catch {}
      },

      switchToBlueprint: (id) => {
        const bp = switchBlueprint(id);
        if (!bp) return;
        const versionId = bp.activeVersionId ?? null;
        const effectiveBp = getBlueprintForVersion(bp, versionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        set({
          blueprint: bp, rfNodes: nodes, rfEdges: edges, mode: 'canvas',
          selectedNodeId: null, inspectorOpen: false,
          activeVersionId: versionId, compareMode: false, presentMode: false,
          presentationEditMode: false, activePresentationId: null, currentKeyframeIndex: 0,
          overviewMode: false,
        });
        setTimeout(() => useBlueprintStore.getState().loadGuestComments(), 0);
      },

      // ─── Action mutations ──────────────────────────────────────────────────

      updateAction: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, { actions: eff.actions.map((a) => a.id === id ? { ...a, ...patch } : a) })));
      },

      addAction: (actorId, phaseId, order) => {
        const { blueprint, activeVersionId } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `act-${Date.now()}`;
        const newAction: Action = { id, actorId, phaseId, order, label: 'New step', touchpointIds: [], painPointIds: [], opportunityIds: [], questionIds: [] };
        const eff = vRead();
        const bp = updatedAt(vWrite(blueprint, { actions: [...eff.actions, newAction] }));
        const effectiveBp = getBlueprintForVersion(bp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(bp);
        set({ blueprint: bp, rfNodes: nodes, rfEdges: edges, selectedNodeId: id, inspectorOpen: true });
      },

      removeAction: (id) => {
        const { blueprint, selectedNodeId, activeVersionId } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        const painIdsToRemove = eff.painPoints
          .filter((p) => p.actionIds.length === 1 && p.actionIds[0] === id)
          .map((p) => p.id);
        const oppIdsToRemove = eff.opportunities
          .filter((o) => o.actionIds.length === 1 && o.actionIds[0] === id)
          .map((o) => o.id);
        const qIdsToRemove = eff.questions
          .filter((q) => q.actionIds.length === 1 && q.actionIds[0] === id)
          .map((q) => q.id);
        const bp = updatedAt(vWrite(blueprint, {
          actions: eff.actions.filter((a) => a.id !== id),
          painPoints: eff.painPoints.filter((p) => !painIdsToRemove.includes(p.id)),
          opportunities: eff.opportunities.filter((o) => !oppIdsToRemove.includes(o.id)),
          questions: eff.questions.filter((q) => !qIdsToRemove.includes(q.id)),
        }));
        // Also clean up custom edges (these live on base blueprint, not versioned)
        const cleanedBp = {
          ...bp,
          customEdges: (bp.customEdges ?? []).filter(
            (e) => e.sourceActionId !== id && e.targetActionId !== id
          ),
        };
        const effectiveBp = getBlueprintForVersion(cleanedBp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(cleanedBp);
        set({
          blueprint: cleanedBp,
          rfNodes: nodes,
          rfEdges: edges,
          ...(selectedNodeId === id ? { selectedNodeId: null, inspectorOpen: false } : {}),
        });
      },

      insertSubstep: (phaseId, atOrder) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const { phaseColumns } = computeColumnData(blueprint);
        const currentCount = phaseColumns.get(phaseId)?.colCount ?? 1;
        const eff = vRead();
        const bp = updatedAt(vWrite({
          ...blueprint,
          phases: blueprint.phases.map((p) =>
            p.id === phaseId ? { ...p, substepCount: currentCount + 1 } : p
          ),
        }, {
          actions: eff.actions.map((a) =>
            a.phaseId === phaseId && a.order >= atOrder ? { ...a, order: a.order + 1 } : a
          ),
        }));
        apply(bp);
      },

      // ─── Pain points ────────────────────────────────────────────────────────

      addPainPoint: (actionId, description, severity) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `pp-${Date.now()}`;
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          painPoints: [...eff.painPoints, { id, description, severity, actionIds: [actionId] }],
          actions: eff.actions.map((a) =>
            a.id === actionId ? { ...a, painPointIds: [...a.painPointIds, id] } : a
          ),
        })));
      },

      updatePainPoint: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, { painPoints: eff.painPoints.map((p) => {
          if (p.id !== id) return p;
          const { aiGenerated: _, ...merged } = { ...p, ...patch };
          return merged;
        }) })));
      },

      removePainPoint: (id) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          painPoints: eff.painPoints.filter((p) => p.id !== id),
          actions: eff.actions.map((a) => ({ ...a, painPointIds: a.painPointIds.filter((x) => x !== id) })),
        })));
      },

      // ─── Opportunities ─────────────────────────────────────────────────────

      addOpportunity: (actionId, description) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `opp-${Date.now()}`;
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          opportunities: [...eff.opportunities, { id, description, actionIds: [actionId], painPointIds: [] }],
          actions: eff.actions.map((a) =>
            a.id === actionId ? { ...a, opportunityIds: [...a.opportunityIds, id] } : a
          ),
        })));
      },

      updateOpportunity: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, { opportunities: eff.opportunities.map((o) => {
          if (o.id !== id) return o;
          const { aiGenerated: _, ...merged } = { ...o, ...patch };
          return merged;
        }) })));
      },

      removeOpportunity: (id) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          opportunities: eff.opportunities.filter((o) => o.id !== id),
          actions: eff.actions.map((a) => ({ ...a, opportunityIds: a.opportunityIds.filter((x) => x !== id) })),
        })));
      },

      // ─── Questions ─────────────────────────────────────────────────────────

      addQuestion: (actionId, text) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `q-${Date.now()}`;
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          questions: [...eff.questions, { id, text, actionIds: [actionId] }],
          actions: eff.actions.map((a) =>
            a.id === actionId ? { ...a, questionIds: [...(a.questionIds ?? []), id] } : a
          ),
        })));
      },

      updateQuestion: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, { questions: eff.questions.map((q) => {
          if (q.id !== id) return q;
          const { aiGenerated: _, ...merged } = { ...q, ...patch };
          return merged;
        }) })));
      },

      removeQuestion: (id) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          questions: eff.questions.filter((q) => q.id !== id),
          actions: eff.actions.map((a) => ({ ...a, questionIds: (a.questionIds ?? []).filter((x) => x !== id) })),
        })));
      },

      // ─── Actors / Phases ───────────────────────────────────────────────────

      addActor: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const newActor: Actor = { id: `actor-${Date.now()}`, name, color: nextColor(blueprint.actors), order: blueprint.actors.length };
        apply(updatedAt({ ...blueprint, actors: [...blueprint.actors, newActor] }));
      },

      updateActor: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        apply(updatedAt({ ...blueprint, actors: blueprint.actors.map((a) => a.id === id ? { ...a, ...patch } : a) }));
      },

      removeActor: (id) => {
        const { blueprint, selectedActorId } = get();
        const activeVersionId = get().activeVersionId;
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        const actorActionIds = eff.actions.filter((a) => a.actorId === id).map((a) => a.id);
        const actorActionIdSet = new Set(actorActionIds);
        // Remove pain points, opps, questions that only belong to this actor's actions
        const newPainPoints = eff.painPoints.filter((p) => !p.actionIds.every((aid) => actorActionIdSet.has(aid)));
        const cleanedPainPoints = newPainPoints.map((p) => ({ ...p, actionIds: p.actionIds.filter((aid) => !actorActionIdSet.has(aid)) }));
        const newOpps = eff.opportunities.filter((o) => !o.actionIds.every((aid) => actorActionIdSet.has(aid)));
        const cleanedOpps = newOpps.map((o) => ({ ...o, actionIds: o.actionIds.filter((aid) => !actorActionIdSet.has(aid)) }));
        const newQuestions = eff.questions.filter((q) => !q.actionIds.every((aid) => actorActionIdSet.has(aid)));
        const cleanedQuestions = newQuestions.map((q) => ({ ...q, actionIds: q.actionIds.filter((aid) => !actorActionIdSet.has(aid)) }));
        const bp = updatedAt(vWrite({
          ...blueprint,
          actors: blueprint.actors.filter((a) => a.id !== id),
          customEdges: (blueprint.customEdges ?? []).filter(
            (e) => !actorActionIdSet.has(e.sourceActionId) && !actorActionIdSet.has(e.targetActionId)
          ),
        }, {
          actions: eff.actions.filter((a) => a.actorId !== id),
          painPoints: cleanedPainPoints,
          opportunities: cleanedOpps,
          questions: cleanedQuestions,
        }));
        const effectiveBp = getBlueprintForVersion(bp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(bp);
        set({
          blueprint: bp,
          rfNodes: nodes,
          rfEdges: edges,
          ...(selectedActorId === id ? { selectedActorId: null, actorPanelOpen: false } : {}),
        });
      },

      moveActor: (id, direction) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const sorted = [...blueprint.actors].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((a) => a.id === id);
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= sorted.length) return;
        const actor = sorted[idx];
        const target = sorted[targetIdx];
        apply(updatedAt({
          ...blueprint,
          actors: blueprint.actors.map((a) =>
            a.id === actor.id ? { ...a, order: target.order }
            : a.id === target.id ? { ...a, order: actor.order }
            : a
          ),
        }));
      },

      addPhase: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const newPhase: Phase = { id: `phase-${Date.now()}`, name, order: blueprint.phases.length };
        apply(updatedAt({ ...blueprint, phases: [...blueprint.phases, newPhase] }));
      },

      updatePhase: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        apply(updatedAt({ ...blueprint, phases: blueprint.phases.map((p) => p.id === id ? { ...p, ...patch } : p) }));
      },

      removePhase: (id) => {
        const { blueprint, selectedPhaseId } = get();
        const activeVersionId = get().activeVersionId;
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        const phaseActionIds = eff.actions.filter((a) => a.phaseId === id).map((a) => a.id);
        const phaseActionIdSet = new Set(phaseActionIds);
        const newPainPoints = eff.painPoints.filter((p) => !p.actionIds.every((aid) => phaseActionIdSet.has(aid)));
        const cleanedPainPoints = newPainPoints.map((p) => ({ ...p, actionIds: p.actionIds.filter((aid) => !phaseActionIdSet.has(aid)) }));
        const newOpps = eff.opportunities.filter((o) => !o.actionIds.every((aid) => phaseActionIdSet.has(aid)));
        const cleanedOpps = newOpps.map((o) => ({ ...o, actionIds: o.actionIds.filter((aid) => !phaseActionIdSet.has(aid)) }));
        const newQuestions = eff.questions.filter((q) => !q.actionIds.every((aid) => phaseActionIdSet.has(aid)));
        const cleanedQuestions = newQuestions.map((q) => ({ ...q, actionIds: q.actionIds.filter((aid) => !phaseActionIdSet.has(aid)) }));
        const bp = updatedAt(vWrite({
          ...blueprint,
          phases: blueprint.phases.filter((p) => p.id !== id),
          customEdges: (blueprint.customEdges ?? []).filter(
            (e) => !phaseActionIdSet.has(e.sourceActionId) && !phaseActionIdSet.has(e.targetActionId)
          ),
        }, {
          actions: eff.actions.filter((a) => a.phaseId !== id),
          painPoints: cleanedPainPoints,
          opportunities: cleanedOpps,
          questions: cleanedQuestions,
        }));
        const effectiveBp = getBlueprintForVersion(bp, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(bp);
        set({
          blueprint: bp,
          rfNodes: nodes,
          rfEdges: edges,
          ...(selectedPhaseId === id ? { selectedPhaseId: null, phaseInspectorOpen: false } : {}),
        });
      },

      movePhase: (id, direction) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const sorted = [...blueprint.phases].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((p) => p.id === id);
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= sorted.length) return;
        const phase = sorted[idx];
        const target = sorted[targetIdx];
        apply(updatedAt({
          ...blueprint,
          phases: blueprint.phases.map((p) =>
            p.id === phase.id ? { ...p, order: target.order }
            : p.id === target.id ? { ...p, order: phase.order }
            : p
          ),
        }));
      },

      movePhaseBoundary: (leftPhaseId, rightPhaseId, direction) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const { phaseColumns } = computeColumnData(blueprint);
        const leftCol = phaseColumns.get(leftPhaseId);
        const rightCol = phaseColumns.get(rightPhaseId);
        if (!leftCol || !rightCol) return;
        const eff = vRead();

        if (direction === 'left') {
          const maxLeftOrder = leftCol.colCount - 1;
          if (leftCol.colCount <= 1) return;
          apply(updatedAt(vWrite({
            ...blueprint,
            phases: blueprint.phases.map((p) =>
              p.id === leftPhaseId ? { ...p, substepCount: leftCol.colCount - 1 }
              : p.id === rightPhaseId ? { ...p, substepCount: rightCol.colCount + 1 }
              : p
            ),
          }, {
            actions: eff.actions.map((a) => {
              if (a.phaseId === leftPhaseId && a.order === maxLeftOrder)
                return { ...a, phaseId: rightPhaseId, order: 0 };
              if (a.phaseId === rightPhaseId)
                return { ...a, order: a.order + 1 };
              return a;
            }),
          })));
        } else {
          if (rightCol.colCount <= 1) return;
          const newLeftOrder = leftCol.colCount;
          apply(updatedAt(vWrite({
            ...blueprint,
            phases: blueprint.phases.map((p) =>
              p.id === leftPhaseId ? { ...p, substepCount: leftCol.colCount + 1 }
              : p.id === rightPhaseId ? { ...p, substepCount: rightCol.colCount - 1 }
              : p
            ),
          }, {
            actions: eff.actions.map((a) => {
              if (a.phaseId === rightPhaseId && a.order === 0)
                return { ...a, phaseId: leftPhaseId, order: newLeftOrder };
              if (a.phaseId === rightPhaseId && a.order > 0)
                return { ...a, order: a.order - 1 };
              return a;
            }),
          })));
        }
      },

      // ─── Edges (always on base blueprint, not versioned) ───────────────────

      updateEdgeMeta: (edgeId, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const current = blueprint.edgeMeta?.[edgeId] ?? {};
        const next = { ...current, ...patch };
        apply(updatedAt({ ...blueprint, edgeMeta: { ...(blueprint.edgeMeta ?? {}), [edgeId]: next } }));
      },

      removeEdge: (edgeId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const isCustom = (blueprint.customEdges ?? []).some((e) => e.id === edgeId);
        if (isCustom) {
          apply(updatedAt({ ...blueprint, customEdges: (blueprint.customEdges ?? []).filter((e) => e.id !== edgeId) }));
        } else {
          const existing = blueprint.removedEdgeIds ?? [];
          if (existing.includes(edgeId)) return;
          apply(updatedAt({ ...blueprint, removedEdgeIds: [...existing, edgeId] }));
        }
      },

      addCustomEdge: (sourceActionId, targetActionId, sourceHandle, targetHandle) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `custom-${sourceActionId}-${targetActionId}-${Date.now()}`;
        const ce: CustomEdge = { id, sourceActionId, targetActionId, sourceHandle, targetHandle };
        apply(updatedAt({ ...blueprint, customEdges: [...(blueprint.customEdges ?? []), ce] }));
      },

      // ─── Touchpoint tags ────────────────────────────────────────────────────

      addTouchpointTag: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = blueprint.touchpointTags ?? [];
        if (existing.includes(trimmed)) return;
        apply(updatedAt({ ...blueprint, touchpointTags: [...existing, trimmed] }));
      },

      removeTouchpointTag: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite({
          ...blueprint,
          touchpointTags: (blueprint.touchpointTags ?? []).filter((t) => t !== name),
        }, {
          actions: eff.actions.map((a) => ({
            ...a,
            touchpointLabels: (a.touchpointLabels ?? []).filter((t) => t !== name),
          })),
        })));
      },

      toggleActionTouchpointLabel: (actionId, tag) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          actions: eff.actions.map((a) => {
            if (a.id !== actionId) return a;
            const labels = a.touchpointLabels ?? [];
            return {
              ...a,
              touchpointLabels: labels.includes(tag)
                ? labels.filter((t) => t !== tag)
                : [...labels, tag],
            };
          }),
        })));
      },

      // ─── Versions ──────────────────────────────────────────────────────────

      createVersion: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        const id = `ver-${Date.now()}`;
        const newVersion: BlueprintVersion = {
          id,
          name,
          actions: [...eff.actions],
          painPoints: [...eff.painPoints],
          opportunities: [...eff.opportunities],
          questions: [...eff.questions],
        };
        const newBp = updatedAt({ ...blueprint, versions: [...(blueprint.versions ?? []), newVersion], activeVersionId: id });
        const effectiveBp = getBlueprintForVersion(newBp, id);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(newBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges, activeVersionId: id });
      },

      switchVersion: (versionId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const effectiveBp = getBlueprintForVersion(blueprint, versionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        const newBp = { ...blueprint, activeVersionId: versionId };
        saveBlueprint(newBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges, activeVersionId: versionId });
      },

      deleteVersion: (versionId) => {
        const { blueprint, activeVersionId, compareVersionIds } = get();
        if (!blueprint) return;
        pushHistory();
        const newVersions = (blueprint.versions ?? []).filter((v) => v.id !== versionId);
        const newActiveId = activeVersionId === versionId ? null : activeVersionId;
        const newCompareIds: [string | null, string | null] = [
          compareVersionIds[0] === versionId ? null : compareVersionIds[0],
          compareVersionIds[1] === versionId ? null : compareVersionIds[1],
        ];
        const newBp = updatedAt({ ...blueprint, versions: newVersions, activeVersionId: newActiveId });
        const effectiveBp = getBlueprintForVersion(newBp, newActiveId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        saveBlueprint(newBp);
        set({ blueprint: newBp, rfNodes: nodes, rfEdges: edges, activeVersionId: newActiveId, compareVersionIds: newCompareIds });
      },

      renameVersion: (versionId, name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        const newVersions = (blueprint.versions ?? []).map((v) => v.id === versionId ? { ...v, name: trimmed } : v);
        const newBp = updatedAt({ ...blueprint, versions: newVersions });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      // ─── UI ────────────────────────────────────────────────────────────────

      setSelectedNode: (id) => set({ selectedNodeId: id, inspectorOpen: id !== null, inspectorRequestedTab: null, selectedActorId: null, actorPanelOpen: false, selectedPhaseId: null, phaseInspectorOpen: false }),
      openInspectorToTab: (id, tab) => set({ selectedNodeId: id, inspectorOpen: true, inspectorRequestedTab: tab, selectedActorId: null, actorPanelOpen: false, selectedPhaseId: null, phaseInspectorOpen: false }),
      clearInspectorRequestedTab: () => set({ inspectorRequestedTab: null }),

      animateToNode: (actionId) => {
        const node = get().rfNodes.find((n) => n.id === `action-${actionId}`);
        if (!node) return;
        const cx = node.position.x + ACTION_NODE_WIDTH / 2;
        const cy = node.position.y + estimateActionHeight(node.data?.action as Action) / 2;
        centerOnPoint(cx, cy, undefined, 350);
      },

      setInspectorOpen: (open) => set({ inspectorOpen: open }),

      setSelectedActor: (id) => set({ selectedActorId: id, actorPanelOpen: id !== null, selectedNodeId: null, inspectorOpen: false, selectedPhaseId: null, phaseInspectorOpen: false }),

      setSelectedPhase: (id) => set({ selectedPhaseId: id, phaseInspectorOpen: id !== null, selectedNodeId: null, inspectorOpen: false, selectedActorId: null, actorPanelOpen: false }),

      setDragTarget: (target) => set({ dragTarget: target }),

      setDraggingNode: (id) => set({ draggingNodeId: id }),

      setActorDragOffset: (offset) => set({ actorDragOffset: offset }),

      setPhaseDragOffset: (offset) => set({ phaseDragOffset: offset }),

      setSelectedEdge: (id) => set({ selectedEdgeId: id, edgeInspectorOpen: id !== null }),

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', next);
        set({ theme: next });
      },

      togglePresentMode: () => set({ presentMode: !get().presentMode }),

      toggleCompareMode: () => set({ compareMode: !get().compareMode }),

      setPresentationEditMode: (on) => {
        if (on) {
          // Auto-create a presentation if none exist
          const { blueprint } = get();
          if (blueprint && !(blueprint.presentations ?? []).length) {
            const id = `pres-${Date.now()}`;
            const newPres: Presentation = { id, name: 'Untitled', keyframes: [] };
            const newBp = updatedAt({ ...blueprint, presentations: [newPres] });
            saveBlueprint(newBp);
            set({ blueprint: newBp, presentationEditMode: true, presentMode: false, activePresentationId: id });
          } else {
            const firstId = (blueprint?.presentations ?? [])[0]?.id ?? null;
            set({ presentationEditMode: true, presentMode: false, activePresentationId: get().activePresentationId ?? firstId });
          }
        } else {
          set({ presentationEditMode: false });
        }
      },

      setCurrentKeyframeIndex: (idx) => set({ currentKeyframeIndex: idx }),

      createPresentation: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const id = `pres-${Date.now()}`;
        const newPres: Presentation = { id, name, keyframes: [] };
        const newBp = updatedAt({ ...blueprint, presentations: [...(blueprint.presentations ?? []), newPres] });
        saveBlueprint(newBp);
        set({ blueprint: newBp, activePresentationId: id });
      },

      deletePresentation: (id) => {
        const { blueprint, activePresentationId } = get();
        if (!blueprint) return;
        const remaining = (blueprint.presentations ?? []).filter((p) => p.id !== id);
        const newBp = updatedAt({ ...blueprint, presentations: remaining });
        saveBlueprint(newBp);
        const nextId = activePresentationId === id ? (remaining[0]?.id ?? null) : activePresentationId;
        set({ blueprint: newBp, activePresentationId: nextId });
      },

      renamePresentation: (id, name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          presentations: (blueprint.presentations ?? []).map((p) => p.id === id ? { ...p, name } : p),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      setActivePresentationId: (id) => set({ activePresentationId: id }),

      addKeyframe: (presentationId, data) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const kf: PresentationKeyframe = { id: `kf-${Date.now()}`, ...data };
        const newBp = updatedAt({
          ...blueprint,
          presentations: (blueprint.presentations ?? []).map((p) =>
            p.id === presentationId ? { ...p, keyframes: [...p.keyframes, kf] } : p
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      applyKeyframeState: (kf) => {
        const { blueprint, activeVersionId } = get();
        if (!blueprint) return;

        const updates: Partial<AppState> = {
          canvasView: kf.canvasView ?? 'edit',
          selectedNodeId: kf.selectedNodeId ?? null,
          inspectorOpen: !!kf.selectedNodeId,
          actorPanelOpen: false,
          selectedActorId: null,
          selectedEdgeId: null,
          edgeInspectorOpen: false,
          compareMode: kf.compareMode ?? false,
          compareVersionIds: kf.compareVersionIds ?? [null, null],
        };

        // Switch version if keyframe specifies one
        const targetVersionId = kf.versionId !== undefined ? kf.versionId : activeVersionId;
        if (targetVersionId !== activeVersionId) {
          const effectiveBp = getBlueprintForVersion(blueprint, targetVersionId);
          const { nodes, edges } = blueprintToFlow(effectiveBp);
          const newBp = { ...blueprint, activeVersionId: targetVersionId };
          saveBlueprint(newBp);
          updates.blueprint = newBp as Blueprint;
          updates.rfNodes = nodes;
          updates.rfEdges = edges;
          updates.activeVersionId = targetVersionId ?? null;
        }

        set(updates as Partial<AppState>);
      },

      updateKeyframe: (presentationId, keyframeId, updates) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          presentations: (blueprint.presentations ?? []).map((p) =>
            p.id === presentationId
              ? { ...p, keyframes: p.keyframes.map((kf) => kf.id === keyframeId ? { ...kf, ...updates } : kf) }
              : p
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      removeKeyframe: (presentationId, keyframeId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          presentations: (blueprint.presentations ?? []).map((p) =>
            p.id === presentationId
              ? { ...p, keyframes: p.keyframes.filter((kf) => kf.id !== keyframeId) }
              : p
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      reorderKeyframes: (presentationId, fromIdx, toIdx) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          presentations: (blueprint.presentations ?? []).map((p) => {
            if (p.id !== presentationId) return p;
            const kfs = [...p.keyframes];
            const [moved] = kfs.splice(fromIdx, 1);
            kfs.splice(toIdx, 0, moved);
            return { ...p, keyframes: kfs };
          }),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      setCompareVersionIds: (ids) => set({ compareVersionIds: ids }),

      setCompareSyncViewport: (on) => set({ compareSyncViewport: on }),

      refreshLayout: () => {
        const { blueprint, activeVersionId } = get();
        if (!blueprint) return;
        const effectiveBp = getBlueprintForVersion(blueprint, activeVersionId);
        const { nodes, edges } = blueprintToFlow(effectiveBp);
        set({ rfNodes: nodes, rfEdges: edges });
      },

      setLightboxUrl: (url) => set({ lightboxUrl: url }),

      setDragOverInserterId: (id) => set({ dragOverInserterId: id }),

      setSelectedColumnKey: (key) => set({ selectedColumnKey: key }),

      setMultiSelectedNodeIds: (ids) => set({ multiSelectedNodeIds: ids }),

      deleteSubstep: (phaseId, order) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const { phaseColumns } = computeColumnData(blueprint);
        const col = phaseColumns.get(phaseId);
        if (!col || col.colCount <= 1) return;
        const eff = vRead();
        apply(updatedAt(vWrite({
          ...blueprint,
          phases: blueprint.phases.map((p) =>
            p.id === phaseId ? { ...p, substepCount: col.colCount - 1 } : p
          ),
        }, {
          actions: eff.actions
            .filter((a) => !(a.phaseId === phaseId && a.order === order))
            .map((a) => a.phaseId === phaseId && a.order > order ? { ...a, order: a.order - 1 } : a),
        })));
      },

      moveSubstep: (phaseId, fromOrder, direction) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const { phaseColumns } = computeColumnData(blueprint);
        const col = phaseColumns.get(phaseId);
        if (!col) return;
        const toOrder = direction === 'left' ? fromOrder - 1 : fromOrder + 1;
        if (toOrder < 0 || toOrder >= col.colCount) return;
        const eff = vRead();
        apply(updatedAt(vWrite(blueprint, {
          actions: eff.actions.map((a) => {
            if (a.phaseId !== phaseId) return a;
            if (a.order === fromOrder) return { ...a, order: toOrder };
            if (a.order === toOrder) return { ...a, order: fromOrder };
            return a;
          }),
        })));
      },

      renameBlueprint: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const trimmed = name.trim();
        if (!trimmed) return;
        apply(updatedAt({ ...blueprint, name: trimmed }));
      },

      renameBaseVersion: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const trimmed = name.trim();
        if (!trimmed) return;
        apply(updatedAt({ ...blueprint, baseVersionName: trimmed }));
      },

      // ─── Statuses ──────────────────────────────────────────────────────────

      addStatus: (label, color) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const id = `status-${Date.now()}`;
        apply(updatedAt({ ...blueprint, statuses: [...(blueprint.statuses ?? []), { id, label, color }] }));
      },

      updateStatus: (id, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        apply(updatedAt({ ...blueprint, statuses: (blueprint.statuses ?? []).map((s) => s.id === id ? { ...s, ...patch } : s) }));
      },

      removeStatus: (id) => {
        const { blueprint } = get();
        if (!blueprint) return;
        pushHistory();
        const eff = vRead();
        // Clear transitions that reference this status
        const cleanedBp = updatedAt(vWrite({
          ...blueprint,
          statuses: (blueprint.statuses ?? []).filter((s) => s.id !== id),
        }, {
          actions: eff.actions.map((a) => {
            if (!a.statusTransition) return a;
            const { fromStatusId, toStatusId } = a.statusTransition;
            if (fromStatusId !== id && toStatusId !== id) return a;
            const cleaned = {
              fromStatusId: fromStatusId === id ? null : fromStatusId,
              toStatusId: toStatusId === id ? null : toStatusId,
            };
            if (cleaned.fromStatusId == null && cleaned.toStatusId == null) {
              const { statusTransition: _, ...rest } = a;
              return rest;
            }
            return { ...a, statusTransition: cleaned };
          }),
        }));
        apply(cleanedBp);
      },

      // ─── Overview / semantic zoom ───────────────────────────────────────────

      setOverviewMode: (on) => {
        overviewSuppressUntil = Date.now() + 2000;
        const { blueprint, activeVersionId } = get();
        if (!blueprint) return;
        const effectiveBp = getBlueprintForVersion(blueprint, activeVersionId);
        const displayBp = on ? buildOverviewBlueprint(effectiveBp) : effectiveBp;
        const { nodes, edges } = blueprintToFlow(displayBp, { overviewMode: on });
        set({ overviewMode: on, rfNodes: nodes, rfEdges: edges, selectedOverviewCell: null });
      },

      generateOverview: async () => {
        const { blueprint } = get();
        if (!blueprint || get().overviewGenerating) return;
        set({ overviewGenerating: true });

        try {
          const actorMap = new Map(blueprint.actors.map((a) => [a.id, a.name]));
          const phaseMap = new Map(blueprint.phases.map((p) => [p.id, p.name]));

          const actionsJson = blueprint.actions.map((a) => ({
            id: a.id,
            actor: actorMap.get(a.actorId) ?? a.actorId,
            phase: phaseMap.get(a.phaseId) ?? a.phaseId,
            order: a.order,
            label: a.label,
            description: a.labelDetailed ?? '',
            painPoints: a.painPointIds.length,
            opportunities: a.opportunityIds.length,
          }));

          const prompt = `You are summarising a service blueprint for a high-level "overview" zoom. Given the following list of service steps, select the most representative 1–2 steps per actor per phase that best capture the key moments of the journey. Prefer steps with pain points or opportunities, as those are most informative. For each selected step also write a concise abstract label of 3–6 words.

Steps:
${JSON.stringify(actionsJson, null, 2)}

Return ONLY a JSON object in this exact format:
{
  "selected": [
    { "id": "<action id>", "labelAbstract": "<3-6 word abstract label>" }
  ]
}`;

          const { data: overviewData, error: overviewError } = await supabase.functions.invoke('ai-overview', {
            body: {
              model: 'claude-sonnet-4-6',
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
            },
          });
          if (overviewError) throw overviewError;

          const overviewContent = (overviewData as { content: Array<{ type: string; text?: string }> }).content;
          const text = overviewContent.find((b) => b.type === 'text');
          if (!text || !text.text) throw new Error('No text response');

          const raw = text.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
          const parsed = JSON.parse(raw) as { selected: { id: string; labelAbstract: string }[] };
          const selectedIds = parsed.selected.map((s) => s.id);

          // Update labelAbstract on the matching actions and save overviewActionIds
          const labelMap = new Map(parsed.selected.map((s) => [s.id, s.labelAbstract]));
          const updatedActions = blueprint.actions.map((a) =>
            labelMap.has(a.id) ? { ...a, labelAbstract: labelMap.get(a.id) ?? a.labelAbstract } : a
          );
          const newBp = updatedAt({ ...blueprint, actions: updatedActions, overviewActionIds: selectedIds });
          saveBlueprint(newBp);
          set({ blueprint: newBp, overviewGenerating: false });

          // Now recompute layout in overview mode
          get().setOverviewMode(true);
        } catch {
          set({ overviewGenerating: false });
        }
      },

      setSelectedOverviewCell: (actorId, phaseId, actionId) => {
        set({ selectedOverviewCell: { actorId, phaseId, actionId } });
        const { blueprint } = get();
        if (!blueprint) return;
        const key = `${actorId}-${phaseId}`;
        if (!blueprint.overviewCellDescriptions?.[key]) {
          get().generateCellDescription(actorId, phaseId);
        }
      },

      clearOverviewCell: () => set({ selectedOverviewCell: null }),

      updateCellDescription: (actorId, phaseId, text) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const key = `${actorId}-${phaseId}`;
        const newBp = updatedAt({
          ...blueprint,
          overviewCellDescriptions: { ...(blueprint.overviewCellDescriptions ?? {}), [key]: text },
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      generateCellDescription: async (actorId, phaseId) => {
        const { blueprint } = get();
        if (!blueprint || get().overviewCellGenerating) return;
        set({ overviewCellGenerating: true });

        try {
          const actor = blueprint.actors.find((a) => a.id === actorId);
          const phase = blueprint.phases.find((p) => p.id === phaseId);
          if (!actor || !phase) { set({ overviewCellGenerating: false }); return; }

          const cellActions = blueprint.actions
            .filter((a) => a.actorId === actorId && a.phaseId === phaseId)
            .sort((a, b) => a.order - b.order);

          const stepsText = cellActions
            .map((a, i) => `${i + 1}. ${a.label}${a.labelDetailed ? ': ' + a.labelDetailed : ''}`)
            .join('\n');

          const prompt = `You are describing a cluster of service steps for a high-level service blueprint overview. Actor: "${actor.name}". Phase: "${phase.name}". Steps in this cell:\n${stepsText}\n\nWrite a 2–3 sentence paragraph describing what this actor is doing during this phase and why it matters. Be concise and professional. Return only the paragraph, no other text.`;

          const { data: cellData, error: cellError } = await supabase.functions.invoke('ai-overview', {
            body: {
              model: 'claude-sonnet-4-6',
              max_tokens: 256,
              messages: [{ role: 'user', content: prompt }],
            },
          });
          if (cellError) throw cellError;

          const cellContent = (cellData as { content: Array<{ type: string; text?: string }> }).content;
          const text = cellContent.find((b) => b.type === 'text');
          if (!text || !text.text) throw new Error('No text response');

          const key = `${actorId}-${phaseId}`;
          const newBp = updatedAt({
            ...blueprint,
            overviewCellDescriptions: { ...(blueprint.overviewCellDescriptions ?? {}), [key]: text.text.trim() },
          });
          saveBlueprint(newBp);
          set({ blueprint: newBp, overviewCellGenerating: false });
        } catch {
          set({ overviewCellGenerating: false });
        }
      },

      // ─── Storyboard ────────────────────────────────────────────────────────

      setStoryboardMode: (on) => {
        set({
          storyboardMode: on,
          ...(on ? { compareMode: false, presentMode: false, presentationEditMode: false, overviewMode: false } : {}),
        });
      },

      createStoryboard: (name) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const id = `sb-${Date.now()}`;
        const sb: Storyboard = {
          id,
          name,
          styleGuide: { baseStyle: 'anime key visual, crisp linework, cel shading, vibrant colors, clean background', characterDescriptions: {} },
          frames: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const newBp = updatedAt({ ...blueprint, storyboards: [...(blueprint.storyboards ?? []), sb] });
        saveBlueprint(newBp);
        set({ blueprint: newBp, activeStoryboardId: id });
      },

      deleteStoryboard: (id) => {
        const { blueprint, activeStoryboardId } = get();
        if (!blueprint) return;
        const newBp = updatedAt({ ...blueprint, storyboards: (blueprint.storyboards ?? []).filter((s) => s.id !== id) });
        saveBlueprint(newBp);
        const newActiveId = activeStoryboardId === id ? ((newBp.storyboards ?? [])[0]?.id ?? null) : activeStoryboardId;
        set({ blueprint: newBp, activeStoryboardId: newActiveId });
      },

      setActiveStoryboard: (id) => set({ activeStoryboardId: id }),

      updateStoryboardFrame: (storyboardId, frameId, patch) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          storyboards: (blueprint.storyboards ?? []).map((s) =>
            s.id === storyboardId
              ? { ...s, frames: s.frames.map((f) => f.id === frameId ? { ...f, ...patch } : f), updatedAt: new Date().toISOString() }
              : s
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      updateStoryboardStyleGuide: (storyboardId, guide) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          storyboards: (blueprint.storyboards ?? []).map((s) => {
            if (s.id !== storyboardId) return s;
            const frames = s.frames.map((f) => ({
              ...f,
              imagePrompt: buildImagePrompt(f, guide, blueprint.actors),
            }));
            return { ...s, styleGuide: guide, frames, updatedAt: new Date().toISOString() };
          }),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      addBlankStoryboardFrame: (storyboardId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const sb = (blueprint.storyboards ?? []).find((s) => s.id === storyboardId);
        if (!sb) return;
        const newFrame: StoryboardFrame = {
          id: `frame-${Date.now()}`,
          order: sb.frames.length,
          sceneDescription: '',
          imagePrompt: '',
          caption: 'New scene',
          phaseIds: [],
          actorIds: blueprint.actors.map((a) => a.id),
          imageUrl: undefined,
        };
        const newBp = updatedAt({
          ...blueprint,
          storyboards: (blueprint.storyboards ?? []).map((s) =>
            s.id === storyboardId
              ? { ...s, frames: [...s.frames, newFrame], updatedAt: new Date().toISOString() }
              : s
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      deleteStoryboardFrame: (storyboardId, frameId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const newBp = updatedAt({
          ...blueprint,
          storyboards: (blueprint.storyboards ?? []).map((s) =>
            s.id === storyboardId
              ? { ...s, frames: s.frames.filter((f) => f.id !== frameId).map((f, i) => ({ ...f, order: i })), updatedAt: new Date().toISOString() }
              : s
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      generateStoryboard: async () => {
        const { blueprint, activeStoryboardId, storyboardGenerating } = get();
        if (!blueprint || storyboardGenerating) return;
        set({ storyboardGenerating: true });

        try {
          // Ensure we have an active storyboard
          let sbId = activeStoryboardId;
          if (!sbId || !(blueprint.storyboards ?? []).find((s) => s.id === sbId)) {
            const id = `sb-${Date.now()}`;
            const newSb: Storyboard = {
              id,
              name: 'Journey Map 1',
              styleGuide: { baseStyle: 'anime key visual, crisp linework, cel shading, vibrant colors, clean background', characterDescriptions: {} },
              frames: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            const initBp = updatedAt({ ...blueprint, storyboards: [...(blueprint.storyboards ?? []), newSb] });
            saveBlueprint(initBp);
            set({ blueprint: initBp, activeStoryboardId: id });
            sbId = id;
          }

          const { blueprint: currentBp } = get();
          if (!currentBp || !sbId) return;
          const sb = (currentBp.storyboards ?? []).find((s) => s.id === sbId)!;

          // 1. Generate style guide (character descriptions)
          const styleGuide = await generateStyleGuide(currentBp, sb.styleGuide.baseStyle);
          const bpAfterStyle = updatedAt({
            ...currentBp,
            storyboards: (currentBp.storyboards ?? []).map((s) =>
              s.id === sbId ? { ...s, styleGuide } : s
            ),
          });
          saveBlueprint(bpAfterStyle);
          set({ blueprint: bpAfterStyle });

          // 2. Generate frame structure (scenes + captions, no images yet)
          const rawFrames = await generateFrameStructure(currentBp, styleGuide);

          // Add image prompts and assign IDs
          const framesWithPrompts: StoryboardFrame[] = rawFrames.map((f, i) => ({
            ...f,
            id: `frame-${Date.now()}-${i}`,
            order: i,
            imagePrompt: buildImagePrompt(f, styleGuide, currentBp.actors),
            imageUrl: undefined,
          }));

          // Save frames (no images yet)
          const { blueprint: bp2 } = get();
          if (!bp2) return;
          const bpWithFrames = updatedAt({
            ...bp2,
            storyboards: (bp2.storyboards ?? []).map((s) =>
              s.id === sbId ? { ...s, styleGuide, frames: framesWithPrompts, updatedAt: new Date().toISOString() } : s
            ),
          });
          saveBlueprint(bpWithFrames);
          set({ blueprint: bpWithFrames });

          // 3. Generate images one by one
          for (const frame of framesWithPrompts) {
            set({ storyboardGeneratingFrameId: frame.id });
            const imageUrl = await generateImage(frame.imagePrompt, currentBp.id, frame.id);
            if (imageUrl) {
              const { blueprint: bp3 } = get();
              if (!bp3) break;
              const bpImg = updatedAt({
                ...bp3,
                storyboards: (bp3.storyboards ?? []).map((s) =>
                  s.id === sbId
                    ? { ...s, frames: s.frames.map((f) => f.id === frame.id ? { ...f, imageUrl } : f), updatedAt: new Date().toISOString() }
                    : s
                ),
              });
              saveBlueprint(bpImg);
              set({ blueprint: bpImg });
            }
          }
        } catch (err) {
          console.error('Storyboard generation failed:', err);
        } finally {
          set({ storyboardGenerating: false, storyboardGeneratingFrameId: null });
        }
      },

      reorderStoryboardFrames: (storyboardId, fromIdx, toIdx) => {
        const { blueprint } = get();
        if (!blueprint || fromIdx === toIdx) return;
        const sb = (blueprint.storyboards ?? []).find((s) => s.id === storyboardId);
        if (!sb) return;
        const frames = [...sb.frames];
        const [moved] = frames.splice(fromIdx, 1);
        frames.splice(toIdx, 0, moved);
        const reordered = frames.map((f, i) => ({ ...f, order: i }));
        const newBp = updatedAt({
          ...blueprint,
          storyboards: (blueprint.storyboards ?? []).map((s) =>
            s.id === storyboardId ? { ...s, frames: reordered, updatedAt: new Date().toISOString() } : s
          ),
        });
        saveBlueprint(newBp);
        set({ blueprint: newBp });
      },

      regenerateFrame: async (storyboardId, frameId) => {
        const { blueprint } = get();
        if (!blueprint) return;
        const sb = (blueprint.storyboards ?? []).find((s) => s.id === storyboardId);
        const frame = sb?.frames.find((f) => f.id === frameId);
        if (!sb || !frame) return;

        set({ storyboardGeneratingFrameId: frameId });
        try {
          const imageUrl = await generateImage(frame.imagePrompt, blueprint.id, frameId);
          if (imageUrl) {
            const { blueprint: bp2 } = get();
            if (!bp2) return;
            const newBp = updatedAt({
              ...bp2,
              storyboards: (bp2.storyboards ?? []).map((s) =>
                s.id === storyboardId
                  ? { ...s, frames: s.frames.map((f) => f.id === frameId ? { ...f, imageUrl } : f), updatedAt: new Date().toISOString() }
                  : s
              ),
            });
            saveBlueprint(newBp);
            set({ blueprint: newBp });
          }
        } finally {
          set({ storyboardGeneratingFrameId: null });
        }
      },

      regenerateAllFrames: async (storyboardId) => {
        const { blueprint, storyboardGenerating } = get();
        if (!blueprint || storyboardGenerating) return;
        const sb = (blueprint.storyboards ?? []).find((s) => s.id === storyboardId);
        if (!sb || sb.frames.length === 0) return;

        set({ storyboardGenerating: true });
        try {
          for (const frame of sb.frames) {
            set({ storyboardGeneratingFrameId: frame.id });
            const imageUrl = await generateImage(frame.imagePrompt, blueprint.id, frame.id);
            if (imageUrl) {
              const { blueprint: bp2 } = get();
              if (!bp2) break;
              const newBp = updatedAt({
                ...bp2,
                storyboards: (bp2.storyboards ?? []).map((s) =>
                  s.id === storyboardId
                    ? { ...s, frames: s.frames.map((f) => f.id === frame.id ? { ...f, imageUrl } : f), updatedAt: new Date().toISOString() }
                    : s
                ),
              });
              saveBlueprint(newBp);
              set({ blueprint: newBp });
            }
          }
        } finally {
          set({ storyboardGenerating: false, storyboardGeneratingFrameId: null });
        }
      },

      generateActorPortrait: async (actorId) => {
        const { blueprint, actorPortraitGenerating } = get();
        if (!blueprint || actorPortraitGenerating) return;
        const actor = blueprint.actors.find((a) => a.id === actorId);
        if (!actor) return;

        const parts = [`Professional portrait of ${actor.name}`];
        if (actor.bio) parts.push(actor.bio.slice(0, 120));
        parts.push('Photorealistic headshot, neutral background, professional lighting, clean composition.');
        const prompt = parts.join('. ');

        set({ actorPortraitGenerating: actorId });
        try {
          const url = await generateImage(prompt, blueprint.id, `actor-${actorId}`);
          if (url) {
            const { blueprint: bp2 } = get();
            if (!bp2) return;
            const newBp = updatedAt({ ...bp2, actors: bp2.actors.map((a) => a.id === actorId ? { ...a, portraitUrl: url } : a) });
            saveBlueprint(newBp);
            set({ blueprint: newBp });
          }
        } finally {
          set({ actorPortraitGenerating: null });
        }
      },
    };
  })
);

// Async bootstrap: check for share token first, then normal auth
const _shareToken = new URLSearchParams(window.location.search).get('share');
if (_shareToken) {
  // Guest / view-only mode — skip auth gate entirely
  useBlueprintStore.getState().loadBlueprintByShareToken(_shareToken);
} else {
  // Keep auth state in sync (handles OTP magic-link verification, token refresh, sign-out)
  // INITIAL_SESSION fires immediately for an existing session; SIGNED_IN fires on new sign-ins.
  onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      const { userId } = useBlueprintStore.getState();
      if (!userId) {
        useBlueprintStore.getState().setUser(session.user.id, session.user.email ?? '');
      }
    } else if (event === 'SIGNED_OUT') {
      _bootPromise = null; // Cancel any in-flight boot so the next login boots fresh
      useBlueprintStore.setState({ mode: 'auth', userId: null, userEmail: null, blueprint: null,
        rfNodes: [], rfEdges: [], activeVersionId: null, storyboardMode: false });
    }
  });

  // Fallback: if onAuthStateChange doesn't fire (e.g. older Supabase versions that don't
  // emit INITIAL_SESSION), getSession() ensures we still bootstrap on page load.
  getSession().then((session) => {
    if (session && !useBlueprintStore.getState().userId) {
      useBlueprintStore.getState().setUser(session.user.id, session.user.email ?? '');
    }
  });
}
