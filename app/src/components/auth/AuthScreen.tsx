import { useState, useRef, useEffect } from 'react';
import { sendOTP, verifyOTP } from '../../lib/auth';
import { useBlueprintStore } from '../../store/blueprint.store';
import { GitBranch, ArrowRight, RotateCcw, Upload, Mail, User } from 'lucide-react';

// ─── Canvas dot background (same as OnboardingOverlay) ───────────────────────

const DOT_GAP = 16;
const DOT_BASE_RADIUS = 1;
const DOT_MAX_RADIUS = 1.55;
const EFFECT_RADIUS = 80;

function DotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const dotColorRef = useRef('#DDE1E7');

  useEffect(() => {
    dotColorRef.current =
      getComputedStyle(document.documentElement).getPropertyValue('--canvas-grid').trim() || '#DDE1E7';
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setSize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
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
      const smoothstep = (t: number) => t * t * (3 - 2 * t);
      for (let col = 0; col * DOT_GAP <= width + DOT_GAP; col++) {
        for (let row = 0; row * DOT_GAP <= height + DOT_GAP; row++) {
          const x = col * DOT_GAP;
          const y = row * DOT_GAP;
          let r = DOT_BASE_RADIUS;
          if (mouse) {
            const dx = x - mouse.x; const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < EFFECT_RADIUS) {
              const t = smoothstep(1 - dist / EFFECT_RADIUS);
              r = DOT_BASE_RADIUS + (DOT_MAX_RADIUS - DOT_BASE_RADIUS) * t;
            }
          }
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

// ─── MigrationStep ───────────────────────────────────────────────────────────

function MigrationStep({ count, loading, onConfirm, onSkip }: {
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--accent-primary-soft)',
        margin: '0 auto 16px',
      }}>
        <Upload size={22} color="var(--accent-primary)" />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
        Import local projects?
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 24, textAlign: 'center' }}>
        We found {count} project{count !== 1 ? 's' : ''} saved on this device. Would you like to import {count !== 1 ? 'them' : 'it'} to your account?
      </p>
      <button
        onClick={onConfirm}
        disabled={loading}
        style={{
          width: '100%', padding: '10px 16px',
          background: 'var(--action-primary-bg)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)',
          fontSize: 14, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          marginBottom: 8,
        }}
      >
        {loading ? 'Importing…' : `Import ${count} project${count !== 1 ? 's' : ''}`}
      </button>
      <button
        onClick={onSkip}
        disabled={loading}
        style={{
          width: '100%', padding: '10px 16px',
          background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
          fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        Skip
      </button>
    </div>
  );
}

// ─── AuthScreen ───────────────────────────────────────────────────────────────

type Step = 'email' | 'sent' | 'name-capture' | 'migration';

export function AuthScreen() {
  const pendingMigration = useBlueprintStore((s) => s.pendingMigration);
  const pendingNameCapture = useBlueprintStore((s) => s.pendingNameCapture);
  const confirmMigration = useBlueprintStore((s) => s.confirmMigration);
  const skipMigration = useBlueprintStore((s) => s.skipMigration);
  const submitDisplayName = useBlueprintStore((s) => s.submitDisplayName);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (step === 'sent') codeRef.current?.focus(); }, [step]);
  useEffect(() => { if (step === 'name-capture') nameRef.current?.focus(); }, [step]);

  // Drive step from store flags (name capture takes priority over migration)
  useEffect(() => {
    if (pendingNameCapture) setStep('name-capture');
    else if (pendingMigration && pendingMigration.length > 0) setStep('migration');
  }, [pendingNameCapture, pendingMigration]);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError('Enter a name');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submitDisplayName(trimmed);
      // Store will route to onboarding/canvas (or to migration step)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendOTP(email.trim());
      setCode('');
      setStep('sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError(null);
    try {
      await sendOTP(email.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setError('Enter the code from your email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyOTP(email.trim(), trimmed);
      // Auth state listener picks up the new session and routes the app
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  const boxStyle: React.CSSProperties = {
    background: 'var(--surface-bg)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 28px',
    width: 360,
    boxShadow: 'var(--shadow-md)',
    position: 'relative',
    zIndex: 1,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-bg-muted)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--action-primary-bg)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--canvas-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <DotBackground />

      <div style={boxStyle}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--action-primary-bg)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Touchpoints
          </span>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Enter your email to sign in or create an account. We'll send a verification code.
            </p>
            <div style={{ marginBottom: 12 }}>
              <input
                ref={emailRef}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
                required
              />
            </div>
            {error && (
              <p style={{ fontSize: 12, color: 'var(--accent-danger)', marginBottom: 10 }}>{error}</p>
            )}
            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Sending…' : <><span>Continue</span><ArrowRight size={14} /></>}
            </button>
          </form>
        ) : step === 'sent' ? (
          <form onSubmit={handleVerify}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent-primary-soft)',
              margin: '0 auto 16px',
            }}>
              <Mail size={22} color="var(--accent-primary)" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
              Check your email
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 4, textAlign: 'center' }}>
              We sent a verification code to
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>
              {email}
            </p>

            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              style={{
                ...inputStyle,
                marginBottom: 12,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '4px',
                fontVariantNumeric: 'tabular-nums',
              }}
            />

            {error && (
              <p style={{ fontSize: 12, color: 'var(--accent-danger)', marginBottom: 10 }}>{error}</p>
            )}

            <button type="submit" style={btnStyle} disabled={loading || code.length < 6}>
              {loading ? 'Verifying…' : <><span>Sign in</span><ArrowRight size={14} /></>}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              style={{
                ...btnStyle,
                background: 'var(--surface-bg-muted)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              {loading ? 'Sending…' : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(null); setCode(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 4,
                padding: 0, margin: '4px auto 0',
              }}
            >
              <RotateCcw size={11} /> Use a different email
            </button>
          </form>
        ) : step === 'name-capture' ? (
          <form onSubmit={handleNameSubmit}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent-primary-soft)',
              margin: '0 auto 16px',
            }}>
              <User size={22} color="var(--accent-primary)" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
              What should we call you?
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20, textAlign: 'center' }}>
              This name appears on your comments and notifications.
            </p>
            <input
              ref={nameRef}
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              maxLength={60}
              style={{ ...inputStyle, marginBottom: 12 }}
              autoComplete="name"
              required
            />
            {error && (
              <p style={{ fontSize: 12, color: 'var(--accent-danger)', marginBottom: 10 }}>{error}</p>
            )}
            <button type="submit" style={btnStyle} disabled={loading || name.trim().length === 0}>
              {loading ? 'Saving…' : <><span>Continue</span><ArrowRight size={14} /></>}
            </button>
          </form>
        ) : step === 'migration' ? (
          <MigrationStep
            count={pendingMigration?.length ?? 0}
            loading={loading}
            onConfirm={async () => {
              setLoading(true);
              await confirmMigration();
              setLoading(false);
            }}
            onSkip={async () => {
              setLoading(true);
              await skipMigration();
              setLoading(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
