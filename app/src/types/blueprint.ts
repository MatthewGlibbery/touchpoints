export type Actor = {
  id: string;
  name: string;
  color: string;
  order: number;
  bio?: string;
  goals?: string;
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

export type StatusTransition = {
  fromStatusId?: string | null;
  toStatusId?: string | null;
};

export type ServiceStatus = {
  id: string;
  label: string;
  color: string;
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
  statusTransition?: StatusTransition;
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
  canvasView?: 'edit' | 'pain-points' | 'opportunities' | 'questions' | 'status';
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
  statuses?: ServiceStatus[];
  createdAt: string;
  updatedAt: string;
};
