import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow, ConnectionMode, ConnectionLineType,
  applyNodeChanges, useStore,
  type Connection, type Edge, type ReactFlowInstance, type Node, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Trash2 } from 'lucide-react';
import { ZoomToolbar } from './ZoomToolbar';
import { DotBackground } from './DotBackground';
import { nodeTypes, edgeTypes } from './nodeTypes';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { useCommentsStore } from '../../store/comments.store';

import { useBlueprintStore } from '../../store/blueprint.store';
import { getCellFromPosition, ACTION_NODE_WIDTH, ACTION_NODE_HEIGHT, estimateActionHeight, ACTOR_LABEL_WIDTH, PHASE_WIDTH, computeColumnData, computeActorRowHeights, computeLaneOffsets } from '../../lib/layout';
import { registerViewport } from '../../lib/viewportBridge';

export function BlueprintCanvas() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const storeNodes = useBlueprintStore((s) => s.rfNodes);
  const rfEdges = useBlueprintStore((s) => s.rfEdges);
  const effectiveActors = useBlueprintStore((s) => s.effectiveActors);
  const updateAction = useBlueprintStore((s) => s.updateAction);
  const removeAction = useBlueprintStore((s) => s.removeAction);
  const setSelectedNode = useBlueprintStore((s) => s.setSelectedNode);
  const setDragTarget = useBlueprintStore((s) => s.setDragTarget);
  const setDraggingNode = useBlueprintStore((s) => s.setDraggingNode);
  const setSelectedEdge = useBlueprintStore((s) => s.setSelectedEdge);
  const setSelectedColumnKey = useBlueprintStore((s) => s.setSelectedColumnKey);
  const setSelectedLaneSegment = useBlueprintStore((s) => s.setSelectedLaneSegment);
  const setSelectedLaneId = useBlueprintStore((s) => s.setSelectedLaneId);
  const setSelectedPhase = useBlueprintStore((s) => s.setSelectedPhase);
  const setDragOverInserterId = useBlueprintStore((s) => s.setDragOverInserterId);
  const insertSubstep = useBlueprintStore((s) => s.insertSubstep);
  const addCustomEdge = useBlueprintStore((s) => s.addCustomEdge);
  const reconnectEdge = useBlueprintStore((s) => s.reconnectEdge);
  const theme = useBlueprintStore((s) => s.theme);
  const presentMode = useBlueprintStore((s) => s.presentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const canvasView = useBlueprintStore((s) => s.canvasView);
  // setCanvasView not used here — canvasView is changed via ViewRail only
  const actorDragOffset = useBlueprintStore((s) => s.actorDragOffset);
  const phaseDragOffset = useBlueprintStore((s) => s.phaseDragOffset);
  const draggingNodeId = useBlueprintStore((s) => s.draggingNodeId);
  const setMultiSelectedNodeIds = useBlueprintStore((s) => s.setMultiSelectedNodeIds);
  const overviewMode = useBlueprintStore((s) => s.overviewMode);
  const clearOverviewCell = useBlueprintStore((s) => s.clearOverviewCell);
  const commentMode = useBlueprintStore((s) => s.commentMode);

  // Local node state so ReactFlow can update positions during drag
  const [nodes, setNodes] = useState<Node[]>(storeNodes);
  const [selectedActionNodes, setSelectedActionNodes] = useState<Node[]>([]);
  const [confirmMultiDelete, setConfirmMultiDelete] = useState(false);
  const isDraggingRef = useRef(false);
  const didFitView = useRef(false);

  // Sync store → local nodes, but not while a drag is in progress.
  // Also triggers the initial fitView the first time nodes populate (handles the
  // onboarding → canvas transition where onInit already fired with an empty blueprint).
  useEffect(() => {
    if (isDraggingRef.current) return;
    setNodes(storeNodes);
    if (!didFitView.current && storeNodes.length > 0) {
      didFitView.current = true;
      requestAnimationFrame(() => rfInstanceRef.current?.fitView({ padding: 0.15 }));
    }
  }, [storeNodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const onNodeDragStart = useCallback(
    (_event: unknown, node: { type?: string; id: string }) => {
      if (node.type !== 'action') return;
      isDraggingRef.current = true;
      setDraggingNode(node.id.replace('action-', ''));
      setDragOverInserterId(null);
    },
    [setDraggingNode, setDragOverInserterId]
  );

  const onNodeDrag = useCallback(
    (_event: unknown, node: { type?: string; id: string; position: { x: number; y: number } }) => {
      if (!blueprint || node.type !== 'action') return;
      const actionId = node.id.replace('action-', '');
      const action = blueprint.actions.find((a) => a.id === actionId);
      const nodeH = action ? estimateActionHeight(action) : ACTION_NODE_HEIGHT;
      const cx = node.position.x + ACTION_NODE_WIDTH / 2;
      const cy = node.position.y + nodeH / 2;
      const cell = getCellFromPosition(cx, cy, blueprint);
      setDragTarget(cell);

      // Detect proximity to column inserter boundaries (within 15px of boundary x)
      const SNAP_RANGE = 15;
      const { phaseColumns } = computeColumnData(blueprint);
      const { actorRegionY } = computeLaneOffsets(blueprint, false);
      let foundInserterId: string | null = null;
      for (const [phaseId, { startCol, colCount }] of phaseColumns) {
        for (let order = 0; order <= colCount; order++) {
          const boundaryX = ACTOR_LABEL_WIDTH + (startCol + order) * PHASE_WIDTH;
          if (Math.abs(cx - boundaryX) < SNAP_RANGE) {
            // Verify y is in the canvas body (not header)
            if (cy > actorRegionY) {
              foundInserterId = `inserter-${phaseId}-${order}`;
            }
            break;
          }
        }
        if (foundInserterId) break;
      }
      setDragOverInserterId(foundInserterId);
    },
    [blueprint, setDragTarget, setDragOverInserterId]
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: { type?: string; id: string; position: { x: number; y: number } }) => {
      isDraggingRef.current = false;
      setDragTarget(null);
      setDraggingNode(null);
      if (!blueprint || node.type !== 'action') return;
      const actionId = node.id.replace('action-', '');
      const action = blueprint.actions.find((a) => a.id === actionId);
      const nodeH = action ? estimateActionHeight(action) : ACTION_NODE_HEIGHT;
      const cx = node.position.x + ACTION_NODE_WIDTH / 2;
      const cy = node.position.y + nodeH / 2;

      // Check if dropped near a column inserter — insert new column and place card there
      const { dragOverInserterId: currentOverId } = useBlueprintStore.getState();
      setDragOverInserterId(null);

      const { actorRegionY: dropActorY } = computeLaneOffsets(blueprint, false);
      if (currentOverId && cy > dropActorY) {
        // Parse inserter id: "inserter-{phaseId}-{order}"
        const parts = currentOverId.split('-');
        const atOrder = parseInt(parts[parts.length - 1], 10);
        const phaseId = parts.slice(1, -1).join('-');
        if (!isNaN(atOrder) && phaseId) {
          // Determine which actor row the card is in
          const rowHeights = computeActorRowHeights(blueprint);
          const sortedActors = [...effectiveActors].sort((a, b) => a.order - b.order);
          let cumY = 0;
          let targetActorId = sortedActors[0]?.id ?? '';
          for (const actor of sortedActors) {
            const h = rowHeights.get(actor.id) ?? 200;
            if (cy - dropActorY >= cumY && cy - dropActorY < cumY + h) {
              targetActorId = actor.id;
              break;
            }
            cumY += h;
          }
          // Insert the new substep column, which shifts existing orders >= atOrder up by 1
          insertSubstep(phaseId, atOrder);
          // After insert, the new column is at atOrder; place this card there
          updateAction(actionId, { actorId: targetActorId, phaseId, order: atOrder });
          return;
        }
      }

      const cell = getCellFromPosition(cx, cy, blueprint);
      if (!cell) return;
      updateAction(actionId, { actorId: cell.actorId, phaseId: cell.phaseId, order: cell.order });
    },
    [blueprint, updateAction, setDragTarget, setDraggingNode, setDragOverInserterId, insertSubstep]
  );

  const openThread = useCommentsStore((s) => s.openThread);
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: { id: string }) => {
      if (commentMode) {
        openThread({ type: 'edge', id: edge.id }, { x: event.clientX, y: event.clientY });
        return;
      }
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge, commentMode, openThread]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      addCustomEdge(
        connection.source.replace('action-', ''),
        connection.target.replace('action-', ''),
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined,
      );
    },
    [addCustomEdge]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target || newConnection.source === newConnection.target) return;
      reconnectEdge(
        oldEdge.id,
        newConnection.source.replace('action-', ''),
        newConnection.target.replace('action-', ''),
        newConnection.sourceHandle ?? undefined,
        newConnection.targetHandle ?? undefined,
      );
    },
    [reconnectEdge]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
    registerViewport(
      (vp, opts) => instance.setViewport(vp, opts ?? {}),
      () => instance.getViewport(),
      (opts) => instance.fitView(opts ?? {}),
      (x, y, opts) => instance.setCenter(x, y, opts ?? {}),
    );
    // Fit view on every canvas mount (handles return from storyboard/compare mode)
    requestAnimationFrame(() => instance.fitView({ padding: 0.15, duration: 500 }));
  }, []);

  useEffect(() => {
    if (canvasView !== 'edit') {
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 700 }), 50);
    }
  }, [canvasView]);

  // Fit view only when ENTERING overview — the simplified layout needs a zoom-to-fit.
  // On exit, the viewport is left as-is (user either zoomed in manually, or Details button
  // triggers its own fitView explicitly after the nodes update).
  const prevOverviewMode = useRef(overviewMode);
  useEffect(() => {
    if (prevOverviewMode.current !== overviewMode) {
      prevOverviewMode.current = overviewMode;
      if (overviewMode) {
        setTimeout(() =>
          rfInstanceRef.current?.fitView({ padding: 0.15, duration: 500 }),
          360
        );
      }
    }
  }, [overviewMode]);

  const onSelectionChange = useCallback(
    ({ nodes: changedNodes }: { nodes: Node[] }) => {
      const actionNodes = changedNodes.filter((n) => n.type === 'action');
      setSelectedActionNodes(actionNodes);
      // Only populate multiSelectedNodeIds when 2+ nodes are selected (lasso or shift+click).
      // Single-node selection is handled by setSelectedNode (opens inspector).
      if (actionNodes.length >= 2) {
        setMultiSelectedNodeIds(actionNodes.map((n) => n.id.replace('action-', '')));
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedPhase(null);
      } else if (actionNodes.length <= 1) {
        // Don't clear multiSelectedNodeIds here — shift+click manages it directly.
        // Only clear if ReactFlow is telling us lasso deselected everything.
        const current = useBlueprintStore.getState().multiSelectedNodeIds;
        if (current.length > 0 && actionNodes.length === 0) {
          setMultiSelectedNodeIds([]);
        }
        setSelectedActionNodes([]);
      }
    },
    [setSelectedNode, setSelectedEdge, setSelectedPhase, setMultiSelectedNodeIds]
  );

  const onPaneClick = useCallback(() => {
    // Close any open panels, but do NOT reset canvasView — user stays in pain/opp/question mode
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedColumnKey(null);
    setSelectedLaneSegment(null);
    setSelectedLaneId(null);
    setSelectedPhase(null);
    setMultiSelectedNodeIds([]);
    clearOverviewCell();
  }, [setSelectedNode, setSelectedEdge, setSelectedColumnKey, setSelectedLaneSegment, setSelectedLaneId, setSelectedPhase, setMultiSelectedNodeIds, clearOverviewCell]);

  const displayNodes = useMemo(() => {
    const EDITING = ['emptyCell', 'columnInserter', 'columnOverlay', 'phaseBoundary', 'phaseAdder', 'actorAdder', 'timelineAdder', 'statusAdder'];
    const base = (presentMode || overviewMode || isGuestView || commentMode || isCollaboratorView) ? nodes.filter((n) => !EDITING.includes(n.type ?? '')) : nodes;

    if (!actorDragOffset && !phaseDragOffset && !draggingNodeId) return base;

    return base.map((n) => {
      let dx = 0, dy = 0, noTransition = false;

      // Action card being dragged by ReactFlow — must follow cursor with no lag
      if (draggingNodeId && n.id === `action-${draggingNodeId}`) {
        noTransition = true;
      }

      if (actorDragOffset) {
        const { actorId, offsetY } = actorDragOffset;
        const belongs =
          n.id === `actor-${actorId}` ||
          n.id === `swimlane-${actorId}` ||
          (n.type === 'action' && (n.data as any).action?.actorId === actorId) ||
          (n.type === 'emptyCell' && (n.data as any).actorId === actorId);
        if (belongs) { dy = offsetY; noTransition = true; }
      }

      if (phaseDragOffset) {
        const { phaseId, offsetX } = phaseDragOffset;
        const belongs =
          n.id === `phase-${phaseId}` ||
          (n.type === 'action' && (n.data as any).action?.phaseId === phaseId) ||
          (n.type === 'emptyCell' && (n.data as any).phaseId === phaseId) ||
          n.id.startsWith(`inserter-${phaseId}-`) ||
          n.id.startsWith(`coloverlay-${phaseId}-`);
        if (belongs) { dx = offsetX; noTransition = true; }
      }

      if (dx === 0 && dy === 0 && !noTransition) return n;

      return {
        ...n,
        position: { x: n.position.x + dx, y: n.position.y + dy },
        zIndex: (dx !== 0 || dy !== 0) ? 100 : (n.zIndex ?? 0),
        style: noTransition
          ? { ...(n.style ?? {}), transition: 'none' }
          : n.style,
      };
    });
  }, [nodes, presentMode, overviewMode, isGuestView, commentMode, isCollaboratorView, actorDragOffset, phaseDragOffset, draggingNodeId]);

  const handleMultiDelete = useCallback(() => {
    selectedActionNodes.forEach((n) => removeAction(n.id.replace('action-', '')));
    setSelectedActionNodes([]);
    setMultiSelectedNodeIds([]);
    setConfirmMultiDelete(false);
  }, [selectedActionNodes, removeAction, setMultiSelectedNodeIds]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onInit={onInit}
        onSelectionChange={onSelectionChange}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: 'var(--accent-primary)', strokeWidth: 1.5 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesReconnectable={!presentMode && !isGuestView && !commentMode && !isCollaboratorView}
        nodesDraggable={!presentMode && !overviewMode && !isGuestView && !commentMode && !isCollaboratorView}
        nodesConnectable={!presentMode && !isGuestView && !commentMode && !isCollaboratorView}
        nodeDragThreshold={1}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        selectionOnDrag={!presentMode && !isGuestView && !commentMode && !isCollaboratorView}
        panOnDrag={[1, 2]}
        zoomOnDoubleClick={false}
        disableKeyboardA11y={true}
        style={{ background: 'var(--canvas-bg)' }}
        proOptions={{ hideAttribution: true }}
      >
        <DotBackground />
        <ZoomToolbar />
        {selectedActionNodes.length > 1 && (
          <SelectionToolbar
            selectedNodes={selectedActionNodes}
            onDelete={() => setConfirmMultiDelete(true)}
          />
        )}
        {/* TODO: Revisit minimap — hidden for now to reduce visual noise */}
      </ReactFlow>
      {confirmMultiDelete && (
        <ConfirmDeleteModal
          title={`Delete ${selectedActionNodes.length} steps?`}
          description={`This will permanently remove ${selectedActionNodes.length} selected steps and any pain points, opportunities, or questions that only belong to them.`}
          onConfirm={handleMultiDelete}
          onCancel={() => setConfirmMultiDelete(false)}
        />
      )}
    </div>
  );
}

// Renders inside <ReactFlow> so it can access the ReactFlow viewport store
function SelectionToolbar({ selectedNodes, onDelete }: { selectedNodes: Node[]; onDelete: () => void }) {
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;

  let minX = Infinity, minY = Infinity, maxX = -Infinity;
  for (const n of selectedNodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + ACTION_NODE_WIDTH);
  }

  const screenCenterX = ((minX + maxX) / 2) * zoom + tx;
  const screenTopY = minY * zoom + ty - 48;

  return (
    <div
      style={{
        position: 'absolute',
        left: screenCenterX,
        top: Math.max(8, screenTopY),
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-pill)',
        padding: '5px 10px 5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: 'var(--shadow-md)',
        pointerEvents: 'all',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
        {selectedNodes.length} steps selected
      </span>
      <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button
        onClick={onDelete}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent-danger)',
          fontSize: 12,
          fontWeight: 500,
          padding: '3px 6px',
          borderRadius: 'var(--radius-sm)',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}
