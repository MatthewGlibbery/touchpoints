import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Square, Paperclip, Link, FlaskConical, ArrowRight, ChevronDown, FileText, Trash2, LogOut, Plus } from 'lucide-react';
import { generateBlueprint } from '../../lib/ai';
import { useBlueprintStore } from '../../store/blueprint.store';
import { SAMPLE_BLUEPRINT } from '../../lib/sample';
import { loadAllBlueprints, deleteBlueprint } from '../../lib/storage';
import type { Blueprint } from '../../types/blueprint';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useFileUpload } from '../../hooks/useFileUpload';

// ─── Canvas dot background (matches DotBackground, no ReactFlow dependency) ──

const DOT_GAP = 16;
const DOT_BASE_RADIUS = 1;
const DOT_MAX_RADIUS = 1.55;
const EFFECT_RADIUS = 80;

function OnboardingDotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const dotColorRef = useRef('#DDE1E7');

  useEffect(() => {
    dotColorRef.current =
      getComputedStyle(document.documentElement).getPropertyValue('--canvas-grid').trim() || '#DDE1E7';
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(canvas);

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      const { width, height } = canvas;
      const mouse = mouseRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = dotColorRef.current;

      const startI = Math.floor(0 / DOT_GAP) - 1;
      const endI   = Math.ceil(width  / DOT_GAP) + 1;
      const startJ = Math.floor(0 / DOT_GAP) - 1;
      const endJ   = Math.ceil(height / DOT_GAP) + 1;

      for (let i = startI; i <= endI; i++) {
        for (let j = startJ; j <= endJ; j++) {
          const sx = i * DOT_GAP;
          const sy = j * DOT_GAP;
          let r = DOT_BASE_RADIUS;
          if (mouse) {
            const dx = sx - mouse.x;
            const dy = sy - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < EFFECT_RADIUS) {
              const t = 1 - dist / EFFECT_RADIUS;
              const s = t * t * (3 - 2 * t);
              r = DOT_BASE_RADIUS + (DOT_MAX_RADIUS - DOT_BASE_RADIUS) * s;
            }
          }
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

// ─── Logo (small / large variants) ───────────────────────────────────────────

function TouchpointsLogo({ size, animated = false }: { size: number; animated?: boolean }) {
  // Logo uses fixed 18×18 viewBox with 5 circles. Outer dots get sequential pulse when animated.
  const dotIndices = [0, 1, 2, 3];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: 'var(--action-primary-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: animated ? 'logoPulse 2.4s ease-in-out infinite' : undefined,
        boxShadow: animated ? '0 8px 32px rgba(249, 115, 22, 0.25)' : undefined,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="3" fill="white" />
        {[
          { cx: 3,  cy: 9 },
          { cx: 15, cy: 9 },
          { cx: 9,  cy: 3 },
          { cx: 9,  cy: 15 },
        ].map((d, i) => (
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r="1.5"
            fill="white"
            opacity={animated ? undefined : 0.6}
            style={animated ? {
              transformOrigin: `${d.cx}px ${d.cy}px`,
              animation: `logoDotPulse 1.6s ease-in-out ${dotIndices[i] * 0.2}s infinite`,
            } : undefined}
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Onboarding project switcher (top-left) ──────────────────────────────────

function OnboardingProjectSwitcher() {
  const userEmail = useBlueprintStore((s) => s.userEmail);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);
  const signOut = useBlueprintStore((s) => s.signOut);

  const [open, setOpen] = useState(false);
  const [allBlueprints, setAllBlueprints] = useState<Record<string, Blueprint>>({});
  const ref = useRef<HTMLDivElement>(null);

  function openDropdown() {
    setAllBlueprints(loadAllBlueprints());
    setOpen(true);
  }

  function handleSwitch(id: string) {
    switchToBlueprint(id);
    setOpen(false);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteBlueprint(id);
    setAllBlueprints(loadAllBlueprints());
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const bpList = Object.values(allBlueprints).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div ref={ref} style={{ position: 'fixed', top: 16, left: 16, zIndex: 60 }}>
      <button
        onClick={() => (open ? setOpen(false) : openDropdown())}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        Projects
        <ChevronDown
          size={13}
          color="var(--text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          width: 260,
          background: 'var(--surface-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          {bpList.length > 0 ? (
            <>
              <div style={{ padding: '8px 12px 4px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Projects
                </span>
              </div>
              {bpList.map((bp) => (
                <button
                  key={bp.id}
                  onClick={() => handleSwitch(bp.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileText size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bp.name}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, bp.id)}
                    style={{ color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            </>
          ) : (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={12} /> No projects yet
            </div>
          )}

          {userEmail && (
            <div style={{ padding: '6px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {userEmail}
              </span>
              <button
                onClick={() => { setOpen(false); signOut(); }}
                title="Sign out"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 6px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                }}
              >
                <LogOut size={11} />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analyzing view ──────────────────────────────────────────────────────────

function AnalyzingView({ status }: { status: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      padding: '0 24px',
    }}>
      <TouchpointsLogo size={120} animated />
      <div
        key={status}
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-primary)',
          textAlign: 'center',
          letterSpacing: '-0.01em',
          minHeight: 24,
          animation: 'statusFade 320ms ease-out both',
        }}
      >
        {status || 'Analyzing…'}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'analyzing';

export function OnboardingOverlay() {
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint);
  const startFromScratch = useBlueprintStore((s) => s.startFromScratch);

  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Analyzing…');
  const [input, setInput] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input
  const { state: voiceState, liveText, start: startVoice, stop: stopVoice } = useVoiceInput((t) => {
    setInput(t);
  });

  // File upload
  const { openPicker } = useFileUpload((extractedText, name) => {
    setAttachedFile(name);
    setInput(extractedText);
  });

  const isRecording = voiceState === 'listening';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || phase === 'analyzing') return;
    setAttachedFile(null);
    setUrlMode(false);
    setUrlInput('');
    setError('');
    setStatus('Analyzing…');
    setPhase('analyzing');

    try {
      const blueprint = await generateBlueprint(text, (s) => setStatus(s));
      setBlueprint(blueprint);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      setPhase('idle');
    }
  }, [phase, setBlueprint]);

  const fetchUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setFetchingUrl(true);
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      const html: string = json.contents ?? '';
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.innerText.slice(0, 8000);
      setInput(`Content from ${url}:\n\n${text}`);
      setUrlMode(false);
      setUrlInput('');
    } catch {
      setInput(`Content from URL ${url} — please describe the service from this page.`);
      setUrlMode(false);
      setUrlInput('');
    } finally {
      setFetchingUrl(false);
    }
  }, [urlInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const hasContent = (input.trim().length > 0 || isRecording);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--canvas-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Dot background */}
      <OnboardingDotBackground />

      {/* Top-left project switcher */}
      <OnboardingProjectSwitcher />

      {phase === 'analyzing' ? (
        <AnalyzingView status={status} />
      ) : (
        <div style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 620,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 24px',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', flexShrink: 0, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
              <TouchpointsLogo size={52} />
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Touchpoints
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              AI-assisted service blueprinting
            </p>
          </div>

          {/* Input area */}
          <div style={{ flexShrink: 0 }}>
            {/* URL mode */}
            {urlMode && (
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 10,
                padding: '10px 14px',
                background: 'var(--surface-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
              }}>
                <input
                  autoFocus
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchUrl(); if (e.key === 'Escape') setUrlMode(false); }}
                  placeholder="Paste a URL (e.g. sf.gov/services/…)"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={fetchUrl}
                  disabled={!urlInput.trim() || fetchingUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: urlInput.trim() ? 1 : 0.4,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {fetchingUrl ? 'Fetching…' : 'Fetch'}
                </button>
                <button
                  onClick={() => setUrlMode(false)}
                  style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Attached file badge */}
            {attachedFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px 5px 8px',
                marginBottom: 8,
                background: 'var(--accent-primary-soft)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                color: 'var(--accent-primary)',
                alignSelf: 'flex-start',
                width: 'fit-content',
              }}>
                <Paperclip size={11} />
                {attachedFile}
                <button onClick={() => { setAttachedFile(null); setInput(''); }} style={{ color: 'var(--accent-primary)', marginLeft: 2, opacity: 0.7 }}>×</button>
              </div>
            )}

            {/* Chat input box */}
            <div style={{
              background: 'var(--surface-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}>
              <textarea
                ref={textareaRef}
                value={isRecording ? liveText : input}
                onChange={(e) => { if (!isRecording) setInput(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Listening…' : 'Describe the service you want to map — paste a transcript, interview notes, a URL, or just start talking.'}
                disabled={isRecording}
                style={{
                  width: '100%',
                  minHeight: 72,
                  maxHeight: 140,
                  padding: '14px 16px 10px',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: isRecording ? 'var(--accent-primary)' : 'var(--text-primary)',
                  background: 'transparent',
                  overflowY: 'auto',
                  fontFamily: 'inherit',
                }}
              />

              {/* Action bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px 8px',
              }}>
                {/* Left: auxiliary action buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <ActionBtn
                    icon={isRecording ? <Square size={14} /> : <Mic size={14} />}
                    onClick={isRecording ? stopVoice : startVoice}
                    active={isRecording}
                    title={isRecording ? 'Stop recording' : 'Record voice'}
                    danger={isRecording}
                  />
                  <ActionBtn
                    icon={<Paperclip size={14} />}
                    onClick={() => openPicker()}
                    title="Attach document"
                  />
                  <ActionBtn
                    icon={<Link size={14} />}
                    onClick={() => { setUrlMode((v) => !v); }}
                    active={urlMode}
                    title="Paste a URL"
                  />
                </div>

                {/* Right: send button */}
                <button
                  onClick={() => submit(input)}
                  disabled={!hasContent}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: hasContent ? 'var(--action-primary-bg)' : 'var(--surface-bg-muted)',
                    color: hasContent ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s, color 0.15s',
                    cursor: hasContent ? 'pointer' : 'not-allowed',
                    border: 'none',
                    flexShrink: 0,
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* Footer options */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              marginTop: 14,
              paddingBottom: 4,
            }}>
              <button
                onClick={() => {
                  const bp = { ...SAMPLE_BLUEPRINT, id: `sample-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                  setBlueprint(bp);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >
                <FlaskConical size={12} />
                Load sample
              </button>

              <span style={{ color: 'var(--border-strong)', fontSize: 11 }}>·</span>

              <button
                onClick={startFromScratch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
              >
                <ArrowRight size={12} />
                Start from scratch
              </button>
            </div>

            {error && (
              <p style={{
                fontSize: 12,
                color: 'var(--accent-danger)',
                marginTop: 8,
                textAlign: 'center',
              }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({
  icon,
  onClick,
  active,
  title,
  danger,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active
          ? danger
            ? 'rgba(239,68,68,0.1)'
            : 'var(--accent-primary-soft)'
          : 'transparent',
        color: active
          ? danger
            ? 'var(--accent-danger)'
            : 'var(--accent-primary)'
          : 'var(--text-muted)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {icon}
    </button>
  );
}
