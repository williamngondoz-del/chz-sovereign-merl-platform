import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  Lock,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AmbientMotionBackdrop } from '../components/AmbientMotionBackdrop';
import { SpecularKpiCard } from '../components/SpecularKpiCard';
import { Zambia2DMap } from '../components/Zambia2DMap';
import { INDICATOR_CATALOG, PROGRAMMES, PROVINCE_NAMES } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import { computeRate, computeWeightedTarget } from '../utils/chzUtils';
import {
  buildReconciliationMeta,
  downloadEditableWordBrief,
  downloadVerifiedCsv,
  downloadVerifiedExcel,
  downloadVerifiedPdf,
  estimateExportSizesKb,
} from '../utils/exportEngine';

// Lazy-load 1.2 MB Three.js globe ONLY when user opts into 3D mode (cuts 3G initial load by >70%)
const LazySovereignGlobe3D = lazy(() =>
  import('../components/SovereignGlobe3D').then((m) => ({ default: m.SovereignGlobe3D }))
);

const PAGE_SIZE = 10;

export function Screen1ExecutiveCommand() {
  const records = useChzStore((s) => s.records);
  const activeRole = useChzStore((s) => s.activeRole);
  const selectedProvince = useChzStore((s) => s.selectedProvince);
  const selectedIndicatorScope = useChzStore((s) => s.selectedIndicatorScope);
  const chartGrouping = useChzStore((s) => s.chartGrouping);
  const mapMode = useChzStore((s) => s.mapMode);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const setSelectedProvince = useChzStore((s) => s.setSelectedProvince);
  const setSelectedIndicatorScope = useChzStore((s) => s.setSelectedIndicatorScope);
  const setChartGrouping = useChzStore((s) => s.setChartGrouping);
  const setMapMode = useChzStore((s) => s.setMapMode);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);
  const logExportEvent = useChzStore((s) => s.logExportEvent);

  const [page, setPage] = useState(1);

  const scopedProvinceRecords = useMemo(
    () =>
      selectedProvince === 'ALL'
        ? records
        : records.filter((r) => r.province === selectedProvince),
    [records, selectedProvince]
  );

  const verifiedAllInProvince = useMemo(
    () =>
      scopedProvinceRecords.filter(
        (r) =>
          r.status === 'LOCKED' ||
          r.status === 'PUBLISHED' ||
          r.status === 'REVISION_PENDING_REPUBLISH'
      ),
    [scopedProvinceRecords]
  );

  // Unit-safe indicator-scoped records (prevents mixing incompatible units like Facilities + Births)
  const unitScopedVerified = useMemo(
    () =>
      selectedIndicatorScope === 'PORTFOLIO'
        ? verifiedAllInProvince
        : verifiedAllInProvince.filter((r) => r.indicatorCode === selectedIndicatorScope),
    [verifiedAllInProvince, selectedIndicatorScope]
  );

  const selectedIndicatorMeta = useMemo(
    () => INDICATOR_CATALOG.find((i) => i.code === selectedIndicatorScope) ?? null,
    [selectedIndicatorScope]
  );

  const pendingRecords = useMemo(
    () => scopedProvinceRecords.filter((r) => r.status === 'DRAFT' || r.status === 'RETURNED'),
    [scopedProvinceRecords]
  );

  const publishedRecords = useMemo(
    () => scopedProvinceRecords.filter((r) => r.status === 'PUBLISHED'),
    [scopedProvinceRecords]
  );

  // Unit-safe aggregation OR Portfolio Attainment Index (% of indicators meeting target)
  const portfolioAttainment = useMemo(() => {
    if (verifiedAllInProvince.length === 0) return { met: 0, total: 0, pct: 0 };
    const met = verifiedAllInProvince.filter(
      (r) => computeRate(r.numerator, r.denominator) >= r.targetRate
    ).length;
    return {
      met,
      total: verifiedAllInProvince.length,
      pct: computeRate(met, verifiedAllInProvince.length),
    };
  }, [verifiedAllInProvince]);

  const totalNumerator = useMemo(
    () => unitScopedVerified.reduce((sum, r) => sum + r.numerator, 0),
    [unitScopedVerified]
  );
  const totalDenominator = useMemo(
    () => unitScopedVerified.reduce((sum, r) => sum + r.denominator, 0),
    [unitScopedVerified]
  );
  const unitSafeRate = computeRate(totalNumerator, totalDenominator);
  const weightedTarget = useMemo(
    () => computeWeightedTarget(unitScopedVerified),
    [unitScopedVerified]
  );

  const chartData = useMemo(() => {
    if (chartGrouping === 'programme') {
      return PROGRAMMES.map((prog) => {
        const subset = verifiedAllInProvince.filter((r) => r.programme === prog);
        const num = subset.reduce((a, b) => a + b.numerator, 0);
        const den = subset.reduce((a, b) => a + b.denominator, 0);
        const wTarget = computeWeightedTarget(subset);
        const shortName = prog
          .replace(' Supply Chain', '')
          .replace(' & Newborn Health', ' & Newborn')
          .replace(' Surveillance & Vector Control', '')
          .replace(' Continuum of Care', '');
        return {
          name: shortName,
          achieved: computeRate(num, den),
          target: wTarget,
          recordsCount: subset.length,
        };
      }).filter((d) => d.recordsCount > 0);
    }

    const provinceList = selectedProvince === 'ALL' ? PROVINCE_NAMES : [selectedProvince];
    return provinceList
      .map((prov) => {
        const subset = records.filter(
          (r) =>
            r.province === prov &&
            (r.status === 'LOCKED' ||
              r.status === 'PUBLISHED' ||
              r.status === 'REVISION_PENDING_REPUBLISH') &&
            (selectedIndicatorScope === 'PORTFOLIO' || r.indicatorCode === selectedIndicatorScope)
        );
        const num = subset.reduce((a, b) => a + b.numerator, 0);
        const den = subset.reduce((a, b) => a + b.denominator, 0);
        return {
          name: prov === 'North-Western' ? 'N-Western' : prov,
          achieved: computeRate(num, den),
          target: computeWeightedTarget(subset),
          recordsCount: subset.length,
        };
      })
      .filter((d) => d.recordsCount > 0);
  }, [chartGrouping, verifiedAllInProvince, records, selectedProvince, selectedIndicatorScope]);

  const scopeLabel = `${selectedProvince === 'ALL' ? 'All Provinces' : `${selectedProvince} Province`} (${selectedIndicatorScope})`;
  const canExport = hasPermission('executiveExport');
  const exportSizes = useMemo(
    () => estimateExportSizesKb(unitScopedVerified, scopeLabel, activeRole),
    [unitScopedVerified, scopeLabel, activeRole]
  );
  const reconMeta = useMemo(
    () => buildReconciliationMeta(unitScopedVerified, activeRole),
    [unitScopedVerified, activeRole]
  );

  const handleExport = (format: 'CSV' | 'EXCEL' | 'PDF' | 'WORD') => {
    if (!canExport) {
      logExportEvent(format, scopeLabel, unitScopedVerified.length, 0);
      return;
    }
    let bytes = 0;
    if (format === 'CSV') bytes = downloadVerifiedCsv(unitScopedVerified, scopeLabel, activeRole);
    else if (format === 'EXCEL') bytes = downloadVerifiedExcel(unitScopedVerified, scopeLabel, activeRole);
    else if (format === 'PDF') bytes = downloadVerifiedPdf(unitScopedVerified, scopeLabel, activeRole);
    else bytes = downloadEditableWordBrief(unitScopedVerified, scopeLabel, activeRole);
    logExportEvent(format, scopeLabel, unitScopedVerified.length, bytes);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(unitScopedVerified.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = unitScopedVerified.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section aria-labelledby="screen-1-heading" className="space-y-6">
      {/* REA 4-Layer Ambient Motion & Flash-Sheen Editorial Hero Showcase */}
      <AmbientMotionBackdrop variant="hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0B7A5C]/30 bg-[#F4F8F7]/90 px-3 py-1 font-code text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
              <span>◈</span>
              <span>Digital Labs × EMCA Consultancy · Sovereign Health Intelligence</span>
            </div>
            <h1
              id="screen-1-heading"
              className="mt-3 font-editorial text-3xl leading-[1.06] text-[#072A2E] sm:text-5xl"
            >
              Sovereign Health Command &amp; Reconciled Roll-Ups
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#3F6064]">
              Unit-isolated numerator/denominator roll-ups with denominator-weighted targets,
              instant 2D low-bandwidth Zambia map mode for rural 3G handsets, and 4-format
              formula-safe audited exports across all 10 provinces.
            </p>
          </div>

          {/* 4-Format Reconciled Exports with Flash-Sheen Micro-Interactions */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { fmt: 'CSV', label: 'CSV', kb: exportSizes.csvKb, icon: <Download className="h-3.5 w-3.5" /> },
                { fmt: 'EXCEL', label: 'Excel', kb: exportSizes.excelKb, icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
                { fmt: 'PDF', label: 'PDF', kb: exportSizes.pdfKb, icon: <FileText className="h-3.5 w-3.5" /> },
                { fmt: 'WORD', label: 'Word', kb: exportSizes.wordKb, icon: <FileText className="h-3.5 w-3.5" /> },
              ] as const
            ).map((btn) => (
              <button
                key={btn.fmt}
                id={`export-${btn.fmt.toLowerCase()}-btn`}
                type="button"
                onClick={() => handleExport(btn.fmt)}
                title={
                  canExport
                    ? `Download formula-safe ${btn.label} (${btn.kb} KB) · Checksum ${reconMeta.checksum}`
                    : `Restricted: ${activeRole} lacks executiveExport permission`
                }
                className={`flash-sheen-btn inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  canExport
                    ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7] hover:border-[#0B7A5C] hover:bg-[#0B7A5C]'
                    : 'border-[#072A2E]/20 bg-[#E6F0EE] text-[#3F6064]'
                }`}
              >
                {canExport ? btn.icon : <Lock className="h-3 w-3" />}
                <span>{btn.label}</span>
                <span className="font-code text-[10px] opacity-80">~{btn.kb}KB</span>
              </button>
            ))}
          </div>
        </div>

        {/* REA Checkmark Trust Pillars + Geometric Glyph Capability Strip */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[#072A2E]/10 pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#072A2E]/10 bg-[#F4F8F7]/85 px-3.5 py-2.5">
            <span className="glyph-badge">◈</span>
            <div>
              <div className="text-xs font-semibold text-[#072A2E]">✓ Accuracy</div>
              <div className="font-code text-[10px] text-[#3F6064]">
                Unit-Isolated &amp; Strata Reconciled
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#072A2E]/10 bg-[#F4F8F7]/85 px-3.5 py-2.5">
            <span className="glyph-badge">⚖</span>
            <div>
              <div className="text-xs font-semibold text-[#072A2E]">✓ Integrity</div>
              <div className="font-code text-[10px] text-[#3F6064]">
                FIPS 180-4 SHA-256 Chain + MFA
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#072A2E]/10 bg-[#F4F8F7]/85 px-3.5 py-2.5">
            <span className="glyph-badge">⌖</span>
            <div>
              <div className="text-xs font-semibold text-[#072A2E]">✓ Accountability</div>
              <div className="font-code text-[10px] text-[#3F6064]">
                Zambia DPA No. 3 of 2021 · Zero PII
              </div>
            </div>
          </div>
        </div>
      </AmbientMotionBackdrop>

      {/* Indicator / Unit Family Scope Selector (Eliminates Mixed-Unit Summation!) */}
      <div className="editorial-surface rounded-2xl p-3.5 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#072A2E]">
            Unit-Safe Indicator Family Scope (Zero Cross-Unit Summation)
          </span>
          <span className="font-code text-[10.5px] text-[#0E6B8A]">
            RECONCILIATION CHECKSUM: <strong>{reconMeta.checksum}</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedIndicatorScope('PORTFOLIO');
              setPage(1);
            }}
            className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedIndicatorScope === 'PORTFOLIO'
                ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7]'
                : 'border-[#072A2E]/14 bg-[#F4F8F7] text-[#072A2E] hover:border-[#0B7A5C]'
            }`}
          >
            Portfolio Attainment Index ({portfolioAttainment.met}/{portfolioAttainment.total})
          </button>
          {INDICATOR_CATALOG.filter((ind) =>
            verifiedAllInProvince.some((r) => r.indicatorCode === ind.code)
          ).map((ind) => {
            const active = selectedIndicatorScope === ind.code;
            return (
              <button
                key={ind.code}
                type="button"
                onClick={() => {
                  setSelectedIndicatorScope(ind.code);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#0E6B8A] bg-[#0E6B8A] text-[#F4F8F7]'
                    : 'border-[#072A2E]/12 bg-[#F4F8F7] text-[#072A2E] hover:border-[#0B7A5C]'
                }`}
              >
                <span className="font-code text-[10.5px] font-semibold">{ind.code}</span>
                <span className="ml-1.5 opacity-85">· {ind.unitLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live KPI Strip with Cursor-Tracking Warm Copper Specular Highlights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {selectedIndicatorScope === 'PORTFOLIO' ? (
          <SpecularKpiCard
            id="kpi-portfolio-attainment"
            label="Portfolio Attainment Index"
            value={`${portfolioAttainment.pct}%`}
            monoDetail={`${portfolioAttainment.met} OF ${portfolioAttainment.total} INDICATORS ON TARGET`}
            caption="Cross-programme executive index avoiding invalid mixed-unit sums."
            accent="teal"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        ) : (
          <SpecularKpiCard
            id="kpi-verified-reach"
            label={`Verified ${selectedIndicatorMeta?.unitLabel ?? 'Reach'}`}
            value={totalNumerator.toLocaleString()}
            monoDetail={`${selectedIndicatorScope} · ${unitScopedVerified.length} LOCKED PERIODS`}
            caption={`Unit-isolated aggregate count (${selectedIndicatorMeta?.unitLabel ?? 'units'}) only.`}
            accent="teal"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        )}

        <SpecularKpiCard
          id="kpi-combined-rate"
          label={
            selectedIndicatorScope === 'PORTFOLIO'
              ? 'Weighted Target Benchmark'
              : 'Combined Num / Den Rate'
          }
          value={selectedIndicatorScope === 'PORTFOLIO' ? `${weightedTarget}%` : `${unitSafeRate}%`}
          monoDetail={
            selectedIndicatorScope === 'PORTFOLIO'
              ? 'DENOMINATOR-WEIGHTED TARGET'
              : `${totalNumerator.toLocaleString()} / ${totalDenominator.toLocaleString()} (W-TGT ${weightedTarget}%)`
          }
          caption="Strict Σ(Target×Den)/Σ(Den) weighted target — zero unweighted averages."
          accent="copper"
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <SpecularKpiCard
          id="kpi-pending-merl"
          label="Pending MERL Reviews"
          value={String(pendingRecords.length)}
          monoDetail={`${scopedProvinceRecords.filter((r) => r.status === 'DRAFT').length} DRAFT · ${scopedProvinceRecords.filter((r) => r.status === 'RETURNED').length} RETURNED`}
          caption="Awaiting MERL verification & MFA period lock."
          accent="gold"
          icon={<Clock3 className="h-4 w-4" />}
          actionLabel="MERL Gate"
          onAction={() => setActiveScreen('verification')}
        />

        <SpecularKpiCard
          id="kpi-published-cms"
          label="Published CMS Factsheets"
          value={String(publishedRecords.length)}
          monoDetail="coalitionhealth.org.zm · DPA OK"
          caption="Versioned aggregate-only (n>=10, PII-scanned) public factsheets."
          accent="espresso"
          icon={<Globe className="h-4 w-4" />}
          actionLabel="Public CMS"
          onAction={() => setActiveScreen('cms')}
        />
      </div>

      {/* Province Filter Pills */}
      <div className="editorial-surface rounded-2xl p-3.5 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0B7A5C]" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#072A2E]">
              Provincial Scope Filter (10 Provinces)
            </span>
          </div>
          <span className="font-code text-[11px] text-[#0E6B8A] font-semibold">
            {selectedProvince === 'ALL' ? 'NATIONAL (10 PROVINCES)' : `${selectedProvince.toUpperCase()} PROVINCE`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by Zambian Province">
          <button
            id="province-pill-ALL"
            type="button"
            onClick={() => {
              setSelectedProvince('ALL');
              setPage(1);
            }}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedProvince === 'ALL'
                ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7]'
                : 'border-[#072A2E]/14 bg-[#F4F8F7] text-[#072A2E] hover:border-[#0B7A5C]'
            }`}
          >
            All 10 Provinces
          </button>
          {PROVINCE_NAMES.map((prov) => {
            const active = selectedProvince === prov;
            const provCount = records.filter(
              (r) =>
                r.province === prov &&
                (r.status === 'LOCKED' ||
                  r.status === 'PUBLISHED' ||
                  r.status === 'REVISION_PENDING_REPUBLISH')
            ).length;
            return (
              <button
                key={prov}
                id={`province-pill-${prov.toLowerCase().replace(/\s+/g, '-')}`}
                type="button"
                onClick={() => {
                  setSelectedProvince(prov);
                  setPage(1);
                }}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-[#0E6B8A] bg-[#0E6B8A] text-[#F4F8F7]'
                    : 'border-[#072A2E]/12 bg-[#F4F8F7] text-[#072A2E] hover:border-[#0B7A5C]'
                }`}
              >
                <span>{prov}</span>
                <span className={`font-code text-[10px] ${active ? 'text-[#F4F8F7]/80' : 'text-[#3F6064]'}`}>
                  {provCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Analytical Grid: 2D Low-Bandwidth Map (or Lazy 3D Globe) + Weighted Target vs Achieved Chart */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          {mapMode === '2d' ? (
            <Zambia2DMap
              selectedProvince={selectedProvince}
              onSelectProvince={setSelectedProvince}
              records={records}
              onSwitchTo3D={() => setMapMode('3d')}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setMapMode('2d')}
                  className="cursor-pointer rounded-lg border border-[#072A2E]/16 bg-[#FFFFFF] px-3 py-1 font-code text-[10.5px] font-semibold text-[#0E6B8A] hover:border-[#0E6B8A]"
                >
                  ← Switch to 2D Low-Bandwidth Mode
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="espresso-surface flex h-[410px] items-center justify-center rounded-2xl text-xs text-[#5EEAD4]">
                    Loading lazy Three.js 3D Sovereign Globe…
                  </div>
                }
              >
                <LazySovereignGlobe3D
                  selectedProvince={selectedProvince}
                  onSelectProvince={setSelectedProvince}
                  records={records}
                />
              </Suspense>
            </div>
          )}
        </div>

        <div className="editorial-surface flex flex-col rounded-2xl p-4 sm:p-5 xl:col-span-6">
          <div className="flex flex-col gap-3 border-b border-[#072A2E]/10 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#0E6B8A]" />
                <h2 className="font-editorial text-2xl text-[#072A2E]">
                  Weighted Target vs. Verified Achieved (%)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-[#3F6064]">
                Denominator-weighted targets recalculated live upon MERL lock.
              </p>
            </div>

            <div className="inline-flex self-start rounded-xl border border-[#072A2E]/12 bg-[#F4F8F7] p-1">
              <button
                type="button"
                onClick={() => setChartGrouping('programme')}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  chartGrouping === 'programme'
                    ? 'bg-[#072A2E] text-[#F4F8F7]'
                    : 'text-[#3F6064] hover:text-[#072A2E]'
                }`}
              >
                By Programme
              </button>
              <button
                type="button"
                onClick={() => setChartGrouping('province')}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  chartGrouping === 'province'
                    ? 'bg-[#072A2E] text-[#F4F8F7]'
                    : 'text-[#3F6064] hover:text-[#072A2E]'
                }`}
              >
                By Province
              </button>
            </div>
          </div>

          <div className="mt-4 h-[310px] w-full sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -12, bottom: 26 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(7,42,46,0.09)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#3F6064', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={{ stroke: 'rgba(7,42,46,0.16)' }}
                  tickLine={false}
                  angle={-18}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#3F6064', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(20, 184, 138, 0.12)' }}
                  contentStyle={{
                    backgroundColor: '#072A2E',
                    border: '1px solid rgba(20,184,138,0.45)',
                    borderRadius: '12px',
                    color: '#F4F8F7',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${Number(value ?? 0)}%`, '']}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                <Bar dataKey="target" name="Weighted Target (%)" fill="#D97706" radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Bar dataKey="achieved" name="Verified Achieved (%)" fill="#0B7A5C" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Paginated Verified Ledger */}
      <div className="editorial-surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#072A2E]/10 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="font-editorial text-2xl text-[#072A2E]">
              Verified Provincial Indicator Snapshot
            </h2>
            <p className="text-xs text-[#3F6064]">
              Page {safePage} of {totalPages} · {unitScopedVerified.length} reconciled records in
              scope.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex cursor-pointer items-center rounded-lg border border-[#072A2E]/16 px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-code text-[11px]">
              {safePage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex cursor-pointer items-center rounded-lg border border-[#072A2E]/16 px-2 py-1 text-xs disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-[#072A2E]/10 bg-[#F4F8F7] text-[10.5px] uppercase tracking-[0.12em] text-[#3F6064]">
              <tr>
                <th className="px-4 py-3 font-semibold">Record &amp; Ver.</th>
                <th className="px-4 py-3 font-semibold">Province &amp; Strata</th>
                <th className="px-4 py-3 font-semibold">Indicator</th>
                <th className="px-4 py-3 text-right font-semibold">Num / Den</th>
                <th className="px-4 py-3 text-right font-semibold">Achieved vs Target</th>
                <th className="px-4 py-3 font-semibold">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#072A2E]/8">
              {paginatedRows.map((rec) => {
                const rate = computeRate(rec.numerator, rec.denominator);
                return (
                  <tr key={rec.id} className="hover:bg-[#F4F8F7]/80">
                    <td className="px-4 py-3">
                      <div className="font-code text-[11px] font-semibold">{rec.id}</div>
                      <div className="font-code text-[10px] text-[#0E6B8A]">{rec.publishedVersion}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{rec.province}</div>
                      <div className="text-[11px] text-[#3F6064]">
                        {rec.disaggregations.length} reconciled district strata
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-code text-[11px] font-semibold text-[#0B7A5C]">
                        {rec.indicatorCode}
                      </div>
                      <div className="text-[11px] text-[#3F6064]">{rec.unitLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-code text-[11px]">
                      {rec.numerator.toLocaleString()} / {rec.denominator.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-code text-xs font-semibold ${
                          rate >= rec.targetRate ? 'text-[#0E6B8A]' : 'text-[#0B7A5C]'
                        }`}
                      >
                        {rate}%
                      </span>
                      <span className="ml-1 font-code text-[10px] text-[#3F6064]">
                        (Tgt {rec.targetRate}%)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#0E6B8A]/12 px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#0E6B8A]">
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
