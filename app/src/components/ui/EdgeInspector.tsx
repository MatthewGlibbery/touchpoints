import { useState, useEffect } from 'react';
import { X, ArrowRight, GitBranch, Link, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { EdgeMeta } from '../../types/blueprint';
import { Panel, IconButton, FieldBlock, inputStyle } from './primitives';

const FLOW_TYPES: { id: NonNullable<EdgeMeta['flowType']>; label: string; color: string }[] = [
  { id: 'sequence',   label: 'Sequence',   color: '#CBD5E1' },
  { id: 'dependency', label: 'Dependency', color: '#8B5CF6' },
  { id: 'decision',   label: 'Decision',   color: '#F59E0B' },
];

export function EdgeInspector() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const selectedEdgeId = useBlueprintStore((s) => s.selectedEdgeId);
  const edgeInspectorOpen = useBlueprintStore((s) => s.edgeInspectorOpen);
  const setSelectedEdge = useBlueprintStore((s) => s.setSelectedEdge);
  const updateEdgeMeta = useBlueprintStore((s) => s.updateEdgeMeta);
  const removeEdge = useBlueprintStore((s) => s.removeEdge);
  const commentMode = useBlueprintStore((s) => s.commentMode);

  const [labelDraft, setLabelDraft] = useState('');

  const meta = selectedEdgeId ? (blueprint?.edgeMeta?.[selectedEdgeId] ?? {}) : null;

  useEffect(() => {
    setLabelDraft(meta?.label ?? '');
  }, [selectedEdgeId]);

  if (!edgeInspectorOpen || !selectedEdgeId || meta === null) return null;
  if (commentMode) return null; // Edges open the comment thread instead

  const saveLabel = () => {
    const v = labelDraft.trim();
    if (v !== (meta.label ?? '')) updateEdgeMeta(selectedEdgeId, { label: v || undefined });
  };

  return (
    <Panel
      animateFrom="bottom"
      style={{
        position: 'fixed',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 360,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Connection</span>
        </div>
        <IconButton icon={<X size={13} />} onClick={() => setSelectedEdge(null)} />
      </div>
      {/* Divider scoped to content width */}
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 16px' }} />

      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Flow type */}
        <FieldBlock label="Type">
          <div style={{ display: 'flex', gap: 6 }}>
            {FLOW_TYPES.map((ft) => {
              const active = (meta.flowType ?? 'sequence') === ft.id;
              return (
                <button
                  key={ft.id}
                  onClick={() => updateEdgeMeta(selectedEdgeId, { flowType: ft.id })}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    background: active ? ft.color + '22' : 'transparent',
                    color: active ? ft.color : 'var(--text-muted)',
                    border: `1px solid ${active ? ft.color : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast), color var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  {ft.id === 'sequence' ? <ArrowRight size={10} /> : <GitBranch size={10} />}
                  {ft.label}
                </button>
              );
            })}
          </div>
        </FieldBlock>

        {/* Label */}
        <FieldBlock label="Label (optional)">
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="e.g. happy path, fallback…"
            style={inputStyle}
          />
        </FieldBlock>

        {/* Remove */}
        <button
          onClick={() => { removeEdge(selectedEdgeId); setSelectedEdge(null); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '7px 0',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent-danger)',
            border: '1px solid var(--accent-danger)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: 0.75,
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
        >
          <Trash2 size={12} />
          Remove connection
        </button>
      </div>
    </Panel>
  );
}
