import { X, RefreshCw } from 'lucide-react';
import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodeTypes';
import { useBlueprintStore } from '../../store/blueprint.store';
import { blueprintToFlow, getBlueprintForVersion } from '../../lib/layout';

// ─── Module-level sync bridge ─────────────────────────────────────────────────

let _rfA: ReactFlowInstance | null = null;
let _rfB: ReactFlowInstance | null = null;
let _syncing = false;

function syncToB(vp: Viewport) {
  if (_syncing || !_rfB) return;
  _syncing = true;
  _rfB.setViewport(vp, { duration: 0 });
  setTimeout(() => { _syncing = false; }, 50);
}

function syncToA(vp: Viewport) {
  if (_syncing || !_rfA) return;
  _syncing = true;
  _rfA.setViewport(vp, { duration: 0 });
  setTimeout(() => { _syncing = false; }, 50);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SplitCanvas() {
  const blueprint            = useBlueprintStore((s) => s.blueprint);
  const compareVersionIds    = useBlueprintStore((s) => s.compareVersionIds);
  const theme                = useBlueprintStore((s) => s.theme);
  const toggleCompareMode    = useBlueprintStore((s) => s.toggleCompareMode);
  const setCompareVersionIds = useBlueprintStore((s) => s.setCompareVersionIds);
  const compareSyncViewport  = useBlueprintStore((s) => s.compareSyncViewport);
  const setCompareSyncViewport = useBlueprintStore((s) => s.setCompareSyncViewport);

  if (!blueprint) return null;

  const [idA, idB] = compareVersionIds;
  const bpA = getBlueprintForVersion(blueprint, idA);
  const bpB = getBlueprintForVersion(blueprint, idB);
  const { nodes: nodesA, edges: edgesA } = blueprintToFlow(bpA);
  const { nodes: nodesB, edges: edgesB } = blueprintToFlow(bpB);

  const versions = blueprint.versions ?? [];
  const baseLabel = blueprint.baseVersionName || 'Current';
  const labelA = idA === null ? baseLabel : (versions.find((v) => v.id === idA)?.name ?? baseLabel);
  const labelB = idB === null ? baseLabel : (versions.find((v) => v.id === idB)?.name ?? 'Version');

  const rfProps = {
    nodeTypes,
    nodesDraggable: false,
    nodesConnectable: false,
    elementsSelectable: false,
    fitView: true,
    fitViewOptions: { padding: 0.15 },
    panOnScroll: true,
    panOnDrag: [1, 2] as number[],
    minZoom: 0.1,
    colorMode: (theme === 'dark' ? 'dark' : 'light') as 'dark' | 'light',
    style: { background: 'var(--canvas-bg)' },
    proOptions: { hideAttribution: true },
  };

  const versionOptions: { id: string | null; label: string }[] = [
    { id: null, label: baseLabel },
    ...versions.map((v) => ({ id: v.id, label: v.name })),
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--surface-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Compare
        </span>

        <VersionSelect
          value={idA}
          options={versionOptions}
          onChange={(id) => setCompareVersionIds([id, idB])}
        />

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs</span>

        <VersionSelect
          value={idB}
          options={versionOptions}
          onChange={(id) => setCompareVersionIds([idA, id])}
        />

        {/* Sync toggle */}
        <button
          onClick={() => setCompareSyncViewport(!compareSyncViewport)}
          title={compareSyncViewport ? 'Sync on — click to disable' : 'Sync off — click to enable'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: compareSyncViewport ? 'var(--accent-primary)' : 'var(--text-muted)',
            background: compareSyncViewport ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
            border: `1px solid ${compareSyncViewport ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={11} />
          Sync
        </button>

        <button
          onClick={toggleCompareMode}
          title="Exit compare"
          style={{
            position: 'absolute',
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
          Exit compare
        </button>
      </div>

      {/* Split panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ flex: 1, position: 'relative', borderRight: '2px solid var(--border-strong)' }}>
          <VersionLabel label={labelA} />
          <ReactFlow
            nodes={nodesA}
            edges={edgesA}
            {...rfProps}
            onInit={(instance) => { _rfA = instance; }}
            onMove={(_, viewport) => { if (compareSyncViewport) syncToB(viewport); }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--canvas-grid)" />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, position: 'relative' }}>
          <VersionLabel label={labelB} />
          <ReactFlow
            nodes={nodesB}
            edges={edgesB}
            {...rfProps}
            onInit={(instance) => { _rfB = instance; }}
            onMove={(_, viewport) => { if (compareSyncViewport) syncToA(viewport); }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--canvas-grid)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

function VersionLabel({ label }: { label: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      background: 'var(--surface-bg)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-sm)',
      pointerEvents: 'none',
    }}>
      {label}
    </div>
  );
}

function VersionSelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: { id: string | null; label: string }[];
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      value={value ?? '__base__'}
      onChange={(e) => onChange(e.target.value === '__base__' ? null : e.target.value)}
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-primary)',
        background: 'var(--surface-bg-muted)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '4px 8px',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.id ?? '__base__'} value={o.id ?? '__base__'}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
