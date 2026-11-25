import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  GitCompare,
  Globe,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';
import { useChzStore } from '../store/useChzStore';
import type { MerlRecord } from '../types/chz';
import { computeRate, evaluateDpaCompliance } from '../utils/chzUtils';

export function Screen4PublicCms() {
  const records = useChzStore((s) => s.records);
  const activeRole = useChzStore((s) => s.activeRole);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const openMfaChallenge = useChzStore((s) => s.openMfaChallenge);
  const togglePublishRecord = useChzStore((s) => s.togglePublishRecord);
  const logDpaSuppressionReview = useChzStore((s) => s.logDpaSuppressionReview);
  const logPublicFeedDownload = useChzStore((s) => s.logPublicFeedDownload);

  const canPublish = hasPermission('dpaCmsPublish');

  const merlApprovedRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          r.status === 'LOCKED' ||
          r.status === 'PUBLISHED' ||
          r.status === 'REVISION_PENDING_REPUBLISH'
      ),
    [records]
  );

  // Live website reflects publishedSnapshot (so REVISION_PENDING_REPUBLISH never silently changes live numbers!)
  const liveWebsiteItems = useMemo(
    () =>
      merlApprovedRecords
        .filter((r) => r.publishedSnapshot && (r.status === 'PUBLISHED' || r.status === 'REVISION_PENDING_REPUBLISH'))
        .map((r) => ({
          record: r,
          snap: r.publishedSnapshot!,
        })),
    [merlApprovedRecords]
  );

  const suppressedCount = useMemo(
    () => merlApprovedRecords.filter((r) => !evaluateDpaCompliance(r).passed).length,
    [merlApprovedRecords]
  );

  const buildPublicJson = () => ({
    schema: 'chz-public-factsheets-v1',
    publisher: 'Coalition Health Zambia (CHZ)',
    domain: 'https://coalitionhealth.org.zm/impact-factsheets',
    compliance: 'Zambia Data Protection Act No. 3 of 2021 (Aggregate Only, n >= 10, Zero PII)',
    factsheetsCount: liveWebsiteItems.length,
    factsheets: liveWebsiteItems.map(({ record, snap }) => ({
      id: record.id,
      version: snap.version,
      etag: snap.etag,
      quarter: record.quarter,
      province: record.province,
      programme: record.programme,
      indicatorCode: record.indicatorCode,
      indicatorName: record.indicatorName,
      aggregateNumerator: snap.numerator,
      aggregateDenominator: snap.denominator,
      achievedRatePercent: computeRate(snap.numerator, snap.denominator),
      targetRatePercent: record.targetRate,
      publishedAtCat: snap.publishedAt,
    })),
  });

  const handlePublicJson = (mode: 'copy' | 'download') => {
    const json = JSON.stringify(buildPublicJson(), null, 2);
    if (mode === 'copy') {
      navigator.clipboard?.writeText(json).catch(() => {});
    } else {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'factsheets-v1.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    logPublicFeedDownload(liveWebsiteItems.length, mode);
  };

  const handleToggleWithMfa = (rec: MerlRecord) => {
    if (!canPublish) {
      togglePublishRecord(rec.id); // logs ACCESS_DENIED
      return;
    }
    const isWithdrawing = rec.status === 'PUBLISHED';
    openMfaChallenge({
      title: isWithdrawing
        ? `MFA Step-Up · Withdraw ${rec.id} Instantly`
        : `MFA Step-Up · Publish ${rec.id} (${rec.publishedVersion})`,
      description: isWithdrawing
        ? `Immediately remove ${rec.province} ${rec.indicatorCode} from coalitionhealth.org.zm and purge ETag cache.`
        : `Publish DPA-verified ${rec.province} ${rec.indicatorCode} ${rec.publishedVersion} to coalitionhealth.org.zm.`,
      requiredRoleLabel: 'Comms & CMS Officer',
      onVerified: () => togglePublishRecord(rec.id),
    });
  };

  return (
    <section aria-labelledby="screen-4-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Workstream 06 · Versioned Public CMS &amp; Zambia DPA No. 3 of 2021 Gate
          </p>
          <h1
            id="screen-4-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            Controlled Public CMS Feed
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Enforces `Comms &amp; CMS Officer` RBAC + MFA Step-Up, semantic publication versions (
            <span className="font-code text-xs">v1.0 → v1.1</span>), pre-publish diff inspection for
            revised locked periods, automated PII + small-cell (`n &gt;= 10`) blocking, and instant
            withdrawal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 font-code text-[11px] font-semibold">
          <div className="rounded-xl border border-[#0E6B8A]/25 bg-[#0E6B8A]/8 px-3 py-2 text-[#0E6B8A]">
            LIVE FACTSHEETS: {liveWebsiteItems.length} / {merlApprovedRecords.length}
          </div>
          <div className="rounded-xl border border-[#0B7A5C]/30 bg-[#0B7A5C]/10 px-3 py-2 text-[#0B7A5C]">
            DPA HELD: {suppressedCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          {merlApprovedRecords.map((rec) => {
            const dpa = evaluateDpaCompliance(rec);
            const rate = computeRate(rec.numerator, rec.denominator);
            const isLiveUnchanged = rec.status === 'PUBLISHED';
            const isPendingDiff = rec.status === 'REVISION_PENDING_REPUBLISH';

            return (
              <article
                key={rec.id}
                id={`cms-card-${rec.id}`}
                className={`editorial-surface rounded-2xl p-4 sm:p-5 ${
                  !dpa.passed ? 'border-[#0B7A5C]/45 bg-[#FFFBEB]' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-code text-xs font-semibold">{rec.id}</span>
                      <span className="rounded bg-[#F4F8F7] px-2 py-0.5 font-code text-[10.5px] font-semibold text-[#0B7A5C] ring-1 ring-[#072A2E]/10">
                        {rec.indicatorCode} · {rec.publishedVersion}
                      </span>
                      {isLiveUnchanged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0E6B8A] px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#F4F8F7]">
                          <Globe className="h-2.5 w-2.5" />
                          LIVE {rec.publishedSnapshot?.version}
                        </span>
                      ) : isPendingDiff ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0B7A5C] px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#F4F8F7]">
                          <GitCompare className="h-2.5 w-2.5" />
                          DIFF PENDING REPUBLISH
                        </span>
                      ) : dpa.passed ? (
                        <span className="rounded-full bg-[#14B88A]/20 px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#085E47]">
                          READY ({rec.publishedVersion})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0B7A5C]/15 px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#0B7A5C]">
                          <ShieldAlert className="h-3 w-3" />
                          DPA BLOCKED
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-editorial text-2xl">
                      {rec.province} · {rec.programme}
                    </h2>
                    <p className="text-xs text-[#3F6064]">{rec.indicatorName}</p>
                  </div>

                  <div className="shrink-0 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] px-3.5 py-2 text-right">
                    <div className="font-editorial text-2xl leading-none text-[#0E6B8A]">{rate}%</div>
                    <div className="mt-0.5 font-code text-[10.5px]">
                      {rec.numerator.toLocaleString()} / {rec.denominator.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Pre-Publish Diff Inspector */}
                {isPendingDiff && rec.publishedSnapshot ? (
                  <div className="mt-3 rounded-xl border border-[#0B7A5C]/45 bg-[#0B7A5C]/8 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-code text-[10px] font-semibold uppercase text-[#0B7A5C]">
                      <GitCompare className="h-3.5 w-3.5" />
                      <span>Pre-Publish Revision Diff (Live Web Frozen Until Approved)</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-code text-[11px]">
                      <div className="rounded-lg border border-[#072A2E]/10 bg-[#FFFFFF] p-2">
                        <div className="text-[9.5px] text-[#3F6064]">
                          CURRENT LIVE ({rec.publishedSnapshot.version})
                        </div>
                        <div className="font-semibold">
                          {rec.publishedSnapshot.numerator.toLocaleString()} /{' '}
                          {rec.publishedSnapshot.denominator.toLocaleString()} (
                          {computeRate(
                            rec.publishedSnapshot.numerator,
                            rec.publishedSnapshot.denominator
                          )}
                          %)
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#0E6B8A]/30 bg-[#0E6B8A]/8 p-2">
                        <div className="text-[9.5px] text-[#0E6B8A]">
                          REVISED LOCKED ({rec.publishedVersion})
                        </div>
                        <div className="font-semibold text-[#0E6B8A]">
                          {rec.numerator.toLocaleString()} / {rec.denominator.toLocaleString()} (
                          {rate}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Automated DPA Checks */}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#072A2E]/8 pt-3 font-code text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium ${
                      dpa.smallCellPassed
                        ? 'border-[#0E6B8A]/25 bg-[#0E6B8A]/8 text-[#0E6B8A]'
                        : 'border-[#0B7A5C]/45 bg-[#0B7A5C]/12 text-[#B45309]'
                    }`}
                  >
                    {dpa.smallCellPassed ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <ShieldAlert className="h-3 w-3" />
                    )}
                    <span>
                      Small-Cell (n&gt;=10):{' '}
                      {dpa.smallCellPassed ? 'PASS' : `BLOCKED (n=${Math.min(rec.numerator, rec.denominator)})`}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium ${
                      dpa.zeroPiiPassed
                        ? 'border-[#0E6B8A]/25 bg-[#0E6B8A]/8 text-[#0E6B8A]'
                        : 'border-[#0B7A5C]/45 bg-[#0B7A5C]/12 text-[#B45309]'
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    <span>{dpa.zeroPiiPassed ? 'PII Scan: Clean' : 'PII Detected'}</span>
                  </span>
                  {rec.publishedSnapshot ? (
                    <span className="rounded-lg border border-[#072A2E]/12 bg-[#F4F8F7] px-2 py-1 text-[#3F6064]">
                      ETag: {rec.publishedSnapshot.etag}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11.5px] text-[#3F6064]">
                    {dpa.passed ? (
                      isLiveUnchanged ? (
                        <>
                          Published {rec.publishedAt} by <strong>{rec.publishedBy}</strong>.
                        </>
                      ) : isPendingDiff ? (
                        <>Review diff above and approve republishing {rec.publishedVersion}.</>
                      ) : (
                        <>Locked by {rec.lockedBy}. Ready for MFA-confirmed publication.</>
                      )
                    ) : (
                      <span className="font-medium text-[#B45309]">{dpa.reason}</span>
                    )}
                  </p>

                  {dpa.passed ? (
                    <button
                      id={`btn-cms-toggle-${rec.id}`}
                      type="button"
                      onClick={() => handleToggleWithMfa(rec)}
                      title={canPublish ? 'Requires MFA Step-Up' : `Restricted: ${activeRole} cannot publish`}
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
                        !canPublish
                          ? 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                          : isLiveUnchanged
                            ? 'border border-[#0B7A5C]/45 bg-[#0B7A5C]/10 text-[#0B7A5C] hover:bg-[#0B7A5C] hover:text-[#F4F8F7]'
                            : 'bg-[#0E6B8A] text-[#F4F8F7] hover:bg-[#072A2E]'
                      }`}
                    >
                      {!canPublish ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : isLiveUnchanged ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isLiveUnchanged
                          ? 'Withdraw Instantly'
                          : isPendingDiff
                            ? `Approve & Publish ${rec.publishedVersion}`
                            : `Publish ${rec.publishedVersion}`}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logDpaSuppressionReview(rec.id)}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#0B7A5C] bg-[#0B7A5C]/12 px-3.5 py-2 text-xs font-semibold text-[#B45309]"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Attest DPA Hold</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Live Embedded coalitionhealth.org.zm Preview Card */}
        <div className="xl:col-span-5">
          <div className="sticky top-5 overflow-hidden rounded-2xl border border-[#072A2E]/16 bg-[#FFFFFF] shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-[#14B88A]/25 bg-[#072A2E] px-3.5 py-2.5 text-[#F4F8F7]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0B7A5C]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#14B88A]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#0E6B8A]" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#F4F8F7]/14 bg-[#0B3A40] px-2.5 py-1 font-code text-[10px] text-[#F4F8F7]/85">
                <Lock className="h-3 w-3 shrink-0 text-[#6CCAD9]" />
                <span className="truncate">https://coalitionhealth.org.zm/impact-factsheets</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#14B88A]" />
            </div>

            <div className="bg-gradient-to-br from-[#0E6B8A] to-[#072A2E] p-5 text-[#F4F8F7]">
              <div className="flex items-center justify-between font-code text-[9.5px] uppercase tracking-wider">
                <span className="rounded border border-[#F4F8F7]/25 bg-[#F4F8F7]/10 px-2 py-0.5">
                  READ-ONLY PUBLIC CONTRACT
                </span>
                <span className="text-[#B6E6F0]">DPA NO. 3 OF 2021</span>
              </div>
              <h2 className="mt-2 font-editorial text-3xl leading-tight">
                Coalition Health Zambia — Verified National Impact
              </h2>
              <p className="mt-1 text-xs text-[#F4F8F7]/80">
                Displays frozen published snapshots only ({liveWebsiteItems.length} active
                factsheets). Withdrawals purge immediately.
              </p>
            </div>

            <div className="max-h-[420px] space-y-2.5 overflow-y-auto bg-[#F4F8F7] p-4">
              {liveWebsiteItems.map(({ record, snap }) => {
                const rt = computeRate(snap.numerator, snap.denominator);
                return (
                  <div key={record.id} className="rounded-xl border border-[#072A2E]/10 bg-[#FFFFFF] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-code text-[10px] text-[#0B7A5C] font-semibold">
                          {record.province.toUpperCase()} · {record.quarter} ·{' '}
                          <span className="text-[#0E6B8A]">
                            {record.indicatorCode} ({snap.version})
                          </span>
                        </div>
                        <h3 className="mt-0.5 text-xs font-semibold">{record.programme}</h3>
                        <p className="text-[11px] text-[#3F6064]">{record.indicatorName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-editorial text-2xl leading-none text-[#0E6B8A]">
                          {rt}%
                        </div>
                        <div className="font-code text-[9.5px] text-[#3F6064]">
                          Tgt {record.targetRate}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between font-code text-[9.5px] text-[#3F6064]">
                      <span>
                        AGG: {snap.numerator.toLocaleString()} / {snap.denominator.toLocaleString()}
                      </span>
                      <span className="text-[#0E6B8A]">{snap.etag}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#072A2E]/10 bg-[#FFFFFF] px-4 py-3">
              <button
                type="button"
                onClick={() => handlePublicJson('copy')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#072A2E]/18 bg-[#F4F8F7] px-3 py-1.5 text-[11px] font-semibold hover:border-[#0E6B8A]"
              >
                <Copy className="h-3 w-3" />
                <span>Copy JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handlePublicJson('download')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#072A2E] px-3 py-1.5 text-[11px] font-semibold text-[#F4F8F7] hover:bg-[#0E6B8A]"
              >
                <Download className="h-3 w-3" />
                <span>Download factsheets-v1.json</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
