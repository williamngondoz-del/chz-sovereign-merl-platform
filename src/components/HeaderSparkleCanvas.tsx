import { useEffect, useRef } from 'react';

interface SparkleParticle {
  x: number;
  y: number;
  radius: number;
  phase: number;
  speed: number;
  color: 'gold' | 'ivory';
  driftX: number;
  maxAlpha: number;
}

/**
 * Subtle, pointer-events-none Canvas 2D twinkling gold and warm ivory sparkle
 * overlay for the deep roasted espresso command header.
 */
export function HeaderSparkleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let particles: SparkleParticle[] = [];

    const initParticles = (w: number, h: number) => {
      const count = Math.max(24, Math.min(62, Math.floor((w * h) / 4800)));
      particles = Array.from({ length: count }, (_, idx) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 0.7 + Math.random() * 1.35,
        phase: Math.random() * Math.PI * 2,
        speed: 0.45 + Math.random() * 0.95,
        color: idx % 3 === 0 ? 'ivory' : 'gold',
        driftX: (Math.random() - 0.5) * 0.08,
        maxAlpha: 0.24 + Math.random() * 0.44,
      }));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(width, height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    const drawSparkle = (p: SparkleParticle, alpha: number) => {
      const rgb = p.color === 'gold' ? '20, 184, 138' : '224, 247, 250';

      // Soft warm halo
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4.2);
      glow.addColorStop(0, `rgba(${rgb}, ${alpha * 0.75})`);
      glow.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.18})`);
      glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Delicate 4-point star glint on brighter gold sparks
      if (p.radius > 1.35 && alpha > 0.34) {
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.55})`;
        ctx.lineWidth = 0.65;
        const arm = p.radius * 3.1;
        ctx.beginPath();
        ctx.moveTo(p.x - arm, p.y);
        ctx.lineTo(p.x + arm, p.y);
        ctx.moveTo(p.x, p.y - arm);
        ctx.lineTo(p.x, p.y + arm);
        ctx.stroke();
      }

      // Crisp core dot
      ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha + 0.15)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (timeMs: number) => {
      const t = timeMs * 0.001;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.x += p.driftX;
          if (p.x < -8) p.x = width + 8;
          if (p.x > width + 8) p.x = -8;
        }
        const wave = prefersReducedMotion ? 0.65 : 0.25 + 0.75 * ((Math.sin(t * p.speed + p.phase) + 1) * 0.5);
        drawSparkle(p, p.maxAlpha * wave);
      }

      if (!prefersReducedMotion) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
    />
  );
}
