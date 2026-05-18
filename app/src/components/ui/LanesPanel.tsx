import { useState, useRef, useEffect } from 'react';
import { Layers, Plus, Eye, EyeOff, Trash2, Clock, CircleDot, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useBlueprintStore } from '../../store/blueprint.store';
import type { StatusLane, TimelineLane } from '../../types/blueprint';

export function LanesPanel() {
  const blueprint              = useBlueprintStore((s) => s.blueprint);
  const presentMode            = useBlueprintStore((s) => s.presentMode);
  const isGuestView            = useBlueprintStore((s) => s.isGuestView);
  const addStatusLane          = useBlueprintStore((s) => s.addStatusLane);
  const updateStatusLane       = useBlueprintStore((s) => s.updateStatusLane);
  const removeStatusLane       = useBlueprintStore((s) => s.removeStatusLane);
  const reorderStatusLane      = useBlueprintStore((s) => s.reorderStatusLane);
  const addTimelineLane        = useBlueprintStore((s) => s.addTimelineLane);
  const updateTimelineLane     = useBlueprintStore((s) => s.updateTimelineLane);
  const removeTimelineLane     = useBlueprintStore((s) => s.removeTimelineLane);
  const reorderTimelineLane    = useBlueprintStore((s) => s.reorderTimelineLane);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  if (presentMode || isGuestView || !blueprint) return null;

  const statusLanes = [...(blueprint.statusLanes ?? [])].sort((a, b) => a.order - b.order);
  const timelineLanes = [...(blueprint.timelineLanes ?? [])].sort((a, b) => a.order - b.order);
  const totalLanes = statusLanes.length + timelineLanes.length;

  return (
    <div ref={ref} style={{ position: 'fixed', top: 16, right: 200, zIndex: 50 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Lanes"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Layers size={12} />
        Lanes
        {totalLanes > 0 && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            background: 'var(--surface-bg-muted)',
            borderRadius: 'var(--radius-pill)',
            padding: '1px 6px',
            color: 'var(--text-muted)',
          }}>
            {totalLanes}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 280,
            background: 'var(--surface-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Timeline lanes */}
          <Section
            title="Timelines"
            subtitle="Above phases"
            icon={<Clock size={12} />}
            onAdd={() => addTimelineLane(`Timeline ${timelineLanes.length + 1}`)}
            empty={timelineLanes.length === 0 ? 'No timeline lanes yet' : undefined}
          >
            {timelineLanes.map((lane, i) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                isFirst={i === 0}
                isLast={i === timelineLanes.length - 1}
                onToggleVisibility={() => updateTimelineLane(lane.id, { visible: !lane.visible })}
                onRename={(name) => updateTimelineLane(lane.id, { name })}
                onColor={(color) => updateTimelineLane(lane.id, { color })}
                onMoveUp={() => reorderTimelineLane(lane.id, 'up')}
                onMoveDown={() => reorderTimelineLane(lane.id, 'down')}
                onRemove={() => removeTimelineLane(lane.id)}
              />
            ))}
          </Section>

          {/* Status lanes */}
          <Section
            title="Statuses"
            subtitle="Between phase and steps"
            icon={<CircleDot size={12} />}
            onAdd={() => addStatusLane(`Status ${statusLanes.length + 1}`)}
            empty={statusLanes.length === 0 ? 'No status lanes yet' : undefined}
          >
            {statusLanes.map((lane, i) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                isFirst={i === 0}
                isLast={i === statusLanes.length - 1}
                onToggleVisibility={() => updateStatusLane(lane.id, { visible: !lane.visible })}
                onRename={(name) => updateStatusLane(lane.id, { name })}
                onColor={(color) => updateStatusLane(lane.id, { color })}
                onMoveUp={() => reorderStatusLane(lane.id, 'up')}
                onMoveDown={() => reorderStatusLane(lane.id, 'down')}
                onRemove={() => removeStatusLane(lane.id)}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, icon, onAdd, empty, children }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onAdd: () => void;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{subtitle}</span>
        </div>
        <button
          onClick={onAdd}
          title={`Add ${title.toLowerCase()}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <Plus size={10} />
          Add
        </button>
      </div>
      {empty ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, padding: '8px 4px', textAlign: 'center' }}>
          {empty}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function LaneRow({ lane, isFirst, isLast, onToggleVisibility, onRename, onColor, onMoveUp, onMoveDown, onRemove }: {
  lane: StatusLane | TimelineLane;
  isFirst: boolean;
  isLast: boolean;
  onToggleVisibility: () => void;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => { setDraft(lane.name); }, [lane.name]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== lane.name) onRename(v);
    else setDraft(lane.name);
    setEditing(false);
  };

  const colors = ['#3B82F6', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#EF4444', '#6B7280'];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 8px',
      background: 'var(--surface-bg-muted)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      opacity: lane.visible === false ? 0.5 : 1,
    }}>
      <button
        onClick={() => setShowColors((v) => !v)}
        title="Change colour"
        style={{
          width: 12, height: 12, borderRadius: '50%',
          background: lane.color,
          border: 'none',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      />
      {showColors && (
        <div style={{
          position: 'absolute', zIndex: 1,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 6,
          display: 'flex',
          gap: 4,
          boxShadow: 'var(--shadow-md)',
        }}>
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => { onColor(c); setShowColors(false); }}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: c,
                border: c === lane.color ? '2px solid var(--text-primary)' : 'none',
                cursor: 'pointer',
              }}
            />
          ))}
          <button onClick={() => setShowColors(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(lane.name); setEditing(false); }
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            padding: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          title="Double-click to rename"
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: lane.color,
            cursor: 'text',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lane.name}
        </span>
      )}

      <div style={{ display: 'flex', gap: 2 }}>
        <button onClick={onMoveUp} disabled={isFirst} title="Move up" style={iconBtn(isFirst)}>
          <ChevronUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={isLast} title="Move down" style={iconBtn(isLast)}>
          <ChevronDown size={12} />
        </button>
        <button onClick={onToggleVisibility} title={lane.visible === false ? 'Show' : 'Hide'} style={iconBtn(false)}>
          {lane.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button onClick={onRemove} title="Delete" style={iconBtn(false)}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: disabled ? 'var(--border-subtle)' : 'var(--text-muted)',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
