import { useState, useRef, useEffect } from 'react';
import { sendOTP, verifyOTP } from '../../lib/auth';
import { useBlueprintStore } from '../../store/blueprint.store';
import { GitBranch, ArrowRight, RotateCcw, Upload } from 'lucide-react';

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

type Step = 'email' | 'otp' | 'migration';

export function AuthScreen() {
  const pendingMigration = useBlueprintStore((s) => s.pendingMigration);
  const confirmMigration = useBlueprintStore((s) => s.confirmMigration);
  const skipMigration = useBlueprintStore((s) => s.skipMigration);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  // When the store detects blueprints to migrate, show the migration step
  useEffect(() => {
    if (pendingMigration && pendingMigration.length > 0) setStep('migration');
  }, [pendingMigration]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendOTP(email.trim());
      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleOTPSubmit(code: string) {
    setLoading(true);
    setError(null);
    try {
      await verifyOTP(email.trim(), code);
      // onAuthStateChange in the store will handle setUser + mode switch
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  function handleOTPChange(idx: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = char;
    setOtp(next);
    if (char && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
    const full = next.join('');
    if (full.length === 6) {
      handleOTPSubmit(full);
    }
  }

  function handleOTPKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handleOTPPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length > 0) {
      e.preventDefault();
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < text.length; i++) next[i] = text[i];
      setOtp(next);
      const focusIdx = Math.min(text.length, 5);
      inputRefs.current[focusIdx]?.focus();
      if (text.length === 6) handleOTPSubmit(text);
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
              Enter your email to sign in or create an account. We'll send a 6-digit code.
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
        ) : step === 'otp' ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
              Enter the 6-digit code sent to
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              {email}
            </p>

            {/* OTP digit boxes */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }} onPaste={handleOTPPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                  disabled={loading}
                  style={{
                    width: 44, height: 48,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-bg-muted)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    caretColor: 'var(--accent-primary)',
                  }}
                />
              ))}
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--accent-danger)', marginBottom: 10 }}>{error}</p>
            )}

            {loading && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Verifying…</p>
            )}

            <button
              onClick={() => { setStep('email'); setOtp(['','','','','','']); setError(null); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 4,
                padding: 0, marginTop: 4,
              }}
            >
              <RotateCcw size={11} /> Use a different email
            </button>
          </div>
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
