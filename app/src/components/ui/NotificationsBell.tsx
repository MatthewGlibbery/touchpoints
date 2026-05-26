import { useEffect, useRef, useState } from 'react';
import { Bell, AtSign, MessageSquare, Smile } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { useCommentsStore, unreadNotificationCount } from '../../store/comments.store';
import type { Notification } from '../../types/blueprint';

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

function kindIcon(kind: Notification['kind']) {
  switch (kind) {
    case 'mention': return <AtSign size={11} color="var(--accent-primary)" />;
    case 'reply': return <MessageSquare size={11} color="var(--accent-primary)" />;
    case 'reaction': return <Smile size={11} color="var(--accent-primary)" />;
  }
}

function kindLabel(kind: Notification['kind']) {
  switch (kind) {
    case 'mention': return 'mentioned you';
    case 'reply': return 'replied';
    case 'reaction': return 'reacted to your comment';
  }
}

export function NotificationsBell() {
  const userId = useBlueprintStore((s) => s.userId);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);
  const blueprintRowId = useBlueprintStore((s) => s.blueprintRowId);
  const switchToBlueprintByRowId = useBlueprintStore((s) => s.switchToBlueprintByRowId);

  const notifications = useCommentsStore((s) => s.notifications);
  const markRead = useCommentsStore((s) => s.markRead);
  const markAllRead = useCommentsStore((s) => s.markAllRead);
  const openThread = useCommentsStore((s) => s.openThread);
  const comments = useCommentsStore((s) => s.comments);
  const loadNotifications = useCommentsStore((s) => s.loadNotifications);
  const animateToAnchor = useBlueprintStore((s) => s.animateToAnchor);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Poll for new notifications every 60s while the tab is visible. Also
  // refresh immediately when the tab regains focus, so a long-backgrounded
  // tab doesn't show stale state on return.
  useEffect(() => {
    if (!userId) return;
    let timer: number | null = null;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications(userId);
      }
    };
    timer = window.setInterval(tick, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadNotifications(userId);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, loadNotifications]);

  if (!userId || isGuestView) return null;

  const unread = unreadNotificationCount(notifications);

  async function handleClick(n: Notification) {
    if (!n.readAt) await markRead(n.id);
    // Same-blueprint: pan canvas to the anchor, then open the thread.
    if (n.commentId && blueprintRowId === n.blueprintId) {
      const c = comments.find((x) => x.id === n.commentId);
      if (c) {
        animateToAnchor(c.anchor);
        openThread(c.anchor, { x: window.innerWidth / 2, y: window.innerHeight / 3 });
      }
      setOpen(false);
      return;
    }
    // Cross-blueprint: switch to that blueprint and open the thread once
    // comments load. switchToBlueprintByRowId handles both cases.
    if (n.blueprintId) {
      await switchToBlueprintByRowId(n.blueprintId, {
        openCommentId: n.commentId ?? undefined,
      });
    }
    setOpen(false);
  }

  async function handleMarkAll() {
    if (!userId) return;
    await markAllRead(userId);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          padding: 0,
          color: open ? 'var(--accent-primary)' : 'var(--text-secondary)',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              background: 'var(--accent-danger)',
              borderRadius: 'var(--radius-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--surface-bg)',
              boxSizing: 'border-box',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 340,
            maxHeight: 480,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  color: 'var(--accent-primary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                No notifications yet.
              </div>
            )}

            {notifications.map((n) => {
              const onCurrentBlueprint = !!blueprintRowId && blueprintRowId === n.blueprintId;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    gap: 10,
                    padding: '10px 14px',
                    alignItems: 'flex-start',
                    background: n.readAt ? 'transparent' : 'var(--accent-primary-soft)',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--surface-bg)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}
                  >
                    {kindIcon(n.kind)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>{n.actorName}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{kindLabel(n.kind)}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.snippet}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <span>{formatRelative(n.createdAt)}</span>
                      {!onCurrentBlueprint && (
                        <span style={{ color: 'var(--accent-primary)' }}>
                          • Open blueprint →
                        </span>
                      )}
                    </div>
                  </div>
                  {!n.readAt && (
                    <div
                      style={{
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                        marginTop: 6,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
