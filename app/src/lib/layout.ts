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
export const ACTION_NODE_HEIGHT = 140;
export const ACTION_NODE_HEIGHT_MEDIA = 240;
export const ROW_HEIGHT = 200;
export const ROW_HEIGHT_MEDIA = 300;
export const H_CELL_PAD = Math.round((PHASE_WIDTH - ACTION_NODE_WIDTH) / 2);  // 30 — horizontal centering
export const V_CELL_PAD = Math.round((ROW_HEIGHT - ACTION_NODE_HEIGHT) / 2);  // 30 — vertical centering
export const OVERVIEW_CARD_HEIGHT = 56;  // fixed card height for overview mode nodes
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

  // ─── Swimlane backgrounds ─────────────────────────────────────────────────
  sortedActors.forEach((actor, i) => {
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    nodes.push({
      id: `swimlane-${actor.id}`,
      type: 'swimlane',
      position: { x: ACTOR_LABEL_WIDTH, y: PHASE_HEADER_HEIGHT + actorY },
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
        position: { x: ACTOR_LABEL_WIDTH + colIndex * PHASE_WIDTH, y: PHASE_HEADER_HEIGHT },
        data: { phaseId: phase.id, order, colCount: col.colCount, height: totalCanvasHeight },
        draggable: false, selectable: false, zIndex: 0,
        style: { pointerEvents: 'all' },
      });
    }
  });

  // ─── Phase headers ────────────────────────────────────────────────────────
  sortedPhases.forEach((phase) => {
    const col = phaseColumns.get(phase.id)!;
    nodes.push({
      id: `phase-${phase.id}`,
      type: 'phaseHeader',
      position: { x: ACTOR_LABEL_WIDTH + col.startCol * PHASE_WIDTH, y: 0 },
      data: { phase, width: col.colCount * PHASE_WIDTH, colCount: col.colCount },
      draggable: false, selectable: false,
      style: { pointerEvents: 'all' },
    });
  });

  // ─── Actor labels ─────────────────────────────────────────────────────────
  sortedActors.forEach((actor) => {
    const rowH = rowHeights.get(actor.id) ?? ROW_HEIGHT;
    const actorY = actorYOffsets.get(actor.id) ?? 0;
    nodes.push({
      id: `actor-${actor.id}`,
      type: 'actorLabel',
      position: { x: 0, y: PHASE_HEADER_HEIGHT + actorY },
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
    const y = PHASE_HEADER_HEIGHT + actorY + vPad;

    occupiedCells.add(`${action.actorId}:${action.phaseId}:${action.order}`);

    nodes.push({
      id: `action-${action.id}`,
      type: 'action',
      position: { x, y },
      data: { action, actorColor: actor.color, actorOrder: actor.order },
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
            y: PHASE_HEADER_HEIGHT + actorY + vPad,
          },
          data: { actorId: actor.id, phaseId: phase.id, order, actorColor: actor.color },
          draggable: false, selectable: false, zIndex: 0,
          style: { pointerEvents: 'all' },
        });
      }
    });
  });

  // ─── Column inserters (between sub-steps within a phase) ──────────────────
  // Line spans from top of first card row to bottom of last card row
  const NODE_Y = 4;
  const LINE_ROW_PAD = 30; // top/bottom padding within each row (half of V_PAD=60)
  const lineStart = PHASE_HEADER_HEIGHT - NODE_Y + LINE_ROW_PAD;
  const lineEnd   = PHASE_HEADER_HEIGHT + totalCanvasHeight - LINE_ROW_PAD - NODE_Y;
  sortedPhases.forEach((phase) => {
    const col = phaseColumns.get(phase.id)!;
    // One inserter for each boundary: before col 0, between each pair, after last
    for (let order = 0; order <= col.colCount; order++) {
      const x = ACTOR_LABEL_WIDTH + (col.startCol + order) * PHASE_WIDTH;
      nodes.push({
        id: `inserter-${phase.id}-${order}`,
        type: 'columnInserter',
        position: { x: x - 12, y: NODE_Y },
        data: {
          phaseId: phase.id,
          atOrder: order,
          canvasHeight: totalCanvasHeight + PHASE_HEADER_HEIGHT,
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
    position: { x: ACTOR_LABEL_WIDTH + totalColumns * PHASE_WIDTH + 12, y: 8 },
    data: {},
    draggable: false, selectable: false, zIndex: 25,
    style: { pointerEvents: 'all' },
  });

  // ─── Add actor button ─────────────────────────────────────────────────────
  nodes.push({
    id: 'add-actor-btn',
    type: 'actorAdder',
    position: { x: 0, y: PHASE_HEADER_HEIGHT + totalCanvasHeight + 4 },
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
      position: { x: boundaryX - 8, y: 0 },
      data: {
        leftPhaseId: left.id,
        rightPhaseId: right.id,
        canvasHeight: totalCanvasHeight + PHASE_HEADER_HEIGHT,
      },
      draggable: false, selectable: false, zIndex: 25,
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
    });
  });

  const removed = new Set(blueprint.removedEdgeIds ?? []);
  return { nodes, edges: removed.size > 0 ? edges.filter((e) => !removed.has(e.id)) : edges };
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

  const relY = y - PHASE_HEADER_HEIGHT;
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
