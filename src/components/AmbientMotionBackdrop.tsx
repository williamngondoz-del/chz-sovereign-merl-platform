import type { ReactNode } from 'react';

/**
 * Digital Labs × REA 4-Layer Ambient Motion Architecture:
 * 1. Drifting Copper & Ivory Particle Matrix + Vertical Hairline Micro-Grid
 * 2. Diagonal Specular Light Sweep (Flash Sheen)
 * 3. Floating Ambient Copper & Sovereign Teal Radial Glows
 * 4. Counter-Rotating Copper Orbital Rings with Glowing Satellite Nodes
 */
export function AmbientMotionBackdrop({
  variant = 'page',
  children,
}: {
  variant?: 'page' | 'hero';
  children?: ReactNode;
}) {
  if (variant === 'page') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="rea-particles absolute inset-0 opacity-65" />
        <div className="rea-glow-a" />
        <div className="rea-glow-b" />
        <div className="rea-orbit rea-orbit-a" />
        <div className="rea-orbit rea-orbit-b" />
      </div>
    );
  }

  return (
    <div className="editorial-hero-showcase relative overflow-hidden rounded-3xl border border-[#072A2E]/12 bg-[#FFFFFF] p-5 shadow-[0_18px_50px_-24px_rgba(7,42,46,0.22)] sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="rea-particles absolute inset-0 opacity-85" />
        <div className="rea-sweep absolute inset-0" />
        <div className="rea-hero-glow-a" />
        <div className="rea-hero-glow-b" />
        <div className="rea-orbit rea-hero-orbit-a" />
        <div className="rea-orbit rea-hero-orbit-b" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
