import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Square, Paperclip, Link, FlaskConical, ArrowRight, FolderOpen } from 'lucide-react';
import { generateBlueprint } from '../../lib/ai';
import { useBlueprintStore } from '../../store/blueprint.store';
import { SAMPLE_BLUEPRINT } from '../../lib/sample';
import { loadAllBlueprints } from '../../lib/storage';
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

// ─── Types ───────────────────────────────────────────────────────────────────

type MsgRole = 'assistant' | 'user' | 'status';
type Msg = { id: string; role: MsgRole; text: string };

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingOverlay() {
  const setBlueprint = useBlueprintStore((s) => s.setBlueprint);
  const startFromScratch = useBlueprintStore((s) => s.startFromScratch);
  const switchToBlueprint = useBlueprintStore((s) => s.switchToBlueprint);

  const [savedProjects, setSavedProjects] = useState<Blueprint[]>([]);

  useEffect(() => {
    const all = loadAllBlueprints();
    const projects = Object.values(all).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    setSavedProjects(projects);
  }, []);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Describe the service you want to map — paste in a transcript, interview notes, a URL, or just start talking.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [input]);

  const addMsg = (role: MsgRole, text: string) => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    setMessages((m) => [...m, { id, role, text }]);
  };

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setAttachedFile(null);
    setUrlMode(false);
    setUrlInput('');
    setError('');

    addMsg('user', text.length > 200 ? text.slice(0, 200) + '…' : text);
    setLoading(true);

    try {
      const blueprint = await generateBlueprint(text, (status) => {
        // Overwrite last status message or add new one
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last?.role === 'status') {
            return [...m.slice(0, -1), { ...last, text: status }];
          }
          return [...m, { id: `status-${Date.now()}`, role: 'status', text: status }];
        });
      });
      setBlueprint(blueprint);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      addMsg('assistant', 'I ran into an error — please try again.');
      setLoading(false);
    }
  }, [loading, setBlueprint]);

  const fetchUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setFetchingUrl(true);
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      const html: string = json.contents ?? '';
      // Strip HTML tags to plain text
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

  const hasContent = (input.trim().length > 0 || isRecording) && !loading;

  const relativeDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

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

      {/* Centred content column */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 620,
        maxHeight: 'min(90vh, 760px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 24px',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', flexShrink: 0, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'var(--action-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3" fill="white" />
                <circle cx="3" cy="9" r="1.5" fill="white" opacity="0.6" />
                <circle cx="15" cy="9" r="1.5" fill="white" opacity="0.6" />
                <circle cx="9" cy="3" r="1.5" fill="white" opacity="0.6" />
                <circle cx="9" cy="15" r="1.5" fill="white" opacity="0.6" />
              </svg>
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Touchpoints
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            AI-assisted service blueprinting
          </p>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingBottom: 8,
        }}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          flexShrink: 0,
          paddingTop: 12,
        }}>

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
              placeholder={isRecording ? 'Listening…' : 'Describe the service, paste notes, or drop a file here…'}
              disabled={loading || isRecording}
              style={{
                width: '100%',
                minHeight: 52,
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

          {/* Recent projects */}
          {savedProjects.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, textAlign: 'center' }}>
                Recent projects
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedProjects.slice(0, 4).map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => switchToBlueprint(bp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      background: 'var(--surface-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background var(--transition-fast)',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-bg-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-bg)'; }}
                  >
                    <FolderOpen size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bp.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {relativeDate(bp.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  const isStatus = msg.role === 'status';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: isStatus ? '6px 12px' : '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? 'var(--action-primary-bg)'
          : isStatus
          ? 'transparent'
          : 'var(--surface-bg)',
        border: isUser ? 'none' : isStatus ? 'none' : '1px solid var(--border-subtle)',
        boxShadow: isUser || isStatus ? 'none' : 'var(--shadow-sm)',
        fontSize: isStatus ? 12 : 14,
        color: isUser ? '#fff' : isStatus ? 'var(--text-muted)' : 'var(--text-primary)',
        lineHeight: 1.5,
        fontStyle: isStatus ? 'italic' : 'normal',
      }}>
        {msg.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        padding: '10px 16px',
        borderRadius: '16px 16px 16px 4px',
        background: 'var(--surface-bg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: 5,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--text-muted)',
              animation: `typingDot 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
