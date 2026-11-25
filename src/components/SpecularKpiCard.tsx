import type { MouseEvent, ReactNode } from 'react';

interface SpecularKpiCardProps {
  id: string;
  label: string;
  value: string;
  monoDetail: string;
  caption: string;
  accent?: 'teal' | 'copper' | 'espresso' | 'gold';
  icon: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function SpecularKpiCard({
  id,
  label,
  value,
  monoDetail,
  caption,
  accent = 'teal',
  icon,
  actionLabel,
  onAction,
}: SpecularKpiCardProps) {
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const badgeTone: Record<NonNullable<SpecularKpiCardProps['accent']>, string> = {
    teal: 'bg-[#0E6B8A]/10 text-[#0E6B8A] border-[#0E6B8A]/20',
    copper: 'bg-[#0B7A5C]/10 text-[#0B7A5C] border-[#0B7A5C]/25',
    gold: 'bg-[#14B88A]/15 text-[#085E47] border-[#14B88A]/35',
    espresso: 'bg-[#072A2E]/8 text-[#072A2E] border-[#072A2E]/15',
  };

  return (
    <div
      id={id}
      onMouseMove={handleMouseMove}
      className="kpi-specular-card flex flex-col justify-between rounded-2xl p-4 sm:p-5"
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3F6064]">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${badgeTone[accent]}`}
        >
          {icon}
        </div>
      </div>

      <div className="relative z-10 mt-3">
        <div className="font-editorial text-4xl leading-none text-[#072A2E] sm:text-[2.65rem]">
          {value}
        </div>
        <div className="mt-2 inline-flex items-center rounded-md border border-[#072A2E]/10 bg-[#F4F8F7] px-2 py-0.5 font-code text-[11px] font-medium text-[#072A2E]">
          {monoDetail}
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-2 border-t border-[#072A2E]/8 pt-3">
        <p className="text-xs leading-snug text-[#3F6064]">{caption}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 cursor-pointer rounded-lg border border-[#0B7A5C]/30 bg-[#0B7A5C]/8 px-2.5 py-1 text-[11px] font-semibold text-[#0B7A5C] transition-colors hover:bg-[#0B7A5C] hover:text-[#F4F8F7]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
