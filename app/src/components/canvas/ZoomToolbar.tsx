import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import { fitViewFromBridge } from '../../lib/viewportBridge';

export function ZoomToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const overviewMode = useBlueprintStore((s) => s.overviewMode);
  const overviewGenerating = useBlueprintStore((s) => s.overviewGenerating);
  const setOverviewMode = useBlueprintStore((s) => s.setOverviewMode);
  const generateOverview = useBlueprintStore((s) => s.generateOverview);
  const blueprint = useBlueprintStore((s) => s.blueprint);
  const presentMode = useBlueprintStore((s) => s.presentMode);

  const handleModeToggle = useCallback(() => {
    if (overviewGenerating) return;
    if (overviewMode) {
      setOverviewMode(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitViewFromBridge({ padding: 0.12, duration: 500 });
        });
      });
    } else {
      if (blueprint?.overviewActionIds?.length) {
        setOverviewMode(true);
      } else {
        generateOverview();
      }
    }
  }, [overviewMode, overviewGenerating, blueprint, setOverviewMode, generateOverview]);

  if (presentMode) {
    return (
      <div style={pillStyle}>
        <ZoomButton onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
          <ZoomOut size={13} />
        </ZoomButton>
        <button
          onClick={() => fitView({ duration: 300, padding: 0.15 })}
          title="Fit view"
          style={centerButtonStyle}
          onMouseEnter={(e) => Object.assign((e.currentTarget as HTMLElement).style, hoverOn)}
          onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLElement).style, hoverOff)}
        >
          <Maximize2 size={13} />
        </button>
        <ZoomButton onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
          <ZoomIn size={13} />
        </ZoomButton>
      </div>
    );
  }

  return (
    <div style={pillStyle}>
      <ZoomButton onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
        <ZoomOut size={13} />
      </ZoomButton>

      <button
        onClick={handleModeToggle}
        title={overviewMode ? 'Switch to Details view' : 'Switch to Overview'}
        disabled={overviewGenerating}
        style={{
          ...centerButtonStyle,
          color: overviewMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
          cursor: overviewGenerating ? 'default' : 'pointer',
          minWidth: 80,
          gap: 5,
        }}
        onMouseEnter={(e) => {
          if (!overviewGenerating) Object.assign((e.currentTarget as HTMLElement).style, hoverOn);
        }}
        onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLElement).style, hoverOff)}
      >
        {overviewGenerating ? (
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        ) : null}
        <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {overviewGenerating ? 'Generating…' : overviewMode ? 'Overview' : 'Details'}
        </span>
      </button>

      <ZoomButton onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
        <ZoomIn size={13} />
      </ZoomButton>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-pill)',
  boxShadow: 'var(--shadow-md)',
  overflow: 'hidden',
  userSelect: 'none',
};

const centerButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 10px',
  height: 32,
  borderLeft: '1px solid var(--border-subtle)',
  borderRight: '1px solid var(--border-subtle)',
  background: 'transparent',
  transition: 'background 0.12s, color 0.12s',
};

const hoverOn = { background: 'var(--surface-bg-hover)', color: 'var(--text-primary)' };
const hoverOff = { background: 'transparent' };

function ZoomButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => Object.assign((e.currentTarget as HTMLElement).style, hoverOn)}
      onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLElement).style, hoverOff)}
    >
      {children}
    </button>
  );
}
