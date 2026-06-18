import { useState } from 'react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { FrameworkAxis } from '../../types/blueprint';

export function AxisConfigurator({ onClose }: { onClose: () => void }) {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const addFrameworkAxis = useBlueprintStore((s) => s.addFrameworkAxis);
  const updateFrameworkAxis = useBlueprintStore((s) => s.updateFrameworkAxis);
  const removeFrameworkAxis = useBlueprintStore((s) => s.removeFrameworkAxis);

  const axes = blueprint?.frameworkAxes ?? [];

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [lowLabel, setLowLabel] = useState('Low');
  const [highLabel, setHighLabel] = useState('High');

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setTitle('');
    setLowLabel('Low');
    setHighLabel('High');
  };

  const startEdit = (axis: FrameworkAxis) => {
    setAdding(false);
    setEditingId(axis.id);
    setTitle(axis.title);
    setLowLabel(axis.lowLabel);
    setHighLabel(axis.highLabel);
  };

  const saveAxis = () => {
    if (!title.trim()) return;
    if (editingId) {
      updateFrameworkAxis(editingId, { title: title.trim(), lowLabel: lowLabel.trim() || 'Low', highLabel: highLabel.trim() || 'High' });
    } else {
      addFrameworkAxis(title.trim(), lowLabel.trim() || 'Low', highLabel.trim() || 'High');
    }
    setAdding(false);
    setEditingId(null);
    setTitle('');
    setLowLabel('Low');
    setHighLabel('High');
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          width: 440,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Axes Library</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Existing axes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {axes.length === 0 && !adding && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No axes created yet. Add one to get started.
            </p>
          )}
          {axes.map((axis) => (
            <div
              key={axis.id}
              style={{
                padding: '10px 12px',
                background: 'var(--surface-bg-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{axis.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {axis.lowLabel} → {axis.highLabel}
                </div>
              </div>
              <button
                onClick={() => startEdit(axis)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => removeFrameworkAxis(axis.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)', padding: 4 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add/Edit form */}
        {(adding || editingId) && (
          <div style={{ padding: 12, background: 'var(--surface-bg-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Impact, Effort, Feasibility"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: 13,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-bg)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Low end</label>
                  <input
                    value={lowLabel}
                    onChange={(e) => setLowLabel(e.target.value)}
                    placeholder="Low"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: 13,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-bg)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>High end</label>
                  <input
                    value={highLabel}
                    onChange={(e) => setHighLabel(e.target.value)}
                    placeholder="High"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: 13,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-bg)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={cancelEdit} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveAxis} disabled={!title.trim()} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: title.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: title.trim() ? 1 : 0.5 }}>
                  {editingId ? 'Update' : 'Add axis'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add button */}
        {!adding && !editingId && (
          <button
            onClick={startAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              width: '100%',
              justifyContent: 'center',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <Plus size={14} />
            Add axis
          </button>
        )}
      </div>
    </div>
  );
}
