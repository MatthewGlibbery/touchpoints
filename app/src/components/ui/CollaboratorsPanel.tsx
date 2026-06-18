import { useEffect, useRef, useState } from 'react';
import { Users, Mail, Clock, Check, Trash2, Link, Copy, X, Share2, FileDown } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { useCommentsStore } from '../../store/comments.store';
import { getShareToken, createShareToken, deleteShareToken, saveBlueprintCloud } from '../../lib/storage';
import { exportBlueprintForAI } from '../../lib/exportAI';
import type { Blueprint } from '../../types/blueprint';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CollaboratorsPanel() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const blueprintRowId = useBlueprintStore((s) => s.blueprintRowId);
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const userId = useBlueprintStore((s) => s.userId);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const isCollaboratorView = useBlueprintStore((s) => s.isCollaboratorView);
  const collaborators = useCommentsStore((s) => s.collaborators);
  const invite = useCommentsStore((s) => s.invite);
  const removeCollaborator = useCommentsStore((s) => s.removeCollaborator);

  const [open, setOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Owner-only: collaborators can read the table (via is_collaborator RLS) so
  // having `blueprintRowId` is no longer a sufficient signal. Hide the panel
  // entirely when viewing as a collaborator.
  const canManage = !!blueprintRowId && !!userId && !isGuestView && !isCollaboratorView;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (!canManage || !blueprint) return null;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const email = emailDraft.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    if (email === (userEmail ?? '').toLowerCase()) {
      setError('You already own this blueprint');
      return;
    }
    if (!blueprintRowId) return;
    setSubmitting(true);
    const result = await invite(blueprintRowId, email);
    setSubmitting(false);
    if (result.ok) {
      setEmailDraft('');
      setSuccess(`Invited ${email}`);
      setTimeout(() => setSuccess(null), 2500);
    } else {
      setError(result.error ?? 'Could not send invite');
    }
  }

  async function handleRemove(id: string) {
    await removeCollaborator(id);
  }

  const accepted = collaborators.filter((c) => c.acceptedAt);
  const pending = collaborators.filter((c) => !c.acceptedAt);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Manage collaborators"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 500,
          color: open ? 'var(--accent-primary)' : 'var(--text-secondary)',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Share2 size={12} />
        Share
        {collaborators.length > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-bg-muted)',
              color: 'var(--text-muted)',
              minWidth: 16,
              textAlign: 'center',
            }}
          >
            {collaborators.length}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 320,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 480,
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Users size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Collaborators
              </span>
            </div>
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Mail
                  size={12}
                  color="var(--text-muted)"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 8,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  ref={inputRef}
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    setError(null);
                  }}
                  placeholder="invite@email.com"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '7px 8px 7px 26px',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    background: 'var(--surface-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !emailDraft.trim()}
                style={{
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'var(--accent-primary-soft)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: submitting || !emailDraft.trim() ? 'default' : 'pointer',
                  opacity: submitting || !emailDraft.trim() ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {submitting ? 'Inviting…' : 'Invite'}
              </button>
            </form>
            {error && (
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: 11,
                  color: 'var(--accent-danger)',
                  lineHeight: 1.4,
                }}
              >
                {error}
              </p>
            )}
            {success && (
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: 11,
                  color: 'var(--accent-success)',
                  lineHeight: 1.4,
                }}
              >
                {success}
              </p>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Owner row */}
            <CollabRow
              label={userEmail ?? 'You'}
              statusIcon={<Check size={11} />}
              statusText="Owner"
              statusColor="var(--accent-success)"
            />

            {accepted.map((c) => (
              <CollabRow
                key={c.id}
                label={c.email}
                statusIcon={<Check size={11} />}
                statusText="Active"
                statusColor="var(--accent-success)"
                onRemove={() => handleRemove(c.id)}
              />
            ))}

            {pending.map((c) => (
              <CollabRow
                key={c.id}
                label={c.email}
                statusIcon={<Clock size={11} />}
                statusText="Pending"
                statusColor="var(--text-muted)"
                onRemove={() => handleRemove(c.id)}
              />
            ))}

            {collaborators.length === 0 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                No collaborators yet
              </div>
            )}

            {/* Share link section */}
            <ShareLinkSection blueprintId={blueprint.id} />

            {/* Export for AI */}
            <ExportAISection blueprint={blueprint} />
          </div>
        </div>
      )}
    </div>
  );
}

function CollabRow({
  label,
  statusIcon,
  statusText,
  statusColor,
  onRemove,
}: {
  label: string;
  statusIcon: React.ReactNode;
  statusText: string;
  statusColor: string;
  onRemove?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
            fontSize: 11,
            color: statusColor,
          }}
        >
          {statusIcon}
          {statusText}
        </div>
      </div>
      {onRemove && hover && (
        <button
          onClick={onRemove}
          title="Remove"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}


function ShareLinkSection({ blueprintId }: { blueprintId: string }) {
  const [shareToken, setShareToken] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getShareToken(blueprintId);
      if (!cancelled) setShareToken(token);
    })();
    return () => { cancelled = true; };
  }, [blueprintId]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    await saveBlueprintCloud(useBlueprintStore.getState().blueprint!);
    const token = await createShareToken(blueprintId);
    if (token) setShareToken(token);
    else setError('Could not create share link.');
    setLoading(false);
  }

  async function handleRevoke() {
    setLoading(true);
    await deleteShareToken(blueprintId);
    setShareToken(null);
    setLoading(false);
  }

  function handleCopy() {
    if (!shareToken) return;
    const url = `${window.location.origin}${window.location.pathname}?share=${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Link size={12} color="var(--text-muted)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Share link</span>
      </div>

      {loading ? (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
      ) : shareToken ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            padding: '6px 8px',
            background: 'var(--surface-bg-muted)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11, color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {window.location.origin}/?share={shareToken}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px', fontSize: 11, fontWeight: 500,
                color: copied ? 'var(--accent-success)' : 'var(--accent-primary)',
                background: copied ? 'var(--accent-success-soft)' : 'var(--accent-primary-soft)',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={handleRevoke}
              title="Revoke link"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '6px 8px',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>
      ) : shareToken === undefined ? (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            Anyone with the link can view this blueprint.
          </p>
          {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--accent-danger)' }}>{error}</p>}
          <button
            onClick={handleGenerate}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px',
              fontSize: 12, fontWeight: 600,
              color: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            }}
          >
            <Share2 size={12} />
            Generate share link
          </button>
        </div>
      )}
    </div>
  );
}

function ExportAISection({ blueprint }: { blueprint: Blueprint }) {
  const [copied, setCopied] = useState(false);

  function handleExport() {
    const md = exportBlueprintForAI(blueprint);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${blueprint.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_ai.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleCopy() {
    const md = exportBlueprintForAI(blueprint);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <FileDown size={12} color="var(--text-muted)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Export for AI</span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Download a compact .md file structured for AI tools — includes all phases, actions, pains, opportunities, and axis positions.
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleExport}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px', fontSize: 11, fontWeight: 600,
            color: 'var(--accent-primary)',
            background: 'var(--accent-primary-soft)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}
        >
          <FileDown size={11} />
          Download .md
        </button>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 10px', fontSize: 11, fontWeight: 500,
            color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
