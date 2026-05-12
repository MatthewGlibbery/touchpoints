import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, FileText, Trash2, LogOut, Share2, Link, Copy, Check, X } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { deleteBlueprint, loadAllBlueprints, getShareToken, createShareToken, deleteShareToken, saveBlueprintCloud } from '../../lib/storage';
import { clearBlueprint } from '../../lib/storage';
import type { Blueprint } from '../../types/blueprint';

export function ProjectBar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const setMode = useBlueprintStore((s) => s.setMode);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);
  const renameBlueprint = useBlueprintStore((s) => s.renameBlueprint);
  const signOut = useBlueprintStore((s) => s.signOut);

  const [open, setOpen] = useState(false);
  const [allBlueprints, setAllBlueprints] = useState<Record<string, Blueprint>>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null | undefined>(undefined); // undefined = not loaded
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
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
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    if (open || shareOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, shareOpen]);

  async function openShare() {
    setShareOpen((v) => !v);
    if (shareToken === undefined && blueprint) {
      setShareLoading(true);
      const token = await getShareToken(blueprint.id);
      setShareToken(token);
      setShareLoading(false);
    }
  }

  async function handleGenerateLink() {
    if (!blueprint) return;
    setShareLoading(true);
    setShareError(null);
    // Ensure the blueprint row exists in Supabase before creating a share token
    await saveBlueprintCloud(blueprint);
    const token = await createShareToken(blueprint.id);
    if (token) {
      setShareToken(token);
    } else {
      setShareError('Could not create share link. Make sure you\'re signed in.');
    }
    setShareLoading(false);
  }

  async function handleRevokeLink() {
    if (!blueprint) return;
    setShareLoading(true);
    await deleteShareToken(blueprint.id);
    setShareToken(null);
    setShareLoading(false);
  }

  function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}${window.location.pathname}?share=${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

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

      {/* Share button + dropdown */}
      {userEmail && (
        <div ref={shareRef} style={{ position: 'relative' }}>
          <button
            onClick={openShare}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              fontSize: 12, fontWeight: 500,
              color: shareOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Share2 size={12} />
            Share
          </button>

          {shareOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              width: 280,
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
              padding: '12px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Share link</span>
              </div>

              {shareLoading ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
              ) : shareToken ? (
                <>
                  <div style={{
                    padding: '7px 10px',
                    background: 'var(--surface-bg-muted)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 11, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {window.location.origin}/?share={shareToken}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleCopyLink}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        padding: '7px', fontSize: 12, fontWeight: 500,
                        color: shareCopied ? 'var(--accent-success)' : 'var(--accent-primary)',
                        background: shareCopied ? 'var(--accent-success-soft)' : 'var(--accent-primary-soft)',
                        border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      }}
                    >
                      {shareCopied ? <Check size={12} /> : <Copy size={12} />}
                      {shareCopied ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={handleRevokeLink}
                      title="Revoke link"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '7px 10px', fontSize: 12,
                        color: 'var(--text-muted)',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Anyone with the link can view this blueprint.
                  </p>
                  {shareError && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--accent-danger)', lineHeight: 1.4 }}>
                      {shareError}
                    </p>
                  )}
                  <button
                    onClick={handleGenerateLink}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px',
                      fontSize: 12, fontWeight: 600,
                      color: 'var(--accent-primary)',
                      background: 'var(--accent-primary-soft)',
                      border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    }}
                  >
                    <Share2 size={13} />
                    Generate share link
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
