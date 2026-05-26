import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, FileText, Trash2, LogOut, Eye } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { deleteBlueprint, loadAllBlueprints } from '../../lib/storage';
import { clearBlueprint } from '../../lib/storage';
import type { Blueprint } from '../../types/blueprint';

export function ProjectBar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const setMode = useBlueprintStore((s) => s.setMode);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);
  const renameBlueprint = useBlueprintStore((s) => s.renameBlueprint);
  const signOut = useBlueprintStore((s) => s.signOut);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const editLocked = commentMode || isGuestView || isCollaboratorView;

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
    if (editLocked) return;
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
    if (editLocked) return;
    deleteBlueprint(id);
    setAllBlueprints(loadAllBlueprints());
    if (blueprint?.id === id) handleNew();
  }

  function startEditTitle() {
    if (editLocked) return;
    setTitleDraft(blueprint?.name ?? '');
    setEditingTitle(true);
  }

  function commitTitle() {
    if (editLocked) { setEditingTitle(false); return; }
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
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            title={editLocked ? blueprint?.name : 'Click to rename blueprint'}
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

          {userEmail && (
            <>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <div style={{ padding: '6px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {userEmail}
                </span>
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  title="Sign out"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                  }}
                >
                  <LogOut size={11} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>

      {/* Collaborator read-only indicator */}
      {isCollaboratorView && (
        <div
          title="You're viewing this blueprint as a collaborator. You can comment but not edit."
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent-primary)',
            background: 'var(--accent-primary-soft)',
            border: '1px solid var(--accent-primary-soft)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Eye size={11} />
          Viewing as collaborator
        </div>
      )}
    </div>
  );
}
