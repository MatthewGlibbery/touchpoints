import { PhaseHeaderNode } from './nodes/PhaseHeaderNode';
import { ActorLabelNode } from './nodes/ActorLabelNode';
import { ActionNode } from './nodes/ActionNode';
import { SwimlaneNode } from './nodes/SwimlaneNode';
import { EmptyCellNode } from './nodes/EmptyCellNode';
import { ColumnInserterNode } from './nodes/ColumnInserterNode';
import { ColumnOverlayNode } from './nodes/ColumnOverlayNode';
import { PhaseBoundaryNode } from './nodes/PhaseBoundaryNode';
import { PhaseAdderNode } from './nodes/PhaseAdderNode';
import { ActorAdderNode } from './nodes/ActorAdderNode';
import {
  StatusLaneLabelNode,
  TimelineLaneLabelNode,
  LaneBodyNode,
  StatusSegmentNode,
  TimelineSegmentNode,
} from './nodes/LaneNodes';

export const nodeTypes = {
  phaseHeader: PhaseHeaderNode,
  actorLabel: ActorLabelNode,
  action: ActionNode,
  swimlane: SwimlaneNode,
  emptyCell: EmptyCellNode,
  columnInserter: ColumnInserterNode,
  columnOverlay: ColumnOverlayNode,
  phaseBoundary: PhaseBoundaryNode,
  phaseAdder: PhaseAdderNode,
  actorAdder: ActorAdderNode,
  statusLaneLabel: StatusLaneLabelNode,
  timelineLaneLabel: TimelineLaneLabelNode,
  laneBody: LaneBodyNode,
  statusSegment: StatusSegmentNode,
  timelineSegment: TimelineSegmentNode,
};
