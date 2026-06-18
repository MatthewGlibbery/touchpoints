import { Map, Users, Film, Grid3X3 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';

export function ModeBar() {
  const presentMode           = useBlueprintStore((s) => s.presentMode);
  const presentationEditMode  = useBlueprintStore((s) => s.presentationEditMode);
  const storyboardMode        = useBlueprintStore((s) => s.storyboardMode);
  const setStoryboardMode     = useBlueprintStore((s) => s.setStoryboardMode);
  const frameworkMode         = useBlueprintStore((s) => s.frameworkMode);
  const setFrameworkMode      = useBlueprintStore((s) => s.setFrameworkMode);

  const inPresentationContext = presentMode || presentationEditMode;

  const exitToEdit = () => {
    useBlueprintStore.setState({ presentMode: false, presentationEditMode: false });
    setStoryboardMode(false);
    setFrameworkMode(false);
  };

  const pillBase: React.CSSProperties = {
    padding: '5px 14px',
    fontSize: 13,
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  };

  const isBlueprint = !inPresentationContext && !storyboardMode && !frameworkMode;

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
        gap: 2,
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        padding: '4px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Blueprints */}
      <button
        onClick={exitToEdit}
        style={{
          ...pillBase,
          fontWeight: isBlueprint ? 600 : 400,
          color: isBlueprint ? 'var(--text-primary)' : 'var(--text-muted)',
          background: isBlueprint ? 'var(--surface-bg-muted)' : 'transparent',
        }}
      >
        <Map size={12} />
        Blueprints
      </button>

      {/* Personas — disabled stub */}
      <button
        disabled
        style={{
          ...pillBase,
          fontWeight: 400,
          color: 'var(--text-muted)',
          background: 'transparent',
          cursor: 'not-allowed',
          opacity: 0.45,
        }}
      >
        <Users size={12} />
        Personas
      </button>

      {/* Journey Maps */}
      <button
        onClick={() => (storyboardMode ? exitToEdit() : setStoryboardMode(true))}
        style={{
          ...pillBase,
          fontWeight: storyboardMode ? 600 : 400,
          color: storyboardMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: storyboardMode ? 'var(--surface-bg-muted)' : 'transparent',
        }}
      >
        <Film size={12} />
        Journey Maps
      </button>

      {/* Frameworks */}
      <button
        onClick={() => (frameworkMode ? exitToEdit() : setFrameworkMode(true))}
        style={{
          ...pillBase,
          fontWeight: frameworkMode ? 600 : 400,
          color: frameworkMode ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: frameworkMode ? 'var(--surface-bg-muted)' : 'transparent',
        }}
      >
        <Grid3X3 size={12} />
        Frameworks
      </button>
    </div>
  );
}
