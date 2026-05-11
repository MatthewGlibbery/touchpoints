import { useState, useCallback } from 'react';
import { FileUp, FileCheck, X } from 'lucide-react';
import { useFileUpload } from '../../hooks/useFileUpload';

type Props = { onSubmit: (text: string) => void; onBack: () => void };

export function DocumentUpload({ onSubmit, onBack }: Props) {
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);

  const { openPicker, handleFile } = useFileUpload((extractedText, name) => {
    setText(extractedText);
    setFileName(name);
  });

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => openPicker()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            cursor: 'pointer',
            background: dragging ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
            transition: 'all 0.15s',
          }}
        >
          <FileUp size={28} color={dragging ? 'var(--accent-primary)' : 'var(--text-muted)'} />
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            Drop your file here or click to browse
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            TXT, PDF, Markdown
          </p>
        </div>
      ) : (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--accent-success-soft)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <FileCheck size={16} color="var(--accent-success)" />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
            {fileName}
          </span>
          <button
            onClick={() => { setFileName(''); setText(''); }}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
