import { useState, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';

// ─── Token definitions ────────────────────────────────────────────────────────

const COLOR_GROUPS = [
  {
    name: 'Canvas',
    tokens: [
      { name: '--canvas-bg', label: 'Background' },
      { name: '--canvas-grid', label: 'Grid lines' },
    ],
  },
  {
    name: 'Surface',
    tokens: [
      { name: '--surface-bg', label: 'Default' },
      { name: '--surface-bg-muted', label: 'Muted' },
      { name: '--surface-bg-hover', label: 'Hover' },
    ],
  },
  {
    name: 'Border',
    tokens: [
      { name: '--border-subtle', label: 'Subtle' },
      { name: '--border-strong', label: 'Strong' },
    ],
  },
  {
    name: 'Text',
    tokens: [
      { name: '--text-primary', label: 'Primary' },
      { name: '--text-secondary', label: 'Secondary' },
      { name: '--text-muted', label: 'Muted' },
    ],
  },
  {
    name: 'Accent — Primary',
    tokens: [
      { name: '--accent-primary', label: 'Base' },
      { name: '--accent-primary-soft', label: 'Soft' },
    ],
  },
  {
    name: 'Accent — Semantic',
    tokens: [
      { name: '--accent-success', label: 'Success' },
      { name: '--accent-success-soft', label: 'Success soft' },
      { name: '--accent-warning', label: 'Warning' },
      { name: '--accent-danger', label: 'Danger' },
    ],
  },
  {
    name: 'Action',
    tokens: [
      { name: '--action-primary-bg', label: 'CTA background' },
      { name: '--action-primary-text', label: 'CTA text' },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  '--canvas-bg': '#F5F6F8',
  '--canvas-grid': '#DDE1E7',
  '--surface-bg': '#FFFFFF',
  '--surface-bg-muted': '#F3F4F6',
  '--surface-bg-hover': '#F9FAFB',
  '--border-subtle': '#E5E7EB',
  '--border-strong': '#D1D5DB',
  '--text-primary': '#111827',
  '--text-secondary': '#6B7280',
  '--text-muted': '#9CA3AF',
  '--accent-primary': '#3B82F6',
  '--accent-primary-soft': '#EEF2FF',
  '--accent-success': '#22C55E',
  '--accent-success-soft': '#ECFDF5',
  '--accent-warning': '#F59E0B',
  '--accent-danger': '#EF4444',
  '--action-primary-bg': '#F97316',
  '--action-primary-text': '#FFFFFF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTokenValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setTokenValue(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function colorToHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  } catch {
    return '#000000';
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Tab = 'colors' | 'spacing' | 'typography' | 'components';

const TABS: { id: Tab; label: string }[] = [
  { id: 'colors', label: 'Colors' },
  { id: 'spacing', label: 'Spacing & Shape' },
  { id: 'typography', label: 'Typography' },
  { id: 'components', label: 'Components' },
];

export function DesignSystemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('colors');
  // Bump to force re-read of tokens after reset
  const [resetKey, setResetKey] = useState(0);

  if (!open) return null;

  function handleReset() {
    Object.entries(DEFAULTS).forEach(([name, value]) => setTokenValue(name, value));
    setResetKey((k) => k + 1);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 880,
          maxWidth: 'calc(100vw - 48px)',
          height: '88vh',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '14px 20px 0',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Design System
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-bg-muted)',
                }}
              >
                <RotateCcw size={12} />
                Reset defaults
              </button>
              <button
                onClick={onClose}
                style={{ color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: tab === t.id
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                  marginBottom: -1,
                  background: 'transparent',
                  transition: 'color 0.12s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ overflowY: 'auto', flexGrow: 1, padding: 28 }}>
          {tab === 'colors' && <ColorsTab key={resetKey} />}
          {tab === 'spacing' && <SpacingTab />}
          {tab === 'typography' && <TypographyTab />}
          {tab === 'components' && <ComponentsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Colors tab ───────────────────────────────────────────────────────────────

function ColorsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {COLOR_GROUPS.map((group) => (
        <div key={group.name}>
          <SectionTitle>{group.name}</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: 8,
            }}
          >
            {group.tokens.map((token) => (
              <ColorSwatch key={token.name} name={token.name} label={token.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorSwatch({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useState(() => getTokenValue(name));
  const inputRef = useRef<HTMLInputElement>(null);
  const hex = colorToHex(value);

  function handleChange(newHex: string) {
    setValue(newHex);
    setTokenValue(name, newHex);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-bg-muted)',
        cursor: 'pointer',
        transition: 'border-color 0.12s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)')
      }
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: value,
          border: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: 1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, Consolas, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            fontFamily: 'ui-monospace, Consolas, monospace',
          }}
        >
          {value}
        </div>
      </div>
      <input
        ref={inputRef}
        type="color"
        value={hex}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: 0,
          height: 0,
          opacity: 0,
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ─── Spacing & Shape tab ──────────────────────────────────────────────────────

function SpacingTab() {
  const spacing = [
    '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  ];
  const radii = [
    { name: '--radius-sm', label: 'sm · 6px' },
    { name: '--radius-md', label: 'md · 10px' },
    { name: '--radius-lg', label: 'lg · 12px' },
    { name: '--radius-pill', label: 'pill · 999px' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      {/* Spacing */}
      <section>
        <SectionTitle>Spacing Scale</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spacing.map((name) => {
            const value = getTokenValue(name);
            const px = parseInt(value, 10);
            return (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <code
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    width: 72,
                    flexShrink: 0,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}
                >
                  {name.replace('--', '')}
                </code>
                <div
                  style={{
                    width: px * 4,
                    height: 18,
                    background: 'var(--accent-primary)',
                    borderRadius: 3,
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Border radius */}
      <section>
        <SectionTitle>Border Radius</SectionTitle>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {radii.map(({ name, label }) => (
            <div key={name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: 'var(--accent-primary-soft)',
                  border: '1px solid var(--accent-primary)',
                  borderRadius: `var(${name})`,
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Shadows */}
      <section>
        <SectionTitle>Shadows</SectionTitle>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          {[
            { name: '--shadow-sm', label: 'shadow-sm' },
            { name: '--shadow-md', label: 'shadow-md' },
          ].map(({ name, label }) => (
            <div key={name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: 'var(--surface-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: `var(${name})`,
                  marginBottom: 10,
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Typography tab ───────────────────────────────────────────────────────────

function TypographyTab() {
  const scale = [
    { tag: 'xs', size: 10, weight: '400', usage: 'Debug labels, minor metadata' },
    { tag: 'sm', size: 11, weight: '400–600', usage: 'Chips, inspector labels, debug rows' },
    { tag: 'base', size: 12, weight: '500–600', usage: 'Toolbar buttons, actor names' },
    { tag: 'md', size: 13, weight: '400–700', usage: 'Action labels, toolbar title' },
    { tag: 'lg', size: 14, weight: '600–700', usage: 'Panel titles, modal headings' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      {/* Scale */}
      <section>
        <SectionTitle>Type Scale</SectionTitle>
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          {scale.map((row, i) => (
            <div
              key={row.tag}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 80px 1fr',
                gap: 16,
                padding: '12px 16px',
                alignItems: 'center',
                background: i % 2 === 0 ? 'var(--surface-bg)' : 'var(--surface-bg-muted)',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {row.tag}
              </span>
              <span style={{ fontSize: row.size, color: 'var(--text-primary)', fontWeight: 500 }}>
                Aa — The quick brown fox
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                }}
              >
                {row.size}px · {row.weight}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.usage}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Families */}
      <section>
        <SectionTitle>Font Families</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}
            >
              UI / Body — system-ui, sans-serif
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              The quick brown fox jumps over the lazy dog.
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}
            >
              Monospace — ui-monospace, Consolas
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, Consolas, monospace',
                lineHeight: 1.5,
              }}
            >
              {'{"actorId": "citizen", "phaseId": "application"}'}
            </div>
          </div>
        </div>
      </section>

      {/* Colours in context */}
      <section>
        <SectionTitle>Text Colours in Context</SectionTitle>
        <div
          style={{
            padding: 20,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Primary — headings, labels
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Secondary — body text, supporting copy
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Muted — hints, timestamps, IDs
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Components tab ───────────────────────────────────────────────────────────

function ComponentsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      {/* Buttons */}
      <section>
        <SectionTitle>Buttons</SectionTitle>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 20,
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <button
            style={{
              padding: '8px 18px',
              background: 'var(--action-primary-bg)',
              color: 'var(--action-primary-text)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Primary CTA
          </button>
          <button
            style={{
              padding: '6px 14px',
              background: 'var(--surface-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
            }}
          >
            Secondary
          </button>
          <button
            style={{
              padding: '6px 14px',
              background: 'var(--surface-bg-muted)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
          >
            Tertiary
          </button>
          <button
            style={{
              padding: '5px 12px',
              background: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
            }}
          >
            Accent
          </button>
          <button
            style={{
              padding: '5px 12px',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
            }}
          >
            Ghost
          </button>
        </div>
      </section>

      {/* Chips */}
      <section>
        <SectionTitle>Chips</SectionTitle>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 16,
            background: 'var(--surface-bg-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: '#FEF2F2',
              color: 'var(--accent-danger)',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            2 pain
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-success-soft)',
              color: 'var(--accent-success)',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            1 opp
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            3 tp
          </span>
          <span
            style={{
              padding: '3px 10px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              background: 'var(--surface-bg)',
            }}
          >
            Neutral tag
          </span>
        </div>
      </section>

      {/* Action nodes */}
      <section>
        <SectionTitle>Action Node</SectionTitle>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            padding: 20,
            background: 'var(--canvas-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {/* Default */}
          <div
            style={{
              width: 220,
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderLeft: '3px solid #6366F1',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
              padding: 'var(--space-3)',
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Submit application form
            </p>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-1)',
                marginTop: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: '#FEF2F2',
                  color: 'var(--accent-danger)',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                2 pain
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-primary-soft)',
                  color: 'var(--accent-primary)',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                1 tp
              </span>
            </div>
          </div>

          {/* Selected */}
          <div
            style={{
              width: 220,
              background: 'var(--surface-bg)',
              border: '1px solid #6366F1',
              borderLeft: '3px solid #6366F1',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 0 0 3px #6366F122, var(--shadow-md)',
              padding: 'var(--space-3)',
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              Review documents
            </p>
            <div
              style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-success-soft)',
                  color: 'var(--accent-success)',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                1 opp
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Left: default · Right: selected
        </div>
      </section>

      {/* Structural nodes */}
      <section>
        <SectionTitle>Structural Nodes</SectionTitle>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            padding: 20,
            background: 'var(--canvas-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {/* Phase header */}
          <div
            style={{
              width: 240,
              height: 56,
              background: 'var(--surface-bg)',
              borderBottom: '1px solid var(--border-subtle)',
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 'var(--space-4)',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              Application
            </span>
          </div>

          {/* Actor label */}
          <div
            style={{
              width: 160,
              height: 56,
              background: 'var(--surface-bg)',
              borderBottom: '1px solid var(--border-subtle)',
              borderRight: '2px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              paddingLeft: 'var(--space-4)',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#6366F1',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Citizen
            </span>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Left: phase header · Right: actor label
        </div>
      </section>

      {/* Floating toolbar */}
      <section>
        <SectionTitle>Floating Toolbar</SectionTitle>
        <div
          style={{
            padding: 24,
            background: 'var(--canvas-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                paddingLeft: 'var(--space-3)',
                paddingRight: 'var(--space-2)',
              }}
            >
              My Blueprint
            </span>
            <button
              style={{
                padding: '5px 12px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--surface-bg-muted)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Blueprint
            </button>
            <button
              style={{
                padding: '5px 12px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Pain Points
            </button>
            <div
              style={{
                width: 1,
                height: 20,
                background: 'var(--border-subtle)',
                margin: '0 4px',
              }}
            />
            <button
              style={{
                padding: '5px 10px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              New
            </button>
          </div>
        </div>
      </section>

      {/* Inspector panel */}
      <section>
        <SectionTitle>Node Inspector</SectionTitle>
        <div
          style={{
            width: 260,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Action Details
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>✕</span>
          </div>
          <div style={{ padding: 14 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 3,
              }}
            >
              Submit application form
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}
            >
              Citizen · Application
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              Touchpoints
            </div>
            <span
              style={{
                padding: '3px 8px',
                background: 'var(--accent-primary-soft)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-pill)',
                fontSize: 11,
              }}
            >
              Gov web portal
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
