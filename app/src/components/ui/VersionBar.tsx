import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, X, Columns2 } from 'lucide-react';
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
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const editLocked = commentMode || isGuestView || isCollaboratorView;

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [currentDraft, setCurrentDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const currentInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (editingCurrent) currentInputRef.current?.select();
  }, [editingCurrent]);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  if (!blueprint) return null;

  const versions = blueprint.versions ?? [];
  const baseLabel = blueprint.baseVersionName || 'Current';
  const hasVersions = versions.length > 0;

  // Get active version label for display
  const activeLabel = activeVersionId
    ? versions.find((v) => v.id === activeVersionId)?.name ?? baseLabel
    : baseLabel;

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
    setOpen(false);
  };

  const handleCurrentDoubleClick = () => {
    if (editLocked) return;
    setCurrentDraft(baseLabel);
    setEditingCurrent(true);
  };

  const commitCurrent = () => {
    renameBaseVersion(currentDraft);
    setEditingCurrent(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 56,
        left: 16,
        zIndex: 49,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Version pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          maxWidth: 240,
        }}
      >
        {/* Active version label */}
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
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              minWidth: 0,
              width: 120,
            }}
          />
        ) : (
          <button
            onDoubleClick={handleCurrentDoubleClick}
            title={editLocked ? activeLabel : 'Double-click to rename'}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: editLocked ? 'default' : 'text',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 160,
            }}
          >
            {activeLabel}
          </button>
        )}

        {/* Separator + action button */}
        {!editLocked && (
          <button
            onClick={() => {
              if (!hasVersions) {
                // No versions yet — act as direct "add version" button
                setCreating(true);
              } else {
                setOpen((v) => !v);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderLeft: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            {hasVersions ? (
              <ChevronDown
                size={13}
                color="var(--text-muted)"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              />
            ) : (
              <Plus size={13} color="var(--text-muted)" />
            )}
          </button>
        )}
      </div>

      {/* Inline create input — when no versions exist and user clicks "+" */}
      {creating && !hasVersions && (
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
            background: 'var(--surface-bg)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 12px',
            outline: 'none',
            width: 140,
            fontFamily: 'inherit',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
      )}

      {/* Dropdown — shown when versions exist and chevron is open */}
      {open && hasVersions && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          width: 240,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          {/* Version list header */}
          <div style={{ padding: '8px 12px 4px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Versions
            </span>
          </div>

          {/* Base version */}
          <button
            onClick={() => { switchVersion(null); setOpen(false); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: activeVersionId === null ? 'var(--surface-bg-muted)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: activeVersionId === null ? 600 : 400, color: activeVersionId === null ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {baseLabel}
            </span>
          </button>

          {/* Named versions */}
          {versions.map((v) => (
            <VersionRow
              key={v.id}
              label={v.name}
              active={activeVersionId === v.id}
              editLocked={editLocked}
              onActivate={() => { switchVersion(v.id); setOpen(false); }}
              onDelete={() => deleteVersion(v.id)}
              onRename={(name) => renameVersion(v.id, name)}
            />
          ))}

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

          {/* Add new version */}
          {creating ? (
            <div style={{ padding: '6px 12px' }}>
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
                  padding: '4px 10px',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
              }}
            >
              <Plus size={13} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>New version</span>
            </button>
          )}

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

          {/* Compare button inside dropdown */}
          <button
            onClick={handleCompare}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <Columns2 size={13} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Compare versions</span>
          </button>
        </div>
      )}
    </div>
  );
}

function VersionRow({
  label,
  active,
  editLocked,
  onActivate,
  onDelete,
  onRename,
}: {
  label: string;
  active: boolean;
  editLocked?: boolean;
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
    if (editLocked) return;
    setDraft(label);
    setEditing(true);
  };

  const commitEdit = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: '4px 12px' }}>
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
            padding: '4px 10px',
            outline: 'none',
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      </div>
    );
  }

  return (
    <>
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onActivate}
        onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
        title="Double-click to rename"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: active ? 'var(--surface-bg-muted)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {hovered && !editLocked && (
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
            <X size={11} />
          </button>
        )}
      </button>

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
