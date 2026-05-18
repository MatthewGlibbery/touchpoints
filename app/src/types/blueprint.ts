export type Actor = {
  id: string;
  name: string;
  color: string;
  order: number;
  bio?: string;
  goals?: string;
  portraitUrl?: string;
};

export type Phase = {
  id: string;
  name: string;
  order: number;
  substepCount?: number;
  description?: string;
  conditional?: boolean;
  conditionLabel?: string;
};

export type ActionMedia = {
  id: string;
  type: 'image' | 'gif' | 'video';
  url: string;
  caption?: string;
};

export type Action = {
  id: string;
  actorId: string;
  phaseId: string;
  label: string;
  labelDetailed?: string;
  labelAbstract?: string;
  touchpointIds: string[];
  touchpointLabels?: string[];
  painPointIds: string[];
  opportunityIds: string[];
  questionIds: string[];
  order: number;
  tags?: string[];
  media?: ActionMedia[];
};

export type Question = {
  id: string;
  text: string;
  type?: 'technical' | 'process';
  actionIds: string[];
  aiGenerated?: true;
  guestContributed?: true;
  guestName?: string;
};

export type Touchpoint = {
  id: string;
  label: string;
  type: 'interface' | 'system' | 'human';
};

export type PainPoint = {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionIds: string[];
  aiGenerated?: true;
  guestContributed?: true;
  guestName?: string;
};

export type Opportunity = {
  id: string;
  description: string;
  effort?: 'low' | 'medium' | 'high' | 'unsure';
  actionIds: string[];
  painPointIds: string[];
  aiGenerated?: true;
  guestContributed?: true;
  guestName?: string;
};

export type EdgeMeta = {
  label?: string;
  flowType?: 'sequence' | 'dependency' | 'decision';
};

export type CustomEdge = {
  id: string;
  sourceActionId: string;
  targetActionId: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type PresentationKeyframe = {
  id: string;
  label?: string;
  viewport: { x: number; y: number; zoom: number };
  versionId?: string | null;
  canvasView?: 'edit' | 'pain-points' | 'opportunities' | 'questions';
  selectedNodeId?: string | null;
  compareMode?: boolean;
  compareVersionIds?: [string | null, string | null];
};

export type Presentation = {
  id: string;
  name: string;
  keyframes: PresentationKeyframe[];
};

export type BlueprintVersion = {
  id: string;
  name: string;
  actions: Action[];
  painPoints: PainPoint[];
  opportunities: Opportunity[];
  questions: Question[];
};

export type StoryboardStyleGuide = {
  baseStyle: string;
  characterDescriptions: Record<string, string>; // actorId → visual description
};

export type StoryboardFrame = {
  id: string;
  order: number;
  sceneDescription: string;
  imagePrompt: string;
  imageUrl?: string;
  caption: string;
  phaseIds: string[];
  actorIds: string[];
};

export type Storyboard = {
  id: string;
  name: string;
  styleGuide: StoryboardStyleGuide;
  frames: StoryboardFrame[];
  createdAt: string;
  updatedAt: string;
};

// ─── Lanes (status + timeline) ─────────────────────────────────────────────────
// A lane is a horizontal track that lives outside the actor swimlane region.
// Status lanes live below the phase header and above the first actor row.
// Timeline lanes live above the phase header. Each lane contains segments that
// span one or more substep columns on the existing phase grid.
//
// Segments are anchored by absolute column index (`startCol` inclusive →
// `endCol` inclusive). Column indices are global across all phases — the same
// indexing used by `computeColumnData(blueprint).phaseColumns` (`startCol`).
// Width on canvas = (endCol - startCol + 1) * PHASE_WIDTH.

export type LaneSegment = {
  id: string;
  label: string;
  startCol: number;            // inclusive
  endCol: number;              // inclusive (>= startCol)
  color?: string;              // optional override (otherwise inherits lane.color)
};

export type StatusLane = {
  id: string;
  name: string;
  color: string;               // label colour + segment accent
  order: number;               // top-to-bottom order among status lanes
  visible: boolean;            // toggle to show/hide
  segments: LaneSegment[];
};

export type TimelineLane = {
  id: string;
  name: string;
  color: string;
  order: number;
  visible: boolean;
  segments: LaneSegment[];     // segment label is the duration text e.g. "48 hours"
};

export type Blueprint = {
  id: string;
  name: string;
  baseVersionName?: string;  // display name for the base/Current version tab
  actors: Actor[];
  phases: Phase[];
  actions: Action[];
  touchpoints: Touchpoint[];
  painPoints: PainPoint[];
  opportunities: Opportunity[];
  questions: Question[];
  edgeMeta?: Record<string, EdgeMeta>;
  touchpointTags?: string[];
  removedEdgeIds?: string[];
  customEdges?: CustomEdge[];
  versions?: BlueprintVersion[];
  activeVersionId?: string | null;
  presentations?: Presentation[];
  overviewActionIds?: string[];  // IDs of actions selected for semantic overview zoom
  overviewCellDescriptions?: Record<string, string>;  // key = "${actorId}-${phaseId}"
  storyboards?: Storyboard[];
  statusLanes?: StatusLane[];
  timelineLanes?: TimelineLane[];
  createdAt: string;
  updatedAt: string;
};
