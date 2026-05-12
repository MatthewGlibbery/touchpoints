import { useState } from 'react';
import { User } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';

export function GuestNamePrompt() {
  const setGuestName = useBlueprintStore((s) => s.setGuestName);
  const [draft, setDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function handleSubmit() {
    const name = draft.trim();
    setGuestName(name || null);
    setDismissed(true);
  }

  function handleSkip() {
    setGuestName(null);
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '28px 28px 24px',
          width: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent-primary-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={15} color="var(--accent-primary)" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              What should we call you?
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: 40 }}>
            Your name will appear on any feedback you leave.
          </p>
        </div>

        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleSkip();
          }}
          placeholder="Your name (optional)"
          style={{
            padding: '9px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '9px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            style={{
              flex: 2,
              padding: '9px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
