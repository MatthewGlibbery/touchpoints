import { useState, useRef, useEffect } from 'react';
import { X, Plus, FileText, Trash2, LogOut, Eye, Sun, Moon } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { deleteBlueprint, loadAllBlueprints } from '../../lib/storage';
import { clearBlueprint } from '../../lib/storage';
import type { Blueprint } from '../../types/blueprint';
import { NotificationsBell } from './NotificationsBell';

export function ProjectBar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const displayName = useBlueprintStore((s) => s.displayName);
  const setMode = useBlueprintStore((s) => s.setMode);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);
  const renameBlueprint = useBlueprintStore((s) => s.renameBlueprint);
  const signOut = useBlueprintStore((s) => s.signOut);
  const theme = useBlueprintStore((s) => s.theme);
  const toggleTheme = useBlueprintStore((s) => s.toggleTheme);
  const commentMode = useBlueprintStore((s) => s.commentMode);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const editLocked = commentMode || isGuestView || isCollaboratorView;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allBlueprints, setAllBlueprints] = useState<Record<string, Blueprint>>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  function openSidebar() {
    setAllBlueprints(loadAllBlueprints());
    setSidebarOpen(true);
  }

  function handleNew() {
    if (editLocked) return;
    clearBlueprint();
    setMode('onboarding');
    setSidebarOpen(false);
  }

  function handleSwitch(id: string) {
    switchToBlueprint(id);
    setSidebarOpen(false);
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

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const bpList = Object.values(allBlueprints).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Trigger pill — project name, click to open sidebar */}
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
            onClick={openSidebar}
            onDoubleClick={(e) => { e.stopPropagation(); startEditTitle(); }}
            title={editLocked ? blueprint?.name : 'Click to open projects · Double-click to rename'}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              cursor: editLocked ? 'default' : 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            {blueprint?.name ?? 'Untitled'}
          </button>
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

      {/* Notifications bell — next to board title */}
      <NotificationsBell />

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.2)',
            zIndex: 9000,
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 300,
          background: 'var(--surface-bg)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 9001,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sidebar header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Projects
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-muted)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {bpList.map((bp) => (
            <button
              key={bp.id}
              onClick={() => handleSwitch(bp.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: bp.id === blueprint?.id ? 'var(--surface-bg-muted)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (bp.id !== blueprint?.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (bp.id !== blueprint?.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <FileText size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bp.name}
              </span>
              {bp.id !== blueprint?.id && !editLocked && (
                <button
                  onClick={(e) => handleDelete(e, bp.id)}
                  style={{ color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-danger)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </button>
          ))}

          {/* New project button */}
          {!editLocked && (
            <button
              onClick={handleNew}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Plus size={14} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>New project</span>
            </button>
          )}
        </div>

        {/* Sidebar footer — theme toggle + account + sign out */}
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Account info */}
          {userEmail && (
            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                {displayName && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
              <button
                onClick={() => { setSidebarOpen(false); signOut(); }}
                title="Sign out"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-bg-muted)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOut size={11} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
