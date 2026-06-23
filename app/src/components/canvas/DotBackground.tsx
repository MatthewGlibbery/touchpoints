import { useEffect, useRef } from 'react';
import { useStore } from '@xyflow/react';
import { useBlueprintStore } from '../../store/blueprint.store';

const DOT_GAP = 16;
const DOT_BASE_RADIUS = 1;
const DOT_MAX_RADIUS = 1.55;
const EFFECT_RADIUS = 80;

// ─── Color helpers ────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function DotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const dotColorRef = useRef('#DDE1E7');
  const dotHoverColorRef = useRef('#A0A8B4');

  const theme = useBlueprintStore((s) => s.theme);
  const transform = useStore((s) => s.transform);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    dotColorRef.current =
      getComputedStyle(document.documentElement).getPropertyValue('--canvas-grid').trim() ||
      '#DDE1E7';
    // Darker variant for hover — mix the base color toward a darker shade
    const base = dotColorRef.current;
    dotHoverColorRef.current = darkenHex(base, 0.15);
  }, [theme]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current =
        x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null;
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
      const [tx, ty, zoom] = transformRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, width, height);

      const startI = Math.floor(-tx / (DOT_GAP * zoom)) - 1;
      const endI   = Math.ceil((width  - tx) / (DOT_GAP * zoom)) + 1;
      const startJ = Math.floor(-ty / (DOT_GAP * zoom)) - 1;
      const endJ   = Math.ceil((height - ty) / (DOT_GAP * zoom)) + 1;

      const baseColor = dotColorRef.current;
      const hoverColor = dotHoverColorRef.current;

      for (let i = startI; i <= endI; i++) {
        for (let j = startJ; j <= endJ; j++) {
          const sx = tx + i * DOT_GAP * zoom;
          const sy = ty + j * DOT_GAP * zoom;

          // Scale radius with zoom so dots shrink/grow with the canvas
          let r = DOT_BASE_RADIUS * zoom;
          let color = baseColor;
          if (mouse) {
            const dx = sx - mouse.x;
            const dy = sy - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < EFFECT_RADIUS) {
              const t = 1 - dist / EFFECT_RADIUS;
              const s = t * t * (3 - 2 * t); // smoothstep
              r = zoom * (DOT_BASE_RADIUS + (DOT_MAX_RADIUS - DOT_BASE_RADIUS) * s);
              color = lerpColor(baseColor, hoverColor, s);
            }
          }

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.75,
      }}
    />
  );
}
