import { useEffect, useRef, useState } from 'react';
import { Users, Mail, Clock, Check, Trash2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { useCommentsStore } from '../../store/comments.store';

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
        <Users size={12} />
        People
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
            left: 0,
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
              <div
                style={{
                  padding: '14px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                Invite teammates by email so they can comment on this blueprint.
                They'll get an invite email and access once they sign in.
              </div>
            )}
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

