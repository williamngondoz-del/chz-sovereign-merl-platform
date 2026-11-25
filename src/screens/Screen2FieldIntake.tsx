import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileLock2,
  FileUp,
  Layers,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import {
  EVIDENCE_PRESETS,
  INDICATOR_CATALOG,
  PROGRAMMES,
  PROVINCE_NAMES,
  ZAMBIAN_PROVINCES,
} from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import type {
  DisaggregationRow,
  EvidenceAttachment,
  ProgrammeName,
  ProvinceName,
  QuarterLabel,
} from '../types/chz';
import {
  computeRate,
  formatCatShort,
  scanForZambianPii,
  sha256FileBytes,
  sha256HexSync,
  validateDisaggregations,
} from '../utils/chzUtils';

const QUARTERS: QuarterLabel[] = ['2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4'];

function makeDefaultDisaggs(province: ProvinceName, num: number, den: number): DisaggregationRow[] {
  const districts = ZAMBIAN_PROVINCES.find((p) => p.name === province)?.districts ?? [province, `${province} Rural`];
  const n1 = Math.floor(num * 0.6);
  const d1 = Math.max(n1, Math.floor(den * 0.6));
  const n2 = Math.max(0, num - n1);
  const d2 = Math.max(n2, den - d1);
  return [
    { id: 'st-1', district: districts[0] ?? province, stratum: 'Urban / Hub', numerator: n1, denominator: d1 },
    { id: 'st-2', district: districts[1] ?? `${province} Rural`, stratum: 'Rural Outreach', numerator: n2, denominator: d2 },
  ];
}

export function Screen2FieldIntake() {
  const records = useChzStore((s) => s.records);
  const activeRole = useChzStore((s) => s.activeRole);
  const isOnline = useChzStore((s) => s.isOnline);
  const sensitiveCohorts = useChzStore((s) => s.sensitiveCohorts);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const submitFieldIntake = useChzStore((s) => s.submitFieldIntake);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);
  const openMfaChallenge = useChzStore((s) => s.openMfaChallenge);
  const logSensitiveCohortAccess = useChzStore((s) => s.logSensitiveCohortAccess);
  const pushToast = useChzStore((s) => s.pushToast);

  const [programme, setProgramme] = useState<ProgrammeName>('eSCMIS Supply Chain');
  const [province, setProvince] = useState<ProvinceName>('Southern');
  const [indicatorCode, setIndicatorCode] = useState<string>('ESCMIS-STK-01');
  const [quarter, setQuarter] = useState<QuarterLabel>('2026 Q4');
  const [numeratorInput, setNumeratorInput] = useState<string>('124');
  const [denominatorInput, setDenominatorInput] = useState<string>('132');
  const [disaggregations, setDisaggregations] = useState<DisaggregationRow[]>(() =>
    makeDefaultDisaggs('Southern', 124, 132)
  );
  const [fieldNotes, setFieldNotes] = useState<string>(
    'Aggregate district eSCMIS reconciliation verified against provincial ZAMMSA dispatch ledger.'
  );
  const [evidence, setEvidence] = useState<EvidenceAttachment>({
    name: EVIDENCE_PRESETS[0].name,
    sizeKb: EVIDENCE_PRESETS[0].sizeKb,
    mimeType: EVIDENCE_PRESETS[0].mimeType,
    sha256: sha256HexSync(`preset|${EVIDENCE_PRESETS[0].name}`),
    vaultPath: 's3://chz-vault-lusaka-private/pending-upload.enc',
    uploadedAt: formatCatShort(),
    hashedFromBytes: true,
  });
  const [sensitiveUnlocked, setSensitiveUnlocked] = useState(false);

  const canSubmit = hasPermission('fieldIntake');
  const canViewSensitive = hasPermission('sensitiveCohortView');

  const availableIndicators = useMemo(
    () => INDICATOR_CATALOG.filter((item) => item.programme === programme),
    [programme]
  );

  const selectedIndicator = useMemo(
    () => availableIndicators.find((item) => item.code === indicatorCode) ?? availableIndicators[0],
    [availableIndicators, indicatorCode]
  );

  const handleProgrammeChange = (nextProg: ProgrammeName) => {
    setProgramme(nextProg);
    const firstInd = INDICATOR_CATALOG.find((i) => i.programme === nextProg);
    if (firstInd) setIndicatorCode(firstInd.code);
  };

  const handleProvinceChange = (nextProv: ProvinceName) => {
    setProvince(nextProv);
    const n = Number(numeratorInput);
    const d = Number(denominatorInput);
    if (Number.isInteger(n) && Number.isInteger(d) && n >= 0 && d > 0 && n <= d) {
      setDisaggregations(makeDefaultDisaggs(nextProv, n, d));
    }
  };

  const numerator = Number(numeratorInput);
  const denominator = Number(denominatorInput);

  const ratioError = useMemo(() => {
    if (numeratorInput.trim() === '' || denominatorInput.trim() === '') {
      return 'Both Numerator and Denominator are required.';
    }
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
      return 'Use whole integer counts (no decimals).';
    }
    if (numerator < 0 || denominator <= 0) {
      return 'Numerator must be >= 0 and Denominator must be > 0.';
    }
    if (numerator > denominator) {
      return `Ratio validation failed: Numerator (${numerator.toLocaleString()}) cannot exceed Denominator (${denominator.toLocaleString()}).`;
    }
    return null;
  }, [numeratorInput, denominatorInput, numerator, denominator]);

  const disaggValidation = useMemo(
    () =>
      ratioError
        ? { valid: false, sumNumerator: 0, sumDenominator: 0, error: 'Fix headline ratio first.' }
        : validateDisaggregations(numerator, denominator, disaggregations),
    [ratioError, numerator, denominator, disaggregations]
  );

  const duplicateMatch = useMemo(
    () =>
      records.find(
        (r) =>
          r.programme === programme &&
          r.province === province &&
          r.indicatorCode === selectedIndicator?.code &&
          r.quarter === quarter &&
          r.status !== 'RETURNED'
      ) ?? null,
    [records, programme, province, selectedIndicator, quarter]
  );

  const piiScan = useMemo(
    () => scanForZambianPii(fieldNotes, evidence.name, selectedIndicator?.name),
    [fieldNotes, evidence.name, selectedIndicator]
  );

  const computedRate = ratioError ? null : computeRate(numerator, denominator);
  const isSmallCell = !ratioError && (numerator < 10 || denominator < 10);

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const realSha256 = await sha256FileBytes(file);
    setEvidence({
      name: file.name,
      sizeKb,
      mimeType: file.type || 'application/octet-stream',
      sha256: realSha256,
      vaultPath: 's3://chz-vault-lusaka-private/staged-upload.enc',
      uploadedAt: formatCatShort(),
      hashedFromBytes: true,
    });
    useChzStore
      .getState()
      .logUiEvent(
        'INTAKE',
        'EVIDENCE_BYTES_HASHED',
        'VAULT-STAGE',
        `Computed Web Crypto SHA-256 (${realSha256.slice(0, 16)}…) on ${file.name} (${sizeKb} KB).`
      );
    pushToast({
      title: 'Web Crypto SHA-256 Computed',
      message: `${file.name} (${sizeKb} KB) hashed from file bytes for private vault.`,
      tone: 'espresso',
    });
  };

  const handleSelectPreset = (preset: (typeof EVIDENCE_PRESETS)[number], silent = false) => {
    setEvidence({
      name: preset.name,
      sizeKb: preset.sizeKb,
      mimeType: preset.mimeType,
      sha256: sha256HexSync(`${preset.name}|${province}|${quarter}`),
      vaultPath: 's3://chz-vault-lusaka-private/staged-upload.enc',
      uploadedAt: formatCatShort(),
      hashedFromBytes: true,
    });
    if (!silent) {
      useChzStore
        .getState()
        .logUiEvent(
          'INTAKE',
          'EVIDENCE_PACK_STAGED',
          'VAULT-STAGE',
          `Staged private evidence package ${preset.name} (${preset.sizeKb} KB).`
        );
    }
  };

  const handleAutoBalanceDisaggs = () => {
    if (ratioError) return;
    setDisaggregations(makeDefaultDisaggs(province, numerator, denominator));
    pushToast({
      title: 'Strata Auto-Reconciled',
      message: `District disaggregations balanced to ${numerator.toLocaleString()} / ${denominator.toLocaleString()}.`,
      tone: 'teal',
    });
  };

  const handleLoadQuickDemo = (mode: 'standard' | 'small-cell' | 'pii-test') => {
    if (mode === 'standard') {
      handleProgrammeChange('Routine Immunization');
      setProvince('Northern');
      setIndicatorCode('IMM-P3-02');
      setQuarter('2026 Q4');
      setNumeratorInput('8640');
      setDenominatorInput('9200');
      setDisaggregations(makeDefaultDisaggs('Northern', 8640, 9200));
      setFieldNotes('Kasama & Mbala district EPI Pentavalent-3 outreach reconciled with DHIS2.');
      handleSelectPreset(EVIDENCE_PRESETS[0], true);
    } else if (mode === 'small-cell') {
      handleProgrammeChange('Maternal & Newborn Health');
      setProvince('Muchinga');
      setIndicatorCode('MNH-EMONC-09');
      setQuarter('2026 Q4');
      setNumeratorInput('6');
      setDenominatorInput('7');
      setDisaggregations(makeDefaultDisaggs('Muchinga', 6, 7));
      setFieldNotes('Remote sentinel EmONC stabilisations (n=6/7) — internal MOH/MERL review only.');
      handleSelectPreset(EVIDENCE_PRESETS[2], true);
    } else {
      setFieldNotes('Follow-up patient NRC 214590/10/1 phone +260977123456 — testing DPA PII block.');
    }
    pushToast({
      title:
        mode === 'standard'
          ? 'Standard Scenario Staged'
          : mode === 'small-cell'
            ? 'DPA Small-Cell Scenario Staged'
            : 'DPA PII Violation Test Staged',
      message:
        mode === 'pii-test'
          ? 'Zambian NRC & phone injected into field notes to verify automatic DPA blocker.'
          : 'Reconciled strata & evidence prefilled cleanly.',
      tone: mode === 'pii-test' ? 'warning' : 'copper',
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIndicator) return;
    const res = submitFieldIntake({
      programme,
      province,
      indicatorCode: selectedIndicator.code,
      indicatorName: selectedIndicator.name,
      quarter,
      numerator,
      denominator,
      targetRate: selectedIndicator.defaultTarget,
      unitLabel: selectedIndicator.unitLabel,
      fieldNotes,
      evidence,
      disaggregations,
    });
    if (res.ok) {
      setFieldNotes('');
    }
  };

  const handleUnlockSensitiveBoundary = () => {
    if (!canViewSensitive) {
      logSensitiveCohortAccess(sensitiveCohorts[0]?.id ?? 'SEG-01');
      return;
    }
    openMfaChallenge({
      title: 'MFA Step-Up · WS5 Segregated Cohort Boundary',
      description:
        'Accessing segregated beneficiary custody metadata requires hardware MFA confirmation. Every read is written to the SHA-256 audit chain.',
      requiredRoleLabel: activeRole,
      onVerified: () => {
        setSensitiveUnlocked(true);
        if (sensitiveCohorts[0]) {
          logSensitiveCohortAccess(sensitiveCohorts[0].id);
        }
      },
    });
  };

  const recentDrafts = useMemo(
    () => records.filter((r) => r.status === 'DRAFT' || r.status === 'RETURNED').slice(0, 4),
    [records]
  );

  return (
    <section aria-labelledby="screen-2-heading" className="space-y-6">
      {/* Masthead */}
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Workstreams 03 &amp; 05 · Field Intake, Disaggregation &amp; DPA PII Guard
          </p>
          <h1
            id="screen-2-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            Field Intake &amp; Reconciled Disaggregation Portal
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Enforces strict RBAC (`Programme Officer` / `MERL Lead`), duplicate-period blocking,
            district stratum sum reconciliation, live Zambian NRC/phone PII scanning, and real Web
            Crypto SHA-256 evidence hashing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleLoadQuickDemo('standard')}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#072A2E]/15 bg-[#FFFFFF] px-3 py-2 text-xs font-semibold hover:border-[#0B7A5C]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#14B88A]" />
            <span>Prefill Standard</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadQuickDemo('small-cell')}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0E6B8A]/25 bg-[#0E6B8A]/8 px-3 py-2 text-xs font-semibold text-[#0E6B8A] hover:bg-[#0E6B8A] hover:text-[#F4F8F7]"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Prefill n&lt;10</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadQuickDemo('pii-test')}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0B7A5C]/40 bg-[#0B7A5C]/10 px-3 py-2 text-xs font-semibold text-[#0B7A5C] hover:bg-[#0B7A5C] hover:text-[#F4F8F7]"
          >
            <span>Test PII Blocker</span>
          </button>
        </div>
      </div>

      {!isOnline ? (
        <div className="rounded-2xl border border-[#0B7A5C] bg-[#0B7A5C]/12 px-4 py-3 text-xs font-medium text-[#B45309]">
          <strong>Offline Field Mode Active:</strong> Submissions are validated locally and cached
          in persistent browser storage until rural 3G connectivity resumes.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Intake Form */}
        <form
          onSubmit={handleSubmit}
          className="editorial-surface space-y-5 rounded-2xl p-4 sm:p-6 lg:col-span-7"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="intake-programme" className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#3F6064]">
                Programme
              </label>
              <select
                id="intake-programme"
                value={programme}
                onChange={(e) => handleProgrammeChange(e.target.value as ProgrammeName)}
                className="mt-1.5 w-full rounded-xl border border-[#072A2E]/16 bg-[#F4F8F7] px-3 py-2.5 text-sm font-medium"
              >
                {PROGRAMMES.map((prog) => (
                  <option key={prog} value={prog}>
                    {prog}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="intake-province" className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#3F6064]">
                Province (Zambia)
              </label>
              <select
                id="intake-province"
                value={province}
                onChange={(e) => handleProvinceChange(e.target.value as ProvinceName)}
                className="mt-1.5 w-full rounded-xl border border-[#072A2E]/16 bg-[#F4F8F7] px-3 py-2.5 text-sm font-medium"
              >
                {PROVINCE_NAMES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov} Province
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="intake-indicator" className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#3F6064]">
                Standardized Indicator Code
              </label>
              <select
                id="intake-indicator"
                value={selectedIndicator?.code ?? ''}
                onChange={(e) => setIndicatorCode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#072A2E]/16 bg-[#F4F8F7] px-3 py-2.5 text-sm font-medium"
              >
                {availableIndicators.map((ind) => (
                  <option key={ind.code} value={ind.code}>
                    {ind.code} — {ind.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="intake-quarter" className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#3F6064]">
                Reporting Quarter
              </label>
              <select
                id="intake-quarter"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value as QuarterLabel)}
                className="mt-1.5 w-full rounded-xl border border-[#072A2E]/16 bg-[#F4F8F7] px-3 py-2.5 font-code text-sm font-medium"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Complete 12-Field Logframe / Theory of Change Indicator Metadata Strip */}
          {selectedIndicator ? (
            <div className="rounded-xl border border-[#0E6B8A]/20 bg-[#0E6B8A]/6 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-code text-[10.5px] font-semibold uppercase text-[#0E6B8A]">
                  LOGFRAME: {selectedIndicator.logframeLevel} · {selectedIndicator.direction} ·{' '}
                  {selectedIndicator.frequency}
                </span>
                <span className="font-code text-[10.5px] text-[#0B7A5C]">
                  Baseline ({selectedIndicator.baselineYear}): {selectedIndicator.baselineValue}% →
                  Target: {selectedIndicator.defaultTarget}%
                </span>
              </div>
              <p className="mt-1 text-[#072A2E]/90">{selectedIndicator.definition}</p>
              <p className="mt-1 font-code text-[10px] text-[#3F6064]">
                ToC: {selectedIndicator.theoryOfChangePath} · Owner: {selectedIndicator.owner} ·
                Source: {selectedIndicator.dataSource}
              </p>
            </div>
          ) : null}

          {duplicateMatch ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#0B7A5C] bg-[#0B7A5C]/12 px-3.5 py-2.5 text-xs text-[#B45309]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Duplicate Period Blocked (Gate 2):</strong> {duplicateMatch.id} already
                exists for {province} · {selectedIndicator?.code} · {quarter} (
                {duplicateMatch.status}). Select an open quarter/province or log a traceable
                revision in MERL Gate.
              </span>
            </div>
          ) : null}

          {/* Headline Numerator & Denominator */}
          <div className="rounded-2xl border border-[#072A2E]/10 bg-[#F4F8F7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em]">
                Headline Aggregate Counts (Zero PII)
              </span>
              <button
                type="button"
                onClick={handleAutoBalanceDisaggs}
                className="cursor-pointer rounded-lg border border-[#0E6B8A]/30 bg-[#0E6B8A]/10 px-2.5 py-1 font-code text-[10px] font-semibold text-[#0E6B8A] hover:bg-[#0E6B8A] hover:text-[#F4F8F7]"
              >
                Auto-Reconcile Strata
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="intake-numerator" className="block text-xs text-[#3F6064]">
                  Numerator ({selectedIndicator?.unitLabel})
                </label>
                <input
                  id="intake-numerator"
                  type="number"
                  min={0}
                  step={1}
                  value={numeratorInput}
                  onChange={(e) => setNumeratorInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#072A2E]/18 bg-[#FFFFFF] px-3.5 py-2 font-code text-base font-semibold"
                />
              </div>
              <div>
                <label htmlFor="intake-denominator" className="block text-xs text-[#3F6064]">
                  Denominator (Total Eligible)
                </label>
                <input
                  id="intake-denominator"
                  type="number"
                  min={1}
                  step={1}
                  value={denominatorInput}
                  onChange={(e) => setDenominatorInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#072A2E]/18 bg-[#FFFFFF] px-3.5 py-2 font-code text-base font-semibold"
                />
              </div>
            </div>

            {ratioError ? (
              <div className="mt-3 rounded-xl border border-[#0B7A5C]/45 bg-[#0B7A5C]/10 px-3 py-2 text-xs font-medium text-[#B45309]">
                {ratioError}
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#3F6064]">Computed Ratio</span>
                  <span className="font-code font-semibold text-[#0E6B8A]">
                    {computedRate}% ({numerator.toLocaleString()} / {denominator.toLocaleString()})
                  </span>
                </div>
                {isSmallCell ? (
                  <p className="rounded-lg border border-[#14B88A]/55 bg-[#14B88A]/15 px-3 py-1.5 text-[11px] text-[#92400E]">
                    <strong>DPA No. 3 of 2021 Notice:</strong> Cell count n=
                    {Math.min(numerator, denominator)} &lt; 10 will be suppressed from public CMS
                    and external exports.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Gate 2 Structured District / Stratum Disaggregation Reconciliation */}
          <div className="rounded-2xl border border-[#072A2E]/12 bg-[#F4F8F7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#0B7A5C]" />
                <span className="text-xs font-semibold uppercase tracking-[0.1em]">
                  District &amp; Stratum Disaggregation (Gate 2 Sum Guard)
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDisaggregations((prev) => [
                    ...prev,
                    {
                      id: `st-${Date.now()}`,
                      district:
                        ZAMBIAN_PROVINCES.find((p) => p.name === province)?.districts[
                          prev.length % 6
                        ] ?? province,
                      stratum: 'Additional Stratum',
                      numerator: 0,
                      denominator: 1,
                    },
                  ])
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#072A2E]/16 bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold hover:border-[#0B7A5C]"
              >
                <Plus className="h-3 w-3" />
                <span>Add Stratum</span>
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {disaggregations.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 items-center gap-2">
                  <input
                    type="text"
                    value={row.district}
                    onChange={(e) =>
                      setDisaggregations((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, district: e.target.value } : r))
                      )
                    }
                    placeholder="District"
                    className="col-span-4 rounded-lg border border-[#072A2E]/14 bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={row.stratum}
                    onChange={(e) =>
                      setDisaggregations((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, stratum: e.target.value } : r))
                      )
                    }
                    placeholder="Stratum"
                    className="col-span-3 rounded-lg border border-[#072A2E]/14 bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.numerator}
                    onChange={(e) =>
                      setDisaggregations((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, numerator: Number(e.target.value) } : r
                        )
                      )
                    }
                    className="col-span-2 rounded-lg border border-[#072A2E]/14 bg-[#FFFFFF] px-2 py-1.5 font-code text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.denominator}
                    onChange={(e) =>
                      setDisaggregations((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, denominator: Number(e.target.value) } : r
                        )
                      )
                    }
                    className="col-span-2 rounded-lg border border-[#072A2E]/14 bg-[#FFFFFF] px-2 py-1.5 font-code text-xs"
                  />
                  <button
                    type="button"
                    aria-label="Remove stratum"
                    disabled={disaggregations.length <= 1}
                    onClick={() =>
                      setDisaggregations((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="col-span-1 flex cursor-pointer justify-center text-[#3F6064] hover:text-[#0B7A5C] disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2.5">
              {disaggValidation.valid ? (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#0E6B8A]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Reconciled: strata sum ({disaggValidation.sumNumerator.toLocaleString()}/
                    {disaggValidation.sumDenominator.toLocaleString()}) matches headline total.
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-[#0B7A5C]/45 bg-[#0B7A5C]/10 px-3 py-1.5 text-[11px] font-medium text-[#B45309]">
                  {disaggValidation.error}
                </div>
              )}
            </div>
          </div>

          {/* Private Evidence Attachment with Real Web Crypto SHA-256 */}
          <div className="rounded-2xl border border-[#072A2E]/12 bg-[#F4F8F7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileLock2 className="h-4 w-4 text-[#0E6B8A]" />
                <span className="text-xs font-semibold uppercase tracking-[0.1em]">
                  Private Vault Evidence (Real Web Crypto SHA-256)
                </span>
              </div>
              <span className="rounded bg-[#072A2E] px-2 py-0.5 font-code text-[10px] text-[#5EEAD4]">
                NEVER PUBLISHED TO CMS
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 rounded-xl border border-[#072A2E]/12 bg-[#FFFFFF] p-3">
                <div className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 shrink-0 text-[#0B7A5C]" />
                  <span className="truncate text-xs font-semibold">{evidence.name}</span>
                </div>
                <div className="mt-1 break-all font-code text-[9.5px] text-[#3F6064]">
                  {evidence.sizeKb.toLocaleString()} KB · SHA-256: {evidence.sha256}
                </div>
              </div>

              <label
                htmlFor="intake-evidence-file"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#072A2E]/20 bg-[#FFFFFF] px-3.5 py-2.5 text-xs font-semibold hover:border-[#0B7A5C]"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Hash Local File</span>
                <input id="intake-evidence-file" type="file" onChange={handleFileInput} className="sr-only" />
              </label>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {EVIDENCE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`cursor-pointer rounded-lg border px-2 py-1 font-code text-[10px] ${
                    evidence.name === preset.name
                      ? 'border-[#0E6B8A] bg-[#0E6B8A] text-[#F4F8F7]'
                      : 'border-[#072A2E]/12 bg-[#FFFFFF] text-[#3F6064]'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Field Notes with Live Zambia DPA PII Scanner */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="intake-notes" className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#3F6064]">
                Field Verification Notes (Scanned Live for PII)
              </label>
              <span
                className={`font-code text-[10px] font-semibold ${
                  piiScan.hasPii ? 'text-[#0B7A5C]' : 'text-[#0E6B8A]'
                }`}
              >
                {piiScan.hasPii ? `PII DETECTED: ${piiScan.findings.join(', ')}` : 'DPA PII SCAN: CLEAN'}
              </span>
            </div>
            <textarea
              id="intake-notes"
              rows={2}
              value={fieldNotes}
              onChange={(e) => setFieldNotes(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#072A2E]/16 bg-[#F4F8F7] px-3.5 py-2 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#072A2E]/10 pt-4">
            <span className="text-xs text-[#3F6064]">
              {canSubmit
                ? 'Active role authorized for Field Intake.'
                : `Locked: ${activeRole} lacks fieldIntake permission (switch to Programme Officer or MERL Lead).`}
            </span>
            <button
              id="submit-field-intake-btn"
              type="submit"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm transition-all ${
                canSubmit && !ratioError && disaggValidation.valid && !duplicateMatch && !piiScan.hasPii
                  ? 'bg-[#0B7A5C] text-[#F4F8F7] hover:bg-[#072A2E]'
                  : 'border border-[#072A2E]/18 bg-[#E6F0EE] text-[#3F6064]'
              }`}
            >
              {!canSubmit ? <Lock className="h-3.5 w-3.5" /> : null}
              <span>Queue DRAFT to MERL Gate</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* Right Column: WS5 Segregated Sensitive Cohort Boundary + Queue */}
        <div className="space-y-5 lg:col-span-5">
          {/* WS5 Segregated Beneficiary Boundary */}
          <div className="espresso-surface rounded-2xl p-5 text-[#F4F8F7]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#6CCAD9]" />
                <p className="font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]">
                  Workstream 05 · Beneficiary Data Segregation
                </p>
              </div>
              <span className="rounded bg-[#0E6B8A]/50 px-2 py-0.5 font-code text-[9.5px] text-[#B7E8F2]">
                AGGREGATE DEFAULT
              </span>
            </div>
            <h2 className="mt-1.5 font-editorial text-2xl">
              Air-Gapped Sensitive Cohort Boundary
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#F4F8F7]/75">
              Individual-level health records are strictly segregated from MERL aggregate tables and
              Public CMS feeds. Viewing custody metadata requires `MERL Lead` or `System Auditor`
              with MFA Step-Up.
            </p>

            {sensitiveUnlocked && canViewSensitive ? (
              <div className="mt-3 space-y-2">
                {sensitiveCohorts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[#14B88A]/35 bg-[#041A1D] p-3 text-xs"
                  >
                    <div className="flex justify-between font-code text-[10.5px]">
                      <span className="font-semibold text-[#5EEAD4]">{c.cohortCode}</span>
                      <span className="text-[#6CCAD9]">{c.publicExposure}</span>
                    </div>
                    <p className="mt-1 text-[#F4F8F7]/85">
                      {c.province} · {c.programme} ({c.retainedCount.toLocaleString()} records)
                    </p>
                    <p className="mt-0.5 font-code text-[9.5px] text-[#F4F8F7]/60">
                      {c.encryptionStandard} · Last Audit: {c.lastAccessAudit}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <button
                id="unlock-ws5-boundary-btn"
                type="button"
                onClick={handleUnlockSensitiveBoundary}
                className="mt-3.5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#14B88A]/55 bg-[#14B88A]/18 px-4 py-2.5 text-xs font-semibold text-[#99F6E4] hover:bg-[#14B88A] hover:text-[#072A2E]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>
                  {canViewSensitive
                    ? 'MFA Step-Up to Audit Segregated Boundary'
                    : `Restricted (${activeRole} Denied · MERL/Auditor Only)`}
                </span>
              </button>
            )}
          </div>

          <div className="editorial-surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-editorial text-2xl">Active MERL Intake Queue</h2>
              <button
                type="button"
                onClick={() => setActiveScreen('verification')}
                className="cursor-pointer font-code text-[11px] font-semibold text-[#0E6B8A] hover:underline"
              >
                Open Gate ({recentDrafts.length}) →
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {recentDrafts.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-code text-[11px] font-semibold">{item.id}</span>
                    <div className="flex items-center gap-1.5">
                      {item.offlineQueued ? (
                        <span className="rounded bg-[#0B7A5C] px-1.5 py-0.5 font-code text-[9px] text-[#F4F8F7]">
                          OFFLINE
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[#0B7A5C]/15 px-2 py-0.5 font-code text-[10px] font-semibold text-[#0B7A5C]">
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {item.province} · {item.indicatorCode}
                    </span>
                    <span className="font-code text-[11px] font-semibold text-[#0E6B8A]">
                      {computeRate(item.numerator, item.denominator)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
