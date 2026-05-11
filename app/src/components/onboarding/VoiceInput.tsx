import { useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

type Props = { onSubmit: (text: string) => void; onBack: () => void };

export function VoiceInput({ onSubmit, onBack }: Props) {
  const [finalText, setFinalText] = useState('');

  const { state, liveText, start, stop } = useVoiceInput((transcript) => {
    setFinalText(transcript);
  });

  const displayText = state === 'listening' ? liveText : finalText;
  const isUnsupported = state === 'error' && !liveText;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {isUnsupported ? (
        <p style={{ fontSize: 13, color: 'var(--accent-danger)', padding: 'var(--space-3)', background: '#FEF2F2', borderRadius: 'var(--radius-md)' }}>
          Voice input isn't supported in this browser. Try Chrome or Edge.
        </p>
      ) : (
        <>
          <div
            style={{
              minHeight: 120,
              padding: 'var(--space-3)',
              background: 'var(--surface-bg-muted)',
              border: `1px solid ${state === 'listening' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: displayText ? 'var(--text-primary)' : 'var(--text-muted)',
              lineHeight: 1.6,
              transition: 'border-color 0.15s',
            }}
          >
            {displayText || 'Your transcription will appear here...'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              onClick={state === 'listening' ? stop : start}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: state === 'listening' ? 'var(--accent-danger)' : 'var(--accent-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {state === 'listening' ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {state === 'listening'
                ? 'Listening — click to stop'
                : finalText
                ? 'Recording complete'
                : 'Click to start recording'}
            </span>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          onClick={() => onSubmit(finalText)}
          disabled={!finalText.trim() || state === 'listening'}
        >
          Generate blueprint
        </button>
      </div>
    </div>
  );
}
