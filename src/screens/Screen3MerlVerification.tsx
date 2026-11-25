import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileLock2,
  History,
  Lock,
  PencilLine,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useChzStore } from '../store/useChzStore';
import type { MerlRecord, RecordStatus } from '../types/chz';
import { computeRate } from '../utils/chzUtils';

type FilterTab = 'ALL' | 'PENDING' | 'LOCKED' | 'PUBLISHED';
const PAGE_SIZE = 10;

export function Screen3MerlVerification() {
  const records = useChzStore((s) => s.records);
  const activeRole = useChzStore((s) => s.activeRole);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const openMfaChallenge = useChzStore((s) => s.openMfaChallenge);
  const approveAndLockRecord = useChzStore((s) => s.approveAndLockRecord);
  const returnForRevision = useChzStore((s) => s.returnForRevision);
  const resubmitReturnedRecord = useChzStore((s) => s.resubmitReturnedRecord);
  const logTraceableRevision = useChzStore((s) => s.logTraceableRevision);
  const inspectEvidenceVault = useChzStore((s) => s.inspectEvidenceVault);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revNumerator, setRevNumerator] = useState('');
  const [revDenominator, setRevDenominator] = useState('');
  const [revReason, setRevReason] = useState('');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const canApprove = hasPermission('merlApproveLock');
  const canReturn = hasPermission('merlReturnDraft');
  const canRevise = hasPermission('traceableRevision');
  const canResubmit = hasPermission('fieldIntake');

  const counts = useMemo(
    () => ({
      ALL: records.length,
      PENDING: records.filter((r) => r.status === 'DRAFT' || r.status === 'RETURNED').length,
      LOCKED: records.filter(
        (r) => r.status === 'LOCKED' || r.status === 'REVISION_PENDING_REPUBLISH'
      ).length,
      PUBLISHED: records.filter((r) => r.status === 'PUBLISHED').length,
    }),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const weight: Record<RecordStatus, number> = {
      DRAFT: 0,
      RETURNED: 1,
      REVISION_PENDING_REPUBLISH: 2,
      LOCKED: 3,
      PUBLISHED: 4,
    };
    return records
      .filter((r) => {
        if (activeTab === 'PENDING') return r.status === 'DRAFT' || r.status === 'RETURNED';
        if (activeTab === 'LOCKED')
          return r.status === 'LOCKED' || r.status === 'REVISION_PENDING_REPUBLISH';
        if (activeTab === 'PUBLISHED') return r.status === 'PUBLISHED';
        return true;
      })
      .filter(
        (r) =>
          !q ||
          `${r.id} ${r.province} ${r.programme} ${r.indicatorCode} ${r.indicatorName}`
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => weight[a.status] - weight[b.status]);
  }, [records, activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const triggerApproveWithMfa = (rec: MerlRecord) => {
    if (!canApprove) {
      approveAndLockRecord(rec.id); // logs ACCESS_DENIED cleanly
      return;
    }
    openMfaChallenge({
      title: `MFA Step-Up · Approve & Lock ${rec.id}`,
      description: `Period-locking ${rec.province} ${rec.indicatorCode} (${rec.numerator.toLocaleString()}/${rec.denominator.toLocaleString()}) makes this period immutable and unlocks Public CMS eligibility.`,
      requiredRoleLabel: 'MERL Lead',
      onVerified: () => approveAndLockRecord(rec.id),
    });
  };

  const openReturnDrawer = (record: MerlRecord) => {
    if (!canReturn) {
      returnForRevision(record.id, 'RBAC check');
      return;
    }
    setRevisingId(null);
    setReturningId(record.id);
    setReturnReason('Please reconcile district denominator against provincial DHIS2 extract.');
  };

  const openRevisionDrawer = (record: MerlRecord) => {
    if (!canRevise) {
      logTraceableRevision(record.id, record.numerator, record.denominator, 'RBAC check');
      return;
    }
    setReturningId(null);
    setRevisingId(record.id);
    setRevNumerator(String(record.numerator));
    setRevDenominator(String(record.denominator));
    setRevReason('Post-audit reconciliation with signed Provincial Health Office tally sheet.');
  };

  const statusBadge = (status: RecordStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'border-[#0B7A5C]/40 bg-[#0B7A5C]/12 text-[#0B7A5C]';
      case 'RETURNED':
        return 'border-[#072A2E]/30 bg-[#072A2E]/10 text-[#072A2E]';
      case 'REVISION_PENDING_REPUBLISH':
        return 'border-[#0B7A5C] bg-[#0B7A5C] text-[#F4F8F7]';
      case 'LOCKED':
        return 'border-[#14B88A]/50 bg-[#14B88A]/20 text-[#085E47]';
      case 'PUBLISHED':
        return 'border-[#0E6B8A]/40 bg-[#0E6B8A]/12 text-[#0E6B8A]';
    }
  };

  return (
    <section aria-labelledby="screen-3-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Screen 04 · Immutable Period Locks &amp; Traceable Post-Lock Amendments
          </p>
          <h1
            id="screen-3-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            MERL Verification Gate
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Enforces strict least-privilege RBAC (`MERL Lead` only for locks &amp; revisions) and
            immutable period locks: once locked, records can never be reverted to Returned—only
            amended via version-bumped Traceable Revisions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveScreen('intake')}
            className="cursor-pointer rounded-xl border border-[#072A2E]/16 bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold hover:border-[#0B7A5C]"
          >
            + Queue Field Draft
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('cms')}
            className="cursor-pointer rounded-xl border border-[#0E6B8A]/30 bg-[#0E6B8A]/10 px-3.5 py-2 text-xs font-semibold text-[#0E6B8A] hover:bg-[#0E6B8A] hover:text-[#F4F8F7]"
          >
            Proceed to Public CMS →
          </button>
        </div>
      </div>

      {/* Filters + Search + Pagination */}
      <div className="editorial-surface flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'PENDING', label: 'Pending Review' },
              { key: 'LOCKED', label: 'Locked / Diff Pending' },
              { key: 'PUBLISHED', label: 'Published Live' },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7]'
                  : 'border-[#072A2E]/12 bg-[#F4F8F7] text-[#3F6064]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-code text-[10px] opacity-80">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#3F6064]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search ID, province..."
              className="w-full rounded-xl border border-[#072A2E]/14 bg-[#F4F8F7] py-1.5 pr-3 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer rounded-lg border border-[#072A2E]/15 p-1.5 disabled:opacity-35"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-code text-[10.5px]">
              {safePage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="cursor-pointer rounded-lg border border-[#072A2E]/15 p-1.5 disabled:opacity-35"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Queue Cards */}
      <div className="space-y-4">
        {pagedRecords.map((rec) => {
          const rate = computeRate(rec.numerator, rec.denominator);
          const isSmallCell = rec.numerator < 10 || rec.denominator < 10;
          const isDraft = rec.status === 'DRAFT';
          const isReturned = rec.status === 'RETURNED';
          const isLockedFamily = !isDraft && !isReturned;

          return (
            <article key={rec.id} id={`merl-card-${rec.id}`} className="editorial-surface rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-3 border-b border-[#072A2E]/8 pb-3.5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-code text-xs font-semibold">{rec.id}</span>
                    <span className="rounded bg-[#F4F8F7] px-2 py-0.5 font-code text-[10.5px] font-semibold text-[#0B7A5C] ring-1 ring-[#072A2E]/10">
                      {rec.indicatorCode} · {rec.publishedVersion}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 font-code text-[10px] font-semibold ${statusBadge(rec.status)}`}>
                      {rec.status}
                    </span>
                    {isSmallCell ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#0B7A5C]/40 bg-[#0B7A5C]/10 px-2 py-0.5 font-code text-[10px] font-semibold text-[#0B7A5C]">
                        <ShieldAlert className="h-3 w-3" />
                        DPA n&lt;10
                      </span>
                    ) : null}
                  </div>
                  <h2 className="font-editorial text-2xl leading-snug">
                    {rec.province} · {rec.programme}
                  </h2>
                  <p className="text-xs text-[#3F6064]">{rec.indicatorName}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] px-4 py-2.5">
                  <div>
                    <div className="font-code text-[10px] uppercase text-[#3F6064]">Achieved</div>
                    <div className="font-editorial text-3xl leading-none text-[#0E6B8A]">{rate}%</div>
                  </div>
                  <div className="h-9 w-px bg-[#072A2E]/12" />
                  <div className="font-code text-[11px]">
                    <div>
                      {rec.numerator.toLocaleString()} / {rec.denominator.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#3F6064]">
                      Tgt {rec.targetRate}% · {rec.disaggregations.length} strata
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-3 text-xs lg:grid-cols-12">
                <div className="space-y-1.5 lg:col-span-7">
                  <p>
                    <span className="font-semibold text-[#3F6064]">Field Notes: </span>
                    {rec.fieldNotes}
                  </p>
                  {rec.merlNotes ? (
                    <p className="rounded-lg border border-[#14B88A]/35 bg-[#F4F8F7] px-3 py-1.5">
                      <span className="font-semibold text-[#0B7A5C]">MERL Note: </span>
                      {rec.merlNotes}
                    </p>
                  ) : null}
                  <div className="font-code text-[10px] text-[#3F6064]">
                    Submitted by {rec.submittedBy} ({rec.submittedAt})
                    {rec.lockedBy ? ` · Locked by ${rec.lockedBy} (${rec.lockedAt})` : ''}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-2.5 lg:col-span-5 lg:items-end">
                  <button
                    type="button"
                    onClick={() => {
                      inspectEvidenceVault(rec.id);
                      setExpandedEvidenceId((prev) => (prev === rec.id ? null : rec.id));
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-[#072A2E]/14 bg-[#F4F8F7] px-3 py-1.5 hover:border-[#0E6B8A] lg:self-end"
                  >
                    <FileLock2 className="h-3.5 w-3.5 text-[#0E6B8A]" />
                    <span className="max-w-[200px] truncate font-code text-[10.5px]">
                      {rec.evidence.name}
                    </span>
                    <span className="font-code text-[10px] font-semibold text-[#0E6B8A]">
                      SHA-256
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    {isDraft ? (
                      <>
                        <button
                          id={`btn-approve-${rec.id}`}
                          type="button"
                          onClick={() => triggerApproveWithMfa(rec)}
                          title={canApprove ? 'Requires MFA Step-Up' : `Restricted: ${activeRole} cannot lock`}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                            canApprove
                              ? 'bg-[#0E6B8A] text-[#F4F8F7] hover:bg-[#072A2E]'
                              : 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                          }`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Approve &amp; Lock</span>
                        </button>
                        <button
                          id={`btn-return-${rec.id}`}
                          type="button"
                          onClick={() => openReturnDrawer(rec)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                            canReturn
                              ? 'border-[#072A2E]/18 bg-[#FFFFFF] text-[#072A2E] hover:border-[#0B7A5C]'
                              : 'border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                          }`}
                        >
                          {canReturn ? <RotateCcw className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                          <span>Return Draft</span>
                        </button>
                      </>
                    ) : null}

                    {isReturned ? (
                      <button
                        type="button"
                        onClick={() => resubmitReturnedRecord(rec.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                          canResubmit
                            ? 'border-[#0B7A5C]/40 bg-[#0B7A5C]/10 text-[#0B7A5C] hover:bg-[#0B7A5C] hover:text-[#F4F8F7]'
                            : 'border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                        }`}
                      >
                        {canResubmit ? <Send className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                        <span>Resubmit Draft</span>
                      </button>
                    ) : null}

                    {isLockedFamily ? (
                      <button
                        type="button"
                        onClick={() => setActiveScreen('cms')}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0E6B8A]/30 bg-[#0E6B8A]/8 px-3 py-2 text-xs font-semibold text-[#0E6B8A] hover:bg-[#0E6B8A] hover:text-[#F4F8F7]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>View in CMS</span>
                      </button>
                    ) : null}

                    <button
                      id={`btn-revise-${rec.id}`}
                      type="button"
                      onClick={() => openRevisionDrawer(rec)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        canRevise
                          ? 'border-[#14B88A]/55 bg-[#14B88A]/15 text-[#085E47] hover:bg-[#14B88A] hover:text-[#072A2E]'
                          : 'border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                      }`}
                    >
                      {canRevise ? <PencilLine className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                      <span>Log Traceable Revision</span>
                    </button>
                  </div>
                </div>
              </div>

              {expandedEvidenceId === rec.id ? (
                <div className="mt-3 rounded-xl border border-[#0E6B8A]/25 bg-[#0E6B8A]/6 p-3 font-code text-[10.5px]">
                  <div className="font-semibold text-[#0E6B8A]">
                    LUSAKA PRIVATE VAULT · {rec.evidence.sizeKb.toLocaleString()} KB · FIPS 180-4 SHA-256
                  </div>
                  <div className="mt-0.5 break-all text-[#3F6064]">URI: {rec.evidence.vaultPath}</div>
                  <div className="break-all text-[#3F6064]">SHA-256: {rec.evidence.sha256}</div>
                </div>
              ) : null}

              {returningId === rec.id ? (
                <div className="mt-3.5 rounded-xl border border-[#0B7A5C]/40 bg-[#F4F8F7] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0B7A5C]">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Return DRAFT {rec.id} for Clarification</span>
                  </div>
                  <textarea
                    rows={2}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#072A2E]/16 bg-[#FFFFFF] px-3 py-2 text-xs"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReturningId(null)}
                      className="cursor-pointer rounded-lg border border-[#072A2E]/16 px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = returnForRevision(rec.id, returnReason);
                        if (res.ok) setReturningId(null);
                      }}
                      className="cursor-pointer rounded-lg bg-[#0B7A5C] px-3.5 py-1.5 text-xs font-semibold text-[#F4F8F7]"
                    >
                      Confirm Return
                    </button>
                  </div>
                </div>
              ) : null}

              {revisingId === rec.id ? (
                <div className="mt-3.5 rounded-xl border border-[#14B88A]/60 bg-[#F4F8F7] p-4">
                  <div className="text-xs font-semibold">
                    Log Traceable Revision ({rec.publishedVersion} → next minor version)
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      value={revNumerator}
                      onChange={(e) => setRevNumerator(e.target.value)}
                      className="rounded-lg border border-[#072A2E]/18 bg-[#FFFFFF] px-3 py-1.5 font-code text-xs font-semibold"
                    />
                    <input
                      type="number"
                      min={1}
                      value={revDenominator}
                      onChange={(e) => setRevDenominator(e.target.value)}
                      className="rounded-lg border border-[#072A2E]/18 bg-[#FFFFFF] px-3 py-1.5 font-code text-xs font-semibold"
                    />
                  </div>
                  <input
                    type="text"
                    value={revReason}
                    onChange={(e) => setRevReason(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#072A2E]/18 bg-[#FFFFFF] px-3 py-1.5 text-xs"
                    placeholder="Mandatory audit justification (PII-scanned)..."
                  />
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRevisingId(null)}
                      className="cursor-pointer rounded-lg border border-[#072A2E]/16 px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = logTraceableRevision(
                          rec.id,
                          Number(revNumerator),
                          Number(revDenominator),
                          revReason
                        );
                        if (res.ok) setRevisingId(null);
                      }}
                      className="cursor-pointer rounded-lg bg-[#072A2E] px-3.5 py-1.5 text-xs font-semibold text-[#F4F8F7]"
                    >
                      Save Traceable Revision
                    </button>
                  </div>
                </div>
              ) : null}

              {rec.revisionHistory.length > 0 ? (
                <div className="mt-3 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7]/75 p-3">
                  <div className="flex items-center gap-1.5 font-code text-[10px] font-semibold uppercase text-[#3F6064]">
                    <History className="h-3 w-3 text-[#0B7A5C]" />
                    <span>Traceable Revision History ({rec.revisionHistory.length})</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {rec.revisionHistory.map((rev) => (
                      <li key={rev.id} className="flex flex-wrap justify-between gap-2 border-t border-[#072A2E]/6 pt-1 text-[11px]">
                        <span>
                          <strong className="font-code text-[#0B7A5C]">
                            {rev.previousVersion}→{rev.newVersion} ({rev.previousNumerator}/
                            {rev.previousDenominator} → {rev.newNumerator}/{rev.newDenominator})
                          </strong>{' '}
                          · {rev.reason}
                        </span>
                        <span className="font-code text-[10px] text-[#3F6064]">
                          {rev.actor} · {rev.timestamp}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
