import { Box, Wifi } from 'lucide-react';
import { useMemo } from 'react';
import { ZAMBIAN_PROVINCES } from '../data/chzSeedData';
import type { MerlRecord, ProvinceName } from '../types/chz';
import { computeRate } from '../utils/chzUtils';

interface Zambia2DMapProps {
  selectedProvince: ProvinceName | 'ALL';
  onSelectProvince: (province: ProvinceName | 'ALL') => void;
  records: MerlRecord[];
  onSwitchTo3D: () => void;
}

/**
 * Ultra-lightweight (<12 KB) Low-Bandwidth 2D SVG Zambia Footprint Map
 * engineered for rural 2G/3G field clinics with district drill-down.
 */
export function Zambia2DMap({
  selectedProvince,
  onSelectProvince,
  records,
  onSwitchTo3D,
}: Zambia2DMapProps) {
  const lusaka = ZAMBIAN_PROVINCES[0];

  const statsByProvince = useMemo(() => {
    const map = new Map<ProvinceName, { rate: number; verifiedCount: number; pendingCount: number }>();
    for (const prov of ZAMBIAN_PROVINCES) {
      const subset = records.filter((r) => r.province === prov.name);
      const verified = subset.filter(
        (r) => r.status === 'LOCKED' || r.status === 'PUBLISHED' || r.status === 'REVISION_PENDING_REPUBLISH'
      );
      const pending = subset.filter((r) => r.status === 'DRAFT' || r.status === 'RETURNED');
      const num = verified.reduce((a, b) => a + b.numerator, 0);
      const den = verified.reduce((a, b) => a + b.denominator, 0);
      map.set(prov.name, {
        rate: computeRate(num, den),
        verifiedCount: verified.length,
        pendingCount: pending.length,
      });
    }
    return map;
  }, [records]);

  const selectedGeo = useMemo(
    () => ZAMBIAN_PROVINCES.find((p) => p.name === selectedProvince) ?? null,
    [selectedProvince]
  );

  return (
    <div className="espresso-surface relative flex min-h-[395px] flex-col justify-between overflow-hidden rounded-2xl p-4 text-[#F4F8F7] sm:min-h-[445px]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-xl border border-[#14B88A]/30 bg-[#072A2E]/90 px-3 py-2">
          <div className="flex items-center gap-1.5 font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]">
            <Wifi className="h-3 w-3 text-[#6CCAD9]" />
            <span>2D Low-Bandwidth Zambia Footprint (&lt;15 KB)</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#F4F8F7]/75">
            Instant 3G field mode · Click any of the 10 provincial hubs to drill down
          </p>
        </div>

        <button
          id="switch-to-3d-globe-btn"
          type="button"
          onClick={onSwitchTo3D}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#14B88A]/55 bg-[#14B88A]/18 px-3 py-2 font-code text-[10.5px] font-semibold text-[#99F6E4] transition-colors hover:bg-[#14B88A] hover:text-[#072A2E]"
        >
          <Box className="h-3.5 w-3.5" />
          <span>Load 3D Globe</span>
        </button>
      </div>

      {/* Stylized Accurate-Relative SVG Map of Zambia's 10 Provinces */}
      <div className="my-2 flex flex-1 items-center justify-center">
        <svg
          viewBox="0 0 540 390"
          role="img"
          aria-label="Interactive 10-Province Zambia Health Network Map"
          className="h-auto max-h-[300px] w-full"
        >
          {/* Subtle Sovereign Zambia Polygon Silhouette */}
          <path
            d="M 105 215 L 145 140 L 210 132 L 262 152 L 288 122 L 320 74 L 392 68 L 448 112 L 474 205 L 434 252 L 342 292 L 288 358 L 222 356 L 170 318 L 96 298 Z"
            fill="#0E6B8A"
            fillOpacity="0.24"
            stroke="#14B88A"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />

          {/* Coordinate Grid Guides */}
          <line x1="60" y1="195" x2="495" y2="195" stroke="#14B88A" strokeOpacity="0.12" strokeDasharray="3 4" />
          <line x1="295" y1="45" x2="295" y2="365" stroke="#14B88A" strokeOpacity="0.12" strokeDasharray="3 4" />

          {/* eSCMIS & Surveillance Corridors from Lusaka HQ */}
          {ZAMBIAN_PROVINCES.filter((p) => !p.isNationalHub).map((prov) => {
            const active =
              selectedProvince === 'ALL' ||
              selectedProvince === 'Lusaka' ||
              selectedProvince === prov.name;
            const midX = (lusaka.svgX + prov.svgX) / 2;
            const midY = (lusaka.svgY + prov.svgY) / 2 - 22;
            return (
              <path
                key={`arc-${prov.name}`}
                d={`M ${lusaka.svgX} ${lusaka.svgY} Q ${midX} ${midY} ${prov.svgX} ${prov.svgY}`}
                fill="none"
                stroke={active ? '#14B88A' : '#1E5B6B'}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={active ? 0.72 : 0.25}
                strokeDasharray={active ? undefined : '3 3'}
              />
            );
          })}

          {/* Interactive Provincial Hub Nodes */}
          {ZAMBIAN_PROVINCES.map((prov) => {
            const st = statsByProvince.get(prov.name)!;
            const isSelected = selectedProvince === prov.name;
            const isDimmed = selectedProvince !== 'ALL' && !isSelected;

            return (
              <g
                key={prov.name}
                role="button"
                tabIndex={0}
                aria-label={`${prov.name} Province, ${prov.facilitiesCount} facilities, ${st.verifiedCount} verified records`}
                onClick={() => onSelectProvince(isSelected ? 'ALL' : prov.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProvince(isSelected ? 'ALL' : prov.name);
                  }
                }}
                className="cursor-pointer outline-none"
                opacity={isDimmed ? 0.42 : 1}
              >
                <circle
                  cx={prov.svgX}
                  cy={prov.svgY}
                  r={isSelected ? 16 : prov.isNationalHub ? 13 : 10}
                  fill={isSelected ? '#14B88A' : '#0E6B8A'}
                  fillOpacity={isSelected ? 0.35 : 0.28}
                  stroke={isSelected ? '#F4F8F7' : '#14B88A'}
                  strokeWidth={isSelected ? 1.8 : 1}
                />
                <circle
                  cx={prov.svgX}
                  cy={prov.svgY}
                  r={isSelected ? 6.5 : prov.isNationalHub ? 5.5 : 4.5}
                  fill={isSelected ? '#FFFFFF' : prov.isNationalHub ? '#F59E0B' : '#38BDF8'}
                />
                <text
                  x={prov.svgX}
                  y={prov.svgY - (isSelected ? 20 : 14)}
                  textAnchor="middle"
                  fill={isSelected ? '#F4F8F7' : '#CCFBF1'}
                  fontSize={isSelected ? '11' : '10'}
                  fontWeight={isSelected || prov.isNationalHub ? '700' : '500'}
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {prov.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* District Drill-Down Footer */}
      <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-[#14B88A]/28 bg-[#072A2E]/92 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-editorial text-lg leading-none">
              {selectedGeo ? `${selectedGeo.name} Province (${selectedGeo.capital})` : 'All 10 Zambian Provinces'}
            </span>
            <span className="rounded bg-[#0E6B8A]/50 px-1.5 py-0.5 font-code text-[10px] text-[#9BE0EE]">
              {selectedGeo ? selectedGeo.regionalHubCode : 'ZM-NATIONAL-10'}
            </span>
          </div>
          <p className="mt-1 truncate font-code text-[10px] text-[#F4F8F7]/75">
            {selectedGeo
              ? `DISTRICTS (${selectedGeo.districts.length}): ${selectedGeo.districts.join(' · ')}`
              : `1,121 HEALTH FACILITIES · 60 TRACKED PRIORITY DISTRICTS · ZERO WEBGL OVERHEAD`}
          </p>
        </div>

        {selectedProvince !== 'ALL' ? (
          <button
            type="button"
            onClick={() => onSelectProvince('ALL')}
            className="shrink-0 cursor-pointer rounded-lg bg-[#0B7A5C] px-3 py-1.5 text-[11px] font-semibold text-[#F4F8F7] hover:bg-[#14B88A] hover:text-[#072A2E]"
          >
            All 10 Provinces
          </button>
        ) : null}
      </div>
    </div>
  );
}
