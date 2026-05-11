import { useState } from 'react';
import { Bug, X, Copy, Check, ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { DesignSystemModal } from './DesignSystemModal';

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});
  const blueprint = useBlueprintStore((s) => s.blueprint);

  function copyJson() {
    if (!blueprint) return;
    navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleSection(key: string) {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      {/* Bottom-left dev tool buttons — offset right of the theme toggle (32px + 6px gap = 54px) */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 54,
          zIndex: 60,
          display: 'flex',
          gap: 6,
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          title="Debug panel"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: open ? 'var(--text-primary)' : 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: open ? 'var(--surface-bg)' : 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <Bug size={14} />
        </button>
        <button
          onClick={() => setDesignOpen(true)}
          title="Design system"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <Palette size={14} />
        </button>
      </div>

      <DesignSystemModal open={designOpen} onClose={() => setDesignOpen(false)} />

      {open && blueprint && (
        <div
          style={{
            position: 'fixed',
            bottom: 56,
            left: 16,
            width: 340,
            maxHeight: 'calc(100vh - 120px)',
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'ui-monospace, Consolas, monospace',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bug size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                Debug
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={copyJson}
                title="Copy JSON"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-bg-muted)',
                }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            {[
              { label: 'Actors', count: blueprint.actors.length },
              { label: 'Phases', count: blueprint.phases.length },
              { label: 'Actions', count: blueprint.actions.length },
              { label: 'Pain pts', count: blueprint.painPoints.length },
            ].map(({ label, count }) => (
              <div
                key={label}
                style={{
                  background: 'var(--surface-bg)',
                  padding: '8px var(--space-2)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  {count}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'inherit' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Sections */}
          <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            <DebugSection
              label="Actors"
              open={!!sectionsOpen['actors']}
              onToggle={() => toggleSection('actors')}
            >
              {blueprint.actors.map((a) => (
                <DebugRow key={a.id} left={a.name} right={a.id} color={a.color} />
              ))}
            </DebugSection>

            <DebugSection
              label="Phases"
              open={!!sectionsOpen['phases']}
              onToggle={() => toggleSection('phases')}
            >
              {blueprint.phases.map((p) => (
                <DebugRow key={p.id} left={p.name} right={`order ${p.order}`} />
              ))}
            </DebugSection>

            <DebugSection
              label="Actions"
              open={!!sectionsOpen['actions']}
              onToggle={() => toggleSection('actions')}
            >
              {blueprint.actions.map((a) => (
                <DebugRow
                  key={a.id}
                  left={a.label}
                  right={`${a.actorId} · ${a.phaseId}`}
                />
              ))}
            </DebugSection>

            <DebugSection
              label="Pain Points"
              open={!!sectionsOpen['painPoints']}
              onToggle={() => toggleSection('painPoints')}
            >
              {blueprint.painPoints.map((p) => (
                <DebugRow key={p.id} left={p.description} right={p.severity} />
              ))}
            </DebugSection>

            <DebugSection
              label="Touchpoints"
              open={!!sectionsOpen['touchpoints']}
              onToggle={() => toggleSection('touchpoints')}
            >
              {blueprint.touchpoints.map((t) => (
                <DebugRow key={t.id} left={t.label} right={t.type} />
              ))}
            </DebugSection>

            <DebugSection
              label="Raw JSON"
              open={!!sectionsOpen['json']}
              onToggle={() => toggleSection('json')}
            >
              <pre
                style={{
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  padding: 'var(--space-2)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify(blueprint, null, 2)}
              </pre>
            </DebugSection>
          </div>
        </div>
      )}
    </>
  );
}

function DebugSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '7px var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: open ? 'var(--surface-bg-muted)' : 'transparent',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textAlign: 'left',
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function DebugRow({ left, right, color }: { left: string; right: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px var(--space-4)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--surface-bg)',
      }}
    >
      {color && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-primary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}
      >
        {left}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          flexShrink: 0,
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}
      >
        {right}
      </span>
    </div>
  );
}
