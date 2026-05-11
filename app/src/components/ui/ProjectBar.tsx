import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, FileText, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { deleteBlueprint, loadAllBlueprints } from '../../lib/storage';
import { clearBlueprint } from '../../lib/storage';
import type { Blueprint } from '../../types/blueprint';

export function ProjectBar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const setMode = useBlueprintStore((s) => s.setMode);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);
  const renameBlueprint = useBlueprintStore((s) => s.renameBlueprint);

  const [open, setOpen] = useState(false);
  const [allBlueprints, setAllBlueprints] = useState<Record<string, Blueprint>>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  function openDropdown() {
    setAllBlueprints(loadAllBlueprints());
    setOpen(true);
  }

  function handleNew() {
    clearBlueprint();
    setMode('onboarding');
    setOpen(false);
  }

  function handleSwitch(id: string) {
    switchToBlueprint(id);
    setOpen(false);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteBlueprint(id);
    setAllBlueprints(loadAllBlueprints());
    if (blueprint?.id === id) handleNew();
  }

  function startEditTitle() {
    setTitleDraft(blueprint?.name ?? '');
    setEditingTitle(true);
  }

  function commitTitle() {
    renameBlueprint(titleDraft);
    setEditingTitle(false);
  }

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const bpList = Object.values(allBlueprints).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div ref={ref} style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Trigger pill */}
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
        {/* Editable title */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setEditingTitle(false);
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
            }}
          />
        ) : (
          <button
            onClick={startEditTitle}
            title="Click to rename blueprint"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'text',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 180,
            }}
          >
            {blueprint?.name ?? 'Untitled'}
          </button>
        )}

        {/* Chevron → opens dropdown */}
        <button
          onClick={() => (open ? setOpen(false) : openDropdown())}
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
          <ChevronDown
            size={13}
            color="var(--text-muted)"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          width: 260,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          {bpList.length > 0 && (
            <>
              <div style={{ padding: '8px 12px 4px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Projects
                </span>
              </div>
              {bpList.map((bp) => (
                <button
                  key={bp.id}
                  onClick={() => handleSwitch(bp.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: bp.id === blueprint?.id ? 'var(--surface-bg-muted)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileText size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bp.name}
                  </span>
                  {bp.id !== blueprint?.id && (
                    <button
                      onClick={(e) => handleDelete(e, bp.id)}
                      style={{ color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            </>
          )}

          <button
            onClick={handleNew}
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
            <span style={{ fontSize: 13, fontWeight: 500 }}>New project</span>
          </button>
        </div>
      )}
    </div>
  );
}
