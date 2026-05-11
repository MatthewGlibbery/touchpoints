import type { CSSProperties, ReactNode } from 'react';

// ─── Panel ────────────────────────────────────────────────────────────────────

interface PanelProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  animateFrom?: 'left' | 'right' | 'bottom' | 'none';
}

export function Panel({ children, style, className = '', animateFrom = 'left' }: PanelProps) {
  const animClass =
    animateFrom === 'left'  ? 'anim-slide-left'  :
    animateFrom === 'right' ? 'anim-slide-right' :
    animateFrom === 'bottom'? 'anim-fade-up'     : '';

  return (
    <div
      className={[animClass, className].filter(Boolean).join(' ')}
      style={{
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  size?: number;
  title?: string;
  variant?: 'default' | 'ghost';
  style?: CSSProperties;
}

export function IconButton({ icon, onClick, size = 28, title, variant = 'default', style }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: variant === 'ghost' ? 'none' : '1px solid var(--border-strong)',
        background: variant === 'ghost' ? 'transparent' : 'var(--surface-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        flexShrink: 0,
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

// ─── FieldBlock ───────────────────────────────────────────────────────────────

export function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
      {children}
    </div>
  );
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

interface TagProps {
  label: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Tag({ label, color = 'var(--text-muted)', selected = false, onClick }: TagProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 'var(--radius-pill)',
        background: selected ? color : 'transparent',
        color: selected ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${selected ? color : 'var(--border-subtle)'}`,
        cursor: onClick ? 'pointer' : 'default',
        textTransform: 'capitalize',
        letterSpacing: '0.03em',
        transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      {label}
    </button>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

interface TabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface TabBarProps<T extends string> {
  tabs: TabDef<T>[];
  activeTab: T;
  onTabChange: (id: T) => void;
}

export function TabBar<T extends string>({ tabs, activeTab, onTabChange }: TabBarProps<T>) {
  return (
    <div style={{
      padding: '0 18px',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '7px 10px 8px',
            fontSize: 12,
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
            marginBottom: -1,
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            transition: 'color var(--transition-fast)',
          }}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: activeTab === tab.id ? 'var(--accent-primary-soft)' : 'var(--surface-bg-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              padding: '1px 5px',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--text-primary)',
  background: 'var(--surface-bg)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color var(--transition-fast)',
};
