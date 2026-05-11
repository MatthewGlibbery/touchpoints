import { useBlueprintStore } from '../../store/blueprint.store';
import { clearBlueprint } from '../../lib/storage';

export function FloatingToolbar() {
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const setMode = useBlueprintStore((s) => s.setMode);

  function handleReset() {
    clearBlueprint();
    setMode('onboarding');
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        padding: '4px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {blueprint && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            paddingLeft: 'var(--space-3)',
            paddingRight: 'var(--space-2)',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {blueprint.name}
        </span>
      )}
      <ToolbarTab label="Blueprint" active />
      <ToolbarTab label="Pain Points" active={false} />
      <ToolbarTab label="Opportunities" active={false} />
      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--border-subtle)',
          margin: '0 4px',
        }}
      />
      <button
        onClick={handleReset}
        style={{
          padding: '5px 10px',
          fontSize: 12,
          color: 'var(--text-secondary)',
          borderRadius: 'var(--radius-pill)',
          transition: 'background 0.15s',
        }}
        title="Start a new blueprint"
      >
        New
      </button>
    </div>
  );
}

function ToolbarTab({ label, active }: { label: string; active: boolean }) {
  return (
    <button
      style={{
        padding: '5px 12px',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-bg-muted)' : 'transparent',
        borderRadius: 'var(--radius-pill)',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}
