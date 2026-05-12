import { useState, useRef, useEffect } from 'react';
import { Plus, X, Columns2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export function VersionBar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const activeVersionId = useBlueprintStore((s) => s.activeVersionId);
  const createVersion = useBlueprintStore((s) => s.createVersion);
  const switchVersion = useBlueprintStore((s) => s.switchVersion);
  const deleteVersion = useBlueprintStore((s) => s.deleteVersion);
  const renameVersion = useBlueprintStore((s) => s.renameVersion);
  const toggleCompareMode = useBlueprintStore((s) => s.toggleCompareMode);
  const setCompareVersionIds = useBlueprintStore((s) => s.setCompareVersionIds);
  const renameBaseVersion = useBlueprintStore((s) => s.renameBaseVersion);

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [currentDraft, setCurrentDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (editingCurrent) currentInputRef.current?.select();
  }, [editingCurrent]);

  if (!blueprint) return null;

  const versions = blueprint.versions ?? [];

  const handleCreate = () => {
    const name = draftName.trim() || 'Future State';
    createVersion(name);
    setCreating(false);
    setDraftName('');
  };

  const handleCompare = () => {
    const firstVersionId = versions[0]?.id ?? null;
    setCompareVersionIds([null, activeVersionId ?? firstVersionId]);
    toggleCompareMode();
  };

  const baseLabel = blueprint.baseVersionName || 'Current';

  const handleCurrentDoubleClick = () => {
    setCurrentDraft(baseLabel);
    setEditingCurrent(true);
  };

  const commitCurrent = () => {
    renameBaseVersion(currentDraft);
    setEditingCurrent(false);
  };

  const pillBase: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background var(--transition-fast)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  };

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: 16,
      zIndex: 49,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {/* Version tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        padding: '4px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Current tab (was "Base") */}
        {editingCurrent ? (
          <input
            ref={currentInputRef}
            value={currentDraft}
            onChange={(e) => setCurrentDraft(e.target.value)}
            onBlur={commitCurrent}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCurrent();
              if (e.key === 'Escape') setEditingCurrent(false);
            }}
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--surface-bg-muted)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px 8px',
              outline: 'none',
              width: 120,
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <button
            onClick={() => switchVersion(null)}
            onDoubleClick={handleCurrentDoubleClick}
            title="Double-click to rename"
            style={{
              ...pillBase,
              color: activeVersionId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: activeVersionId === null ? 'var(--surface-bg-muted)' : 'transparent',
              fontWeight: activeVersionId === null ? 600 : 400,
            }}
          >
            {baseLabel}
          </button>
        )}

        {/* Named version tabs */}
        {versions.map((v) => (
          <VersionTab
            key={v.id}
            label={v.name}
            active={activeVersionId === v.id}
            onActivate={() => switchVersion(v.id)}
            onDelete={() => deleteVersion(v.id)}
            onRename={(name) => renameVersion(v.id, name)}
          />
        ))}

        {/* New version input or button */}
        {creating ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => { if (draftName.trim()) handleCreate(); else setCreating(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setDraftName(''); }
            }}
            placeholder="Version name…"
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--surface-bg-muted)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px 8px',
              outline: 'none',
              width: 120,
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            title="Fork current version"
            style={{
              ...pillBase,
              padding: '5px 8px',
              color: 'var(--text-muted)',
              background: 'transparent',
            }}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Compare button — only when versions exist */}
      {versions.length > 0 && (
        <button
          onClick={handleCompare}
          title="Compare versions side by side"
          style={{
            ...pillBase,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
            color: 'var(--text-secondary)',
            padding: '9px 12px',
          }}
        >
          <Columns2 size={12} />
          Compare
        </button>
      )}
    </div>
  );
}

function VersionTab({
  label,
  active,
  onActivate,
  onDelete,
  onRename,
}: {
  label: string;
  active: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(label);
    setEditing(true);
  };

  const commitEdit = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          background: 'var(--surface-bg-muted)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 8px',
          outline: 'none',
          width: 100,
          fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderRadius: 'var(--radius-pill)',
          background: active ? 'var(--surface-bg-muted)' : 'transparent',
          padding: '1px 2px 1px 8px',
        }}
      >
        <button
          onClick={onActivate}
          onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
          title="Double-click to rename"
          style={{
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '3px 2px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </button>
        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            title={`Delete "${label}"`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              borderRadius: 3,
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          title={`Delete version "${label}"`}
          description="This version will be permanently removed. This cannot be undone."
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
