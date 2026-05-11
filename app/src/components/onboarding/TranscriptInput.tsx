import { useState } from 'react';

type Props = { onSubmit: (text: string) => void; onBack: () => void };

export function TranscriptInput({ onSubmit, onBack }: Props) {
  const [text, setText] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your transcript, meeting notes, or any description of the service..."
        autoFocus
        style={{
          width: '100%',
          minHeight: 180,
          padding: 'var(--space-3)',
          background: 'var(--surface-bg-muted)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          resize: 'vertical',
          outline: 'none',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          fontSize: 13,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
        >
          Generate blueprint
        </button>
      </div>
    </div>
  );
}
