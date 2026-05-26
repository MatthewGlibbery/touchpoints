import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { Blueprint, Action, Actor } from '../types/blueprint';

export function getBlueprintForVersion(bp: Blueprint, versionId?: string | null): Blueprint {
  if (!versionId) return bp;
  const v = bp.versions?.find((v) => v.id === versionId);
  if (!v) return bp;
  return { ...bp, actions: v.actions, painPoints: v.painPoints, opportunities: v.opportunities, questions: v.questions };
}


export const PHASE_WIDTH = 280;
export const ACTOR_LABEL_WIDTH = 160;
export const PHASE_HEADER_HEIGHT = 72;
export const ACTION_NODE_WIDTH = 220;
export const ACTION_NODE_HEIGHT = 64;
export const ACTION_NODE_HEIGHT_MEDIA = 240;
export const ROW_HEIGHT = 200;
export const ROW_HEIGHT_MEDIA = 300;
export const H_CELL_PAD = Math.round((PHASE_WIDTH - ACTION_NODE_WIDTH) / 2);  // 30 — horizontal centering
export const V_CELL_PAD = Math.round((ROW_HEIGHT - ACTION_NODE_HEIGHT) / 2);  // 30 — vertical centering
export const OVERVIEW_CARD_HEIGHT = 56;  // fixed card height for overview mode nodes

// Lane rows: timeline lanes live above phase headers, status lanes live below
// phase headers and above the first actor swimlane. Each visible lane occupies
// one fixed-height row.
export const TIMELINE_LANE_HEIGHT = 44;
export const STATUS_LANE_HEIGHT = 56;
/** @deprecated use H_CELL_PAD / V_CELL_PAD */
export const CELL_PADDING = H_CELL_PAD;

export function estimateActionHeight(action: Action): number {
  let h = 14; // padding top
  h += 36;    // actor icon row (32px icon, some padding)
  if (action.labelDetailed) h += 44; // description 2 lines + gap
  const hasMedia = (action.media?.length ?? 0) > 0;
  const hasBadges = action.painPointIds.length > 0 || action.opportunityIds.length > 0 || (action.questionIds?.length ?? 0) > 0;
  if (hasMedia) h += 128;  // 8px margin + 120px image
  if (hasBadges) h += 49;  // 10px margin + 1px divider + 10px + 28px badges
  h += 14; // padding bottom
  return Math.max(h, ACTION_NODE_HEIGHT);
}

export function computeActorRowHeights(blueprint: Blueprint): Map<string, number> {
  const heights = new Map<string, number>();
  const V_PAD = 60; // 30px top + 30px bottom padding per row
  for (const actor of blueprint.actors) {
    const actorActions = blueprint.actions.filter((a) => a.actorId === actor.id);
    const maxCardH = actorActions.length > 0
      ? Math.max(...actorActions.map(estimateActionHeight))
      : ACTION_NODE_HEIGHT;
    heights.set(actor.id, maxCardH + V_PAD);
  }
  return heights;
}

function computeActorYOffsets(
  sortedActors: Actor[],
  rowHeights: Map<string, number>
): { offsets: Map<string, number>; totalHeight: number } {
  const offsets = new Map<string, number>();
  let y = 0;
  for (const actor of sortedActors) {
    offsets.set(actor.id, y);
    y += rowHeights.get(actor.id) ?? ROW_HEIGHT;
  }
  return { offsets, totalHeight: y };
}

// ─── Substep/column helpers ──────────────────────────────────────────────────

function phaseSubstepCount(phaseId: string, blueprint: Blueprint): number {
  const phase = blueprint.phases.find((p) => p.id === phaseId);
  if (phase?.substepCount !== undefined) return phase.substepCount;
  const orders = blueprint.actions.filter((a) => a.phaseId === phaseId).map((a) => a.order);
  return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

export function computeColumnData(blueprint: Blueprint): {
  phaseColumns: Map<string, { startCol: number; colCount: number }>;
  totalColumns: number;
} {
  const sortedPhases = [...blueprint.phases].sort((a, b) => a.order - b.order);
  const phaseColumns = new Map<string, { startCol: number; colCount: number }>();
  let col = 0;
  for (const phase of sortedPhases) {
    const count = phaseSubstepCount(phase.id, blueprint);
    phaseColumns.set(phase.id, { startCol: col, colCount: count });
    col += count;
  }
  return { phaseColumns, totalColumns: col };
}

// ─── Main layout ──────────────────────────────────────────────────────────────

// Lane visibility: in overview mode, lanes are hidden to keep the simplified
// view focused on representative steps only.
function visibleStatusLanes(blueprint: Blueprint, isOverview: boolean) {
  if (isOverview) return [];
  return [...(blueprint.statusLanes ?? [])]
    .filter((l) => l.visible !== false)
    .sort((a, b) => a.order - b.order);
}

function visibleTimelineLanes(blueprint: Blueprint, isOverview: boolean) {
  if (isOverview) return [];
  return [...(blueprint.timelineLanes ?? [])]
    .filter((l) => l.visible !== false)
    .sort((a, b) => a.order - b.order);
}

export function computeLaneOffsets(blueprint: Blueprint, isOverview: boolean) {
  const tLanes = visibleTimelineLanes(blueprint, isOverview);
  const sLanes = visibleStatusLanes(blueprint, isOverview);
  // In edit/normal mode, always reserve one extra row at the end of each region
  // for the "+ Add timeline" / "+ Add status" adder button (same row height as
  // a real lane). In overview mode, lanes are hidden entirely.
  const timelineLanesHeight = tLanes.length * TIMELINE_LANE_HEIGHT;
  const statusLanesHeight = sLanes.length * STATUS_LANE_HEIGHT;
  const timelineAdderHeight = isOverview ? 0 : TIMELINE_LANE_HEIGHT;
  const statusAdderHeight = isOverview ? 0 : STATUS_LANE_HEIGHT;
  const timelineRegionHeight = timelineLanesHeight + timelineAdderHeight;
  const statusRegionHeight = statusLanesHeight + statusAdderHeight;
  return {
    tLanes,
    sLanes,
    timelineRegionHeight,
    statusRegionHeight,
    timelineLanesHeight,
    statusLanesHeight,
    timelineAdderHeight,
    statusAdderHeight,
    phaseHeaderY: timelineRegionHeight,
    statusRegionY: timelineRegionHeight + PHASE_HEADER_HEIGHT,
    actorRegionY: timelineRegionHeight + PHASE_HEADER_HEIGHT + statusRegionHeight,
  };
}

export function blueprintToFlow(
  blueprint: Blueprint,
  opts?: { overviewMode?: boolean }
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const isOverview = opts?.overviewMode ?? false;

  const sortedActors = [...blueprint.actors].sort((a, b) => a.order - b.order);
  const sortedPhases = [...blueprint.phases].sort((a, b) => a.order - b.order);
  const { phaseColumns, totalColumns } = computeColumnData(blueprint);

  const rowHeights = isOverview
    ? (() => {
        const m = new Map<string, number>();
        blueprint.actors.forEach((a) => m.set(a.id, OVERVIEW_CARD_HEIGHT + 60));
        return m;
      })()
    : computeActorRowHeights(blueprint);
  const { offsets: actorYOffsets, totalHeight: totalCanvasHeight } = computeActorYOffsets(sortedActors, rowHeights);
  const totalCanvasWidth = totalColumns * PHASE_WIDTH;

  const lanes = computeLaneOffsets(blueprint, isOverview);
  const PHASE_Y = lanes.phaseHeaderY;
  const ACTOR_REGION_Y = lanes.actorRegionY;

  // ─── Timeline lane rows (above phase headers) ─────────────────────────────
  lanes.tLanes.forEach((lane, i) => {
    const laneY = i * TIMELINE_LANE_HEIGHT;
    // Lane label (left column)
    nodes.push({
      id: `tlane-label-${lane.id}`,
      type: 'timelineLaneLabel',
      position: { x: 0, y: laneY },
      data: { lane, height: TIMELINE_LANE_HEIGHT },
      draggable: false, selectable: false, zIndex: 5,
      style: { pointerEvents: 'all' },
    });
    // Lane body (canvas-spanning click target for adding segments)
    nodes.push({
      id: `tlane-body-${lane.id}`,
      type: 'laneBody',
      position: { x: ACTOR_LABEL_WIDTH, y: laneY },
      data: {
        laneId: lane.id,
        kind: 'timeline' as const,
        color: lane.color,
        width: totalCanvasWidth,
        height: TIMELINE_LANE_HEIGHT,
        totalColumns,
        segments: lane.segments,
      },
      draggable: false, selectable: false, zIndex: 1,
      style: { pointerEvents: 'all' },
    });
    // Segments
    lane.segments.forEach((seg) => {
      const startCol = Math.max(0, Math.min(seg.startCol, totalColumns - 1));
      const endCol = Math.max(startCol, Math.min(seg.endCol, totalColumns - 1));
      const x = ACTOR_LABEL_WIDTH + startCol * PHASE_WIDTH;
      const w = (endCol - startCol + 1) * PHASE_WIDTH;
      nodes.push({
        id: `tseg-${seg.id}`,
        type: 'timelineSegment',
        position: { x, y: laneY },
        data: {
          segment: seg,
          laneId: lane.id,
          kind: 'timeline' as const,
          color: seg.color ?? lane.color,
          width: w,
          height: TIMELINE_LANE_HEIGHT,
          totalColumns,
          siblings: lane.segments.filter((s) => s.id !== seg.id),
        },
        draggable: false, selectable: false, zIndex: 10,
        style: { pointerEvents: 'all' },
      });
    });
  });

  // ─── Timeline adder row (left column, end of timeline region) ─────────────
  if (!isOverview && lanes.timelineAdderHeight > 0) {
    nodes.push({
      id: 'add-timeline-btn',
      type: 'timelineAdder',
      position: { x: 0, y: lanes.timelineLanesHeight },
      data: { height: TIMELINE_LANE_HEIGHT },
      draggable: false, selectable: false, zIndex: 5,
      style: { pointerEvents: 'all' },
    });
  }

  // ─── Phase headers ────────────────────────────────────────────────────────
  sortedPhases.forEach((phase) => {
    const col = phaseColumns.get(phase.id)!;
    nodes.push({
      id: `phase-${phase.id}`,
      type: 'phaseHeader',
      position: { x: ACTOR_LABEL_WIDTH + col.startCol * PHASE_WIDTH, y: PHASE_Y },
      data: { phase, width: col.colCount * PHASE_WIDTH, colCount: col.colCount },
      draggable: false, selectable: false,
      style: { pointerEvents: 'all' },
    });
  });

  // ─── Status lane rows (below phase headers, above actors) ─────────────────
  lanes.sLanes.forEach((lane, i) => {
    const laneY = lanes.statusRegionY + i * STATUS_LANE_HEIGHT;
    nodes.push({
      id: `slane-label-${lane.id}`,
      type: 'statusLaneLabel',
      position: { x: 0, y: laneY },
      data: { lane, height: STATUS_LANE_HEIGHT },
      draggable: false, selectable: false, zIndex: 5,
      style: { pointerEvents: 'all' },
    });
    nodes.push({
      id: `slane-body-${lane.id}`,
      type: 'laneBody',
      position: { x: ACTOR_LABEL_WIDTH, y: laneY },
      data: {
        laneId: lane.id,
        kind: 'status' as const,
        color: lane.color,
        width: totalCanvasWidth,
        height: STATUS_LANE_HEIGHT,
        totalColumns,
        segments: lane.segments,
      },
      draggable: false, selectable: false, zIndex: 1,
      style: { pointerEvents: 'all' },
    });
    lane.segments.forEach((seg) => {
      const startCol = Math.max(0, Math.min(seg.startCol, totalColumns - 1));
      const endCol = Math.max(startCol, Math.min(seg.endCol, totalColumns - 1));
      const x = ACTOR_LABEL_WIDTH + startCol * PHASE_WIDTH;
      const w = (endCol - startCol + 1) * PHASE_WIDTH;
      nodes.push({
        id: `sseg-${seg.id}`,
        type: 'statusSegment',
        position: { x, y: laneY },
        data: {
          segment: seg,
          laneId: lane.id,
          kind: 'status' as const,
          color: seg.color ?? lane.color,
          width: w,
          height: STATUS_LANE_HEIGHT,
          totalColumns,
          siblings: lane.segments.filter((s) => s.id !== seg.id),
        },
        draggable: false, selectable: false, zIndex: 10,
        style: { pointerEvents: 'all' },
      });
    });
  });

  // ─── Status adder row (left column, end of status region) ─────────────────
  if (!isOverview && lanes.statusAdderHeight > 0) {
    nodes.push({
      id: 'add-status-btn',
      type: 'statusAdder',
      position: { x: 0, y: lanes.statusRegionY + lanes.statusLanesHeight },
      data: { height: STATUS_LANE_HEIGHT },
      draggable: false, selectable: false, zIndex: 5,
      style: { pointerEvents: 'all' },
    });
  }

  // ─── Swimlane backgrounds ─────────────────────────────────────────────────
  sortedActors.forEach((actor, i) => {
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    nodes.push({
      id: `swimlane-${actor.id}`,
      type: 'swimlane',
      position: { x: ACTOR_LABEL_WIDTH, y: ACTOR_REGION_Y + actorY },
      data: { color: actor.color, width: totalCanvasWidth, height: rowH, even: i % 2 === 0 },
      draggable: false, selectable: false, zIndex: -1,
    });
  });

  // ─── Column body overlays (click-to-select per column; behind cards/cells) ─
  sortedPhases.forEach((phase) => {
    const col = phaseColumns.get(phase.id)!;
    for (let order = 0; order < col.colCount; order++) {
      const colIndex = col.startCol + order;
      nodes.push({
        id: `coloverlay-${phase.id}-${order}`,
        type: 'columnOverlay',
        position: { x: ACTOR_LABEL_WIDTH + colIndex * PHASE_WIDTH, y: ACTOR_REGION_Y },
        data: { phaseId: phase.id, order, colCount: col.colCount, height: totalCanvasHeight, conditional: phase.conditional ?? false },
        draggable: false, selectable: false, zIndex: 0,
        style: { pointerEvents: 'all' },
      });
    }
  });

  // ─── Actor labels ─────────────────────────────────────────────────────────
  sortedActors.forEach((actor) => {
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    nodes.push({
      id: `actor-${actor.id}`,
      type: 'actorLabel',
      position: { x: 0, y: ACTOR_REGION_Y + actorY },
      data: { actor, height: rowH },
      draggable: false, selectable: false,
      style: { pointerEvents: 'all' },
    });
  });

  // ─── Action nodes ─────────────────────────────────────────────────────────
  const occupiedCells = new Set<string>();

  blueprint.actions.forEach((action) => {
    const actorIndex = sortedActors.findIndex((a) => a.id === action.actorId);
    const col = phaseColumns.get(action.phaseId);
    if (actorIndex === -1 || !col) return;

    const actor = sortedActors[actorIndex];
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    const nodeH = isOverview ? OVERVIEW_CARD_HEIGHT : estimateActionHeight(action);
    const vPad = Math.round((rowH - nodeH) / 2);

    const colIndex = col.startCol + action.order;
    const x = ACTOR_LABEL_WIDTH + colIndex * PHASE_WIDTH + H_CELL_PAD;
    const y = ACTOR_REGION_Y + actorY + vPad;

    occupiedCells.add(`${action.actorId}:${action.phaseId}:${action.order}`);

    // Count AI-generated items for badge indicators
    const actionPains = blueprint.painPoints.filter(p => action.painPointIds.includes(p.id));
    const actionOpps = blueprint.opportunities.filter(o => action.opportunityIds.includes(o.id));
    const actionQs = (blueprint.questions ?? []).filter(q => (action.questionIds ?? []).includes(q.id));
    const allPainsAi = actionPains.length > 0 && actionPains.every(p => p.aiGenerated);
    const allOppsAi = actionOpps.length > 0 && actionOpps.every(o => o.aiGenerated);
    const allQsAi = actionQs.length > 0 && actionQs.every(q => q.aiGenerated);

    nodes.push({
      id: `action-${action.id}`,
      type: 'action',
      position: { x, y },
      data: { action, actorColor: actor.color, actorOrder: actor.order, nodeH, allPainsAi, allOppsAi, allQsAi },
      draggable: true,
      dragHandle: '.action-drag-handle',
      width: ACTION_NODE_WIDTH,
      height: nodeH,
    });
  });

  // ─── Empty cell placeholders ──────────────────────────────────────────────
  sortedActors.forEach((actor) => {
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    const vPad = Math.round((rowH - ACTION_NODE_HEIGHT) / 2);

    sortedPhases.forEach((phase) => {
      const col = phaseColumns.get(phase.id)!;
      for (let order = 0; order < col.colCount; order++) {
        if (occupiedCells.has(`${actor.id}:${phase.id}:${order}`)) continue;
        const colIndex = col.startCol + order;
        nodes.push({
          id: `empty-${actor.id}-${phase.id}-${order}`,
          type: 'emptyCell',
          position: {
            x: ACTOR_LABEL_WIDTH + colIndex * PHASE_WIDTH + H_CELL_PAD,
            y: ACTOR_REGION_Y + actorY + vPad,
          },
          data: { actorId: actor.id, phaseId: phase.id, order, actorColor: actor.color },
          draggable: false, selectable: false, zIndex: 0,
          style: { pointerEvents: 'all' },
        });
      }
    });
  });

  // ─── Column inserters (between sub-steps within a phase) ──────────────────
  // Inserter node is constrained to the actor region only — it must NOT extend
  // into the timeline or status lane regions, since those have their own
  // interactions (segment edge resize, lane body click-to-add).
  const NODE_PAD = 4;        // a few px of slop above/below for hit area
  const LINE_ROW_PAD = 30;   // top/bottom padding within each row (half of V_PAD=60)
  const inserterTop = ACTOR_REGION_Y - NODE_PAD;
  const inserterHeight = totalCanvasHeight + NODE_PAD * 2;
  // Line is drawn relative to the node's internal coordinate frame
  const lineStart = NODE_PAD + LINE_ROW_PAD;
  const lineEnd   = inserterHeight - NODE_PAD - LINE_ROW_PAD;
  sortedPhases.forEach((phase) => {
    const col = phaseColumns.get(phase.id)!;
    // One inserter for each boundary: before col 0, between each pair, after last
    for (let order = 0; order <= col.colCount; order++) {
      const x = ACTOR_LABEL_WIDTH + (col.startCol + order) * PHASE_WIDTH;
      nodes.push({
        id: `inserter-${phase.id}-${order}`,
        type: 'columnInserter',
        position: { x: x - 12, y: inserterTop },
        data: {
          phaseId: phase.id,
          atOrder: order,
          canvasHeight: inserterHeight,
          lineStart,
          lineEnd,
        },
        draggable: false, selectable: false, zIndex: 20,
        style: { pointerEvents: 'all' },
      });
    }
  });

  // ─── Add phase button ─────────────────────────────────────────────────────
  nodes.push({
    id: 'add-phase-btn',
    type: 'phaseAdder',
    position: { x: ACTOR_LABEL_WIDTH + totalColumns * PHASE_WIDTH + 12, y: PHASE_Y + 8 },
    data: {},
    draggable: false, selectable: false, zIndex: 25,
    style: { pointerEvents: 'all' },
  });

  // ─── Add actor button ─────────────────────────────────────────────────────
  nodes.push({
    id: 'add-actor-btn',
    type: 'actorAdder',
    position: { x: 0, y: ACTOR_REGION_Y + totalCanvasHeight + 4 },
    data: {},
    draggable: false, selectable: false, zIndex: 25,
    style: { pointerEvents: 'all' },
  });

  // ─── Phase boundary handles ───────────────────────────────────────────────
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const left = sortedPhases[i];
    const right = sortedPhases[i + 1];
    const leftCol = phaseColumns.get(left.id)!;
    const boundaryX = ACTOR_LABEL_WIDTH + (leftCol.startCol + leftCol.colCount) * PHASE_WIDTH;
    nodes.push({
      id: `boundary-${left.id}-${right.id}`,
      type: 'phaseBoundary',
      position: { x: boundaryX - 8, y: PHASE_Y },
      data: {
        leftPhaseId: left.id,
        rightPhaseId: right.id,
        canvasHeight: totalCanvasHeight + ACTOR_REGION_Y - PHASE_Y,
      },
      draggable: false, selectable: false, zIndex: 5,
      style: { pointerEvents: 'all' },
    });
  }

  // ─── Horizontal edges ─────────────────────────────────────────────────────
  const EDGE_COLOR = '#CBD5E1';

  sortedActors.forEach((actor) => {
    sortedPhases.forEach((phase) => {
      const actorPhaseActions = blueprint.actions
        .filter((a) => a.actorId === actor.id && a.phaseId === phase.id)
        .sort((a, b) => a.order - b.order);
      for (let i = 0; i < actorPhaseActions.length - 1; i++) {
        const src = actorPhaseActions[i];
        const tgt = actorPhaseActions[i + 1];
        const edgeId = `h-${src.id}-${tgt.id}`;
        const meta = blueprint.edgeMeta?.[edgeId];
        const color = meta?.flowType === 'decision' ? '#F59E0B' : meta?.flowType === 'dependency' ? '#8B5CF6' : EDGE_COLOR;
        edges.push({
          id: edgeId,
          source: `action-${src.id}`, sourceHandle: 'right',
          target: `action-${tgt.id}`, targetHandle: 'left',
          type: 'smoothstep',
          label: meta?.label,
          style: {
            stroke: color,
            strokeWidth: 1.5,
            strokeDasharray: meta?.flowType === 'decision' ? '6 3' : undefined,
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color },
          data: { labelOffset: meta?.labelOffset },
        });
      }
    });
  });

  // ─── Cross-phase edges (last action in phaseN → first action in phaseN+1) ──
  sortedActors.forEach((actor) => {
    for (let pi = 0; pi < sortedPhases.length - 1; pi++) {
      const phaseA = sortedPhases[pi];
      const phaseB = sortedPhases[pi + 1];
      const actionsInA = blueprint.actions
        .filter((a) => a.actorId === actor.id && a.phaseId === phaseA.id)
        .sort((a, b) => a.order - b.order);
      const actionsInB = blueprint.actions
        .filter((a) => a.actorId === actor.id && a.phaseId === phaseB.id)
        .sort((a, b) => a.order - b.order);
      if (!actionsInA.length || !actionsInB.length) continue;
      const src = actionsInA[actionsInA.length - 1];
      const tgt = actionsInB[0];
      const edgeId = `x-${src.id}-${tgt.id}`;
      const meta = blueprint.edgeMeta?.[edgeId];
      const color = meta?.flowType === 'decision' ? '#F59E0B' : meta?.flowType === 'dependency' ? '#8B5CF6' : EDGE_COLOR;
      edges.push({
        id: edgeId,
        source: `action-${src.id}`, sourceHandle: 'right',
        target: `action-${tgt.id}`, targetHandle: 'left',
        type: 'smoothstep',
        label: meta?.label,
        style: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: meta?.flowType === 'decision' ? '6 3' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color },
        data: { labelOffset: meta?.labelOffset },
      });
    }
  });

  // ─── Vertical edges (same timestep, different actors) ────────────────────
  const substepMap = new Map<string, Action[]>();
  blueprint.actions.forEach((action) => {
    const key = `${action.phaseId}:${action.order}`;
    if (!substepMap.has(key)) substepMap.set(key, []);
    substepMap.get(key)!.push(action);
  });

  substepMap.forEach((actions) => {
    if (actions.length < 2) return;
    const sorted = [...actions].sort((a, b) => {
      return sortedActors.findIndex((ac) => ac.id === a.actorId) - sortedActors.findIndex((ac) => ac.id === b.actorId);
    });
    for (let i = 0; i < sorted.length - 1; i++) {
      const edgeId = `v-${sorted[i].id}-${sorted[i + 1].id}`;
      const meta = blueprint.edgeMeta?.[edgeId];
      const color = meta?.flowType === 'decision' ? '#F59E0B' : meta?.flowType === 'dependency' ? '#8B5CF6' : EDGE_COLOR;
      edges.push({
        id: edgeId,
        source: `action-${sorted[i].id}`, sourceHandle: 'bottom',
        target: `action-${sorted[i + 1].id}`, targetHandle: 'top',
        type: 'smoothstep',
        label: meta?.label,
        style: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: meta?.flowType === 'decision' ? '6 3' : undefined,
        },
        data: { labelOffset: meta?.labelOffset },
      });
    }
  });

  // ─── Custom edges ─────────────────────────────────────────────────────────
  (blueprint.customEdges ?? []).forEach((ce) => {
    const meta = blueprint.edgeMeta?.[ce.id];
    const color = meta?.flowType === 'decision' ? '#F59E0B' : meta?.flowType === 'dependency' ? '#8B5CF6' : EDGE_COLOR;
    edges.push({
      id: ce.id,
      source: `action-${ce.sourceActionId}`,
      sourceHandle: ce.sourceHandle,
      target: `action-${ce.targetActionId}`,
      targetHandle: ce.targetHandle,
      type: 'smoothstep',
      label: meta?.label,
      style: {
        stroke: color,
        strokeWidth: 1.5,
        strokeDasharray: meta?.flowType === 'decision' ? '6 3' : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color },
      data: { labelOffset: meta?.labelOffset },
    });
  });

  const removed = new Set(blueprint.removedEdgeIds ?? []);
  const filteredEdges = removed.size > 0 ? edges.filter((e) => !removed.has(e.id)) : edges;

  // ─── Compute handle offsets for edges ───────────────────────────────────────
  // Every edge gets an offset based on its direction, even if it's the only
  // edge on that handle. This keeps the visual language consistent:
  //   Right/Left handles: straight → center, up → above center, down → below center
  //   Top/Bottom handles: straight → center, left → left of center, right → right of center
  const HANDLE_OFFSET = 6; // px offset for non-straight edges

  // Build a lookup for node positions AND heights so we can compute actual handle positions
  const nodePositions = new Map<string, { x: number; y: number }>();
  const nodeHeights = new Map<string, number>();
  const nodeWidths = new Map<string, number>();
  for (const node of nodes) {
    nodePositions.set(node.id, node.position);
    nodeHeights.set(node.id, (node.height as number) ?? 64);
    nodeWidths.set(node.id, (node.width as number) ?? ACTION_NODE_WIDTH);
  }

  // Compute actual handle center positions (where the edge visually connects)
  function getHandleCenter(nodeId: string, handle: string): { x: number; y: number } {
    const pos = nodePositions.get(nodeId) ?? { x: 0, y: 0 };
    const h = nodeHeights.get(nodeId) ?? 64;
    const w = nodeWidths.get(nodeId) ?? ACTION_NODE_WIDTH;
    switch (handle) {
      case 'right': return { x: pos.x + w, y: pos.y + h / 2 };
      case 'left':  return { x: pos.x, y: pos.y + h / 2 };
      case 'bottom': return { x: pos.x + w / 2, y: pos.y + h };
      case 'top':    return { x: pos.x + w / 2, y: pos.y };
      default:       return { x: pos.x + w / 2, y: pos.y + h / 2 };
    }
  }

  // Helper: compute offset for a single edge endpoint based on handle + direction
  // dx/dy here are between the actual handle centers, not node positions
  function computeOffset(handle: string, dx: number, dy: number): number {
    if (handle === 'right' || handle === 'left') {
      // Vertical offset based on dy — only if the edge actually goes up/down
      if (Math.abs(dy) < 2) return 0; // straight → center
      return dy < 0 ? -HANDLE_OFFSET : HANDLE_OFFSET; // up → above, down → below
    }
    // top or bottom: horizontal offset based on dx — only if the edge goes left/right
    if (Math.abs(dx) < 2) return 0; // straight → center
    return dx < 0 ? -HANDLE_OFFSET : HANDLE_OFFSET; // left → left, right → right
  }

  // For each edge, compute directional offsets for both source and target
  const edgeOffsets = new Map<string, { sourceOffset: number; targetOffset: number }>();

  for (const edge of filteredEdges) {
    const srcHandle = edge.sourceHandle as string;
    const tgtHandle = edge.targetHandle as string;
    // Skip offset computation if either node isn't in the position map (edge references a deleted node)
    if (!nodePositions.has(edge.source as string) || !nodePositions.has(edge.target as string)) {
      edgeOffsets.set(edge.id, { sourceOffset: 0, targetOffset: 0 });
      continue;
    }
    const srcCenter = getHandleCenter(edge.source as string, srcHandle);
    const tgtCenter = getHandleCenter(edge.target as string, tgtHandle);
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;

    const sourceOffset = computeOffset(srcHandle, dx, dy);
    const targetOffset = computeOffset(tgtHandle, -dx, -dy);

    edgeOffsets.set(edge.id, { sourceOffset, targetOffset });
  }

  // When multiple edges share the same handle, spread them further apart
  // so they don't overlap (add incremental gap on top of directional offset)
  type HandleEntry = { edgeId: string; side: 'source' | 'target'; dx: number; dy: number };
  const handleGroups = new Map<string, { handle: string; entries: HandleEntry[] }>();

  for (const edge of filteredEdges) {
    const srcKey = `${edge.source}:${edge.sourceHandle}`;
    const tgtKey = `${edge.target}:${edge.targetHandle}`;
    const srcHandle = edge.sourceHandle as string;
    const tgtHandle = edge.targetHandle as string;
    if (!nodePositions.has(edge.source as string) || !nodePositions.has(edge.target as string)) continue;
    const srcCenter = getHandleCenter(edge.source as string, srcHandle);
    const tgtCenter = getHandleCenter(edge.target as string, tgtHandle);
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;

    if (!handleGroups.has(srcKey)) handleGroups.set(srcKey, { handle: srcHandle, entries: [] });
    handleGroups.get(srcKey)!.entries.push({ edgeId: edge.id, side: 'source', dx, dy });

    if (!handleGroups.has(tgtKey)) handleGroups.set(tgtKey, { handle: tgtHandle, entries: [] });
    handleGroups.get(tgtKey)!.entries.push({ edgeId: edge.id, side: 'target', dx: -dx, dy: -dy });
  }

  const HANDLE_GAP = 6; // additional px between edges sharing the same handle

  for (const [, { handle, entries }] of handleGroups) {
    if (entries.length <= 1) continue;

    // Sort by direction so same-direction edges get adjacent slots
    let sorted: HandleEntry[];
    if (handle === 'right' || handle === 'left') {
      sorted = [...entries].sort((a, b) => a.dy - b.dy);
    } else {
      sorted = [...entries].sort((a, b) => a.dx - b.dx);
    }

    // Spread edges within the same directional group
    for (let i = 0; i < sorted.length; i++) {
      const additionalOffset = (i - (sorted.length - 1) / 2) * HANDLE_GAP;
      const entry = sorted[i];
      const existing = edgeOffsets.get(entry.edgeId)!;
      if (entry.side === 'source') existing.sourceOffset += additionalOffset;
      else existing.targetOffset += additionalOffset;
    }
  }

  // Merge offsets into edge data
  for (const edge of filteredEdges) {
    const offsets = edgeOffsets.get(edge.id);
    if (offsets) {
      edge.data = { ...edge.data, sourceOffset: offsets.sourceOffset, targetOffset: offsets.targetOffset };
    }
  }

  return { nodes, edges: filteredEdges };
}

// ─── Hit-testing helpers ──────────────────────────────────────────────────────

export function getCellFromPosition(
  x: number,
  y: number,
  blueprint: Blueprint
): { actorId: string; phaseId: string; order: number } | null {
  const sortedActors = [...blueprint.actors].sort((a, b) => a.order - b.order);
  const rowHeights = computeActorRowHeights(blueprint);
  const { phaseColumns, totalColumns } = computeColumnData(blueprint);
  const lanes = computeLaneOffsets(blueprint, false);

  const colIndex = Math.floor((x - ACTOR_LABEL_WIDTH) / PHASE_WIDTH);
  if (colIndex < 0 || colIndex >= totalColumns) return null;

  let foundPhaseId: string | null = null;
  let foundOrder = 0;
  for (const [phaseId, { startCol, colCount }] of phaseColumns) {
    if (colIndex >= startCol && colIndex < startCol + colCount) {
      foundPhaseId = phaseId;
      foundOrder = colIndex - startCol;
      break;
    }
  }
  if (!foundPhaseId) return null;

  const relY = y - lanes.actorRegionY;
  let cumY = 0;
  let foundActorId: string | null = null;
  for (const actor of sortedActors) {
    const h = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    if (relY >= cumY && relY < cumY + h) {
      foundActorId = actor.id;
      break;
    }
    cumY += h;
  }
  if (!foundActorId) foundActorId = sortedActors[sortedActors.length - 1]?.id ?? null;
  if (!foundActorId) return null;

  return { actorId: foundActorId, phaseId: foundPhaseId, order: foundOrder };
}

// Convert a canvas X coordinate to the column index (0-based, clamped) the
// cursor is currently INSIDE. Used for hit-testing (e.g. lane body click-to-add).
export function getColFromX(x: number, totalColumns: number): number {
  const col = Math.floor((x - ACTOR_LABEL_WIDTH) / PHASE_WIDTH);
  if (col < 0) return 0;
  if (col >= totalColumns) return totalColumns - 1;
  return col;
}

// Convert a canvas X coordinate to the NEAREST column whose center is closest
// to the cursor. Used for symmetric resize/move snapping — crossing the center
// of the next column commits the change in either direction.
export function getColFromXSnap(x: number, totalColumns: number): number {
  const col = Math.round((x - ACTOR_LABEL_WIDTH - PHASE_WIDTH / 2) / PHASE_WIDTH);
  if (col < 0) return 0;
  if (col >= totalColumns) return totalColumns - 1;
  return col;
}
