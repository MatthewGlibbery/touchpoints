import { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { NotificationsBell } from './NotificationsBell';
import { CollaboratorsPanel } from './CollaboratorsPanel';

export function UserMenu() {
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const displayName = useBlueprintStore((s) => s.displayName);
  const signOut = useBlueprintStore((s) => s.signOut);
  const isGuestView = useBlueprintStore((s) => s.isGuestView);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  if (!userEmail || isGuestView) return null;

  const name = displayName || userEmail;
  const initials = getInitials(name);

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Collaborators + Share (existing component, renders its own pill) */}
      <CollaboratorsPanel />

      {/* Notifications bell (existing component) */}
      <NotificationsBell />

      {/* Avatar circle */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-bg)',
            border: '2px solid var(--accent-primary)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 }}>
            {initials}
          </span>
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 220,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            padding: 4,
          }}>
            {/* User info */}
            <div style={{ padding: '10px 12px 8px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {displayName || 'No name set'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {userEmail}
              </p>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            {/* Sign out */}
            <button
              onClick={() => { signOut(); setOpen(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <LogOut size={14} color="var(--text-secondary)" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}
