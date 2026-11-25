import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Fingerprint,
  KeyRound,
  Lock,
  Minus,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
} from 'lucide-react';
import { type ChangeEvent, useMemo, useState } from 'react';
import { ROLE_PROFILES, SAMPLE_MIGRATION_CSV } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import type { AuditEvent, UserRole } from '../types/chz';
import { downloadAuditLedgerCsv } from '../utils/exportEngine';

type AuditFilter = 'ALL' | AuditEvent['category'];
const PAGE_SIZE = 10;

const ROLE_ORDER: UserRole[] = [
  'Executive Director',
  'Programme Officer',
  'MERL Lead',
  'Comms & CMS Officer',
  'System Auditor',
  'IT Admin',
];

export function Screen5GovernancePlan() {
  const auditLog = useChzStore((s) => s.auditLog);
  const activeRole = useChzStore((s) => s.activeRole);
  const timeline = useChzStore((s) => s.timeline);
  const selectedWeekId = useChzStore((s) => s.selectedWeekId);
  const lastMigrationReport = useChzStore((s) => s.lastMigrationReport);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const requestRoleSwitch = useChzStore((s) => s.requestRoleSwitch);
  const openMfaChallenge = useChzStore((s) => s.openMfaChallenge);
  const selectTimelineWeek = useChzStore((s) => s.selectTimelineWeek);
  const toggleTimelineSignOff = useChzStore((s) => s.toggleTimelineSignOff);
  const logAuditExport = useChzStore((s) => s.logAuditExport);
  const runAuditChainVerification = useChzStore((s) => s.runAuditChainVerification);
  const profileCsvMigration = useChzStore((s) => s.profileCsvMigration);
  const commitStagedMigration = useChzStore((s) => s.commitStagedMigration);
  const buildBackupSnapshot = useChzStore((s) => s.buildBackupSnapshot);
  const restoreBackupSnapshot = useChzStore((s) => s.restoreBackupSnapshot);
  const resetDemoData = useChzStore((s) => s.resetDemoData);

  const [auditFilter, setAuditFilter] = useState<AuditFilter>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [chainResult, setChainResult] = useState<string | null>(null);
  const [migrationCsv, setMigrationCsv] = useState<string>(SAMPLE_MIGRATION_CSV);
  const [backupJsonPreview, setBackupJsonPreview] = useState<string>('');

  const canExportAudit = hasPermission('auditLedgerExport');
  const canAdminBackup = hasPermission('systemAdminBackup');
  const canSignOff = hasPermission('timelineSignOff');

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLog.filter((evt) => {
      if (auditFilter !== 'ALL' && evt.category !== auditFilter) return false;
      if (!q) return true;
      return `${evt.actor} ${evt.role} ${evt.recordId} ${evt.action} ${evt.details}`
        .toLowerCase()
        .includes(q);
    });
  }, [auditLog, auditFilter, auditSearch]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAudit.length / PAGE_SIZE));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAudit = filteredAudit.slice((safeAuditPage - 1) * PAGE_SIZE, safeAuditPage * PAGE_SIZE);

  const selectedWeek = useMemo(
    () => timeline.find((w) => w.id === selectedWeekId) ?? timeline[0],
    [timeline, selectedWeekId]
  );

  const signedOffCount = useMemo(() => timeline.filter((w) => w.signedOff).length, [timeline]);
  const completionPct = Math.round((signedOffCount / timeline.length) * 100);

  const handleVerifyChain = () => {
    const res = runAuditChainVerification();
    setChainResult(
      res.valid
        ? `CHAIN VERIFIED (${res.verifiedCount}/${res.total} VALID SHA-256 LINKS)`
        : `TAMPER DETECTED (${res.brokenIds.join(', ')})`
    );
  };

  const handleExportAudit = () => {
    const perm = logAuditExport(filteredAudit.length);
    if (perm.ok) {
      downloadAuditLedgerCsv(filteredAudit);
    }
  };

  const handleDownloadBackup = () => {
    const snap = buildBackupSnapshot();
    if (!snap) return;
    const text = JSON.stringify(snap, null, 2);
    setBackupJsonPreview(text);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackupWithMfa = (jsonText: string) => {
    if (!canAdminBackup) {
      restoreBackupSnapshot(jsonText); // logs ACCESS_DENIED
      return;
    }
    openMfaChallenge({
      title: 'MFA Step-Up · Staging Backup Restore (Gate 3)',
      description:
        'Restoring a verified SHA-256 snapshot overwrites current workspace tables. Confirm IT Admin hardware MFA.',
      requiredRoleLabel: 'IT Admin',
      onVerified: () => restoreBackupSnapshot(jsonText),
    });
  };

  const handleBackupFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBackupJsonPreview(text);
    handleRestoreBackupWithMfa(text);
  };

  return (
    <section aria-labelledby="screen-5-heading" className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Screen 07 · VibeSec Audit Chain, 6-Role RBAC, Gate 3 Migration/Backup &amp; 8-Week Plan
          </p>
          <h1
            id="screen-5-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            Audit Trail, RBAC, Gate 3 Console &amp; Build Plan
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Verifiable FIPS 180-4 SHA-256 chained audit ledger, 6-role RBAC/MFA matrix including{' '}
            <strong>IT Admin</strong>, CSV Migration Profiler + SHA-256 Backup/Restore Console, and
            8-Week Build + 12-Week Warranty timeline.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            id="verify-audit-chain-btn"
            type="button"
            onClick={handleVerifyChain}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#0E6B8A] bg-[#0E6B8A] px-4 py-2.5 text-xs font-semibold text-[#F4F8F7] hover:bg-[#072A2E]"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verify SHA-256 Chain</span>
          </button>
          <button
            id="export-audit-ledger-btn"
            type="button"
            onClick={handleExportAudit}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${
              canExportAudit
                ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7] hover:bg-[#0B7A5C]'
                : 'border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
            }`}
          >
            {canExportAudit ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            <span>Export Audit CSV ({filteredAudit.length})</span>
          </button>
        </div>
      </div>

      {chainResult ? (
        <div className="rounded-2xl border border-[#0E6B8A]/35 bg-[#0E6B8A]/10 px-4 py-3 font-code text-xs font-semibold text-[#0E6B8A]">
          CRYPTOGRAPHIC INTEGRITY CHECK: {chainResult}
        </div>
      ) : null}

      {/* Section A: Paginated Immutable SHA-256 Session Audit Table */}
      <div className="editorial-surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-[#072A2E]/10 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-editorial text-2xl">Immutable FIPS 180-4 SHA-256 Audit Ledger</h2>
            <p className="text-xs text-[#3F6064]">
              Page {safeAuditPage}/{totalAuditPages} · Every event hashes its predecessor from
              genesis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'SECURITY', 'INTAKE', 'MERL', 'CMS', 'GOVERNANCE', 'EXPORT'] as AuditFilter[]).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setAuditFilter(cat);
                    setAuditPage(1);
                  }}
                  className={`cursor-pointer rounded-lg border px-2 py-1 font-code text-[10px] font-semibold ${
                    auditFilter === cat
                      ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7]'
                      : 'border-[#072A2E]/12 bg-[#F4F8F7] text-[#3F6064]'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
            <div className="relative sm:w-44">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#3F6064]" />
              <input
                type="search"
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                placeholder="Filter..."
                className="w-full rounded-lg border border-[#072A2E]/14 bg-[#F4F8F7] py-1 pr-2 pl-7 text-xs"
              />
            </div>
            <button
              type="button"
              disabled={safeAuditPage <= 1}
              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer rounded border border-[#072A2E]/15 p-1 disabled:opacity-35"
              aria-label="Previous audit page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={safeAuditPage >= totalAuditPages}
              onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
              className="cursor-pointer rounded border border-[#072A2E]/15 p-1 disabled:opacity-35"
              aria-label="Next audit page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-[#072A2E]/10 bg-[#F4F8F7] text-[10px] uppercase tracking-wider text-[#3F6064]">
              <tr>
                <th className="px-4 py-2.5">Time (CAT)</th>
                <th className="px-4 py-2.5">Actor / Role</th>
                <th className="px-4 py-2.5">Record ID</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Details &amp; 64-Hex SHA-256 Chain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#072A2E]/8">
              {pagedAudit.map((evt) => (
                <tr key={evt.id} className="hover:bg-[#F4F8F7]/80">
                  <td className="whitespace-nowrap px-4 py-2.5 font-code text-[10.5px] text-[#3F6064]">
                    <div>{evt.timeCat}</div>
                    <div className="text-[9.5px] text-[#0B7A5C]">{evt.id}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{evt.actor}</div>
                    <div className="font-code text-[10px] text-[#0E6B8A]">{evt.role}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-code text-[11px] font-semibold">
                    {evt.recordId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`rounded-md border px-2 py-0.5 font-code text-[10px] font-semibold ${
                        evt.action.includes('DENIED') || evt.action.includes('BLOCKED')
                          ? 'border-[#0B7A5C] bg-[#0B7A5C]/15 text-[#B45309]'
                          : 'border-[#072A2E]/12 bg-[#F4F8F7] text-[#0B7A5C]'
                      }`}
                    >
                      {evt.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p>{evt.details}</p>
                    <p className="mt-0.5 font-code text-[9px] text-[#3F6064]">
                      SHA-256: {evt.chainHash.slice(0, 32)}…
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: Gate 3 Data Migration Profiler & SHA-256 Backup/Restore Console */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="editorial-surface rounded-2xl p-4 sm:p-5 lg:col-span-7">
          <div className="flex items-center justify-between gap-2 border-b border-[#072A2E]/10 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#0E6B8A]" />
              <h2 className="font-editorial text-2xl">Gate 3 · CSV Data Migration Profiler</h2>
            </div>
            <span className="font-code text-[10px] text-[#0B7A5C]">DRY-RUN RECONCILIATION</span>
          </div>

          <p className="mt-2 text-xs text-[#3F6064]">
            Preloaded with 5 realistic rows (2 clean, 1 duplicate Q3, 1 invalid ratio, 1 Zambian NRC
            PII violation) to verify Gate 3 migration screening before committing to MERL queue.
          </p>

          <textarea
            rows={6}
            value={migrationCsv}
            onChange={(e) => setMigrationCsv(e.target.value)}
            className="mt-3 w-full rounded-xl border border-[#072A2E]/15 bg-[#F4F8F7] p-3 font-code text-[10.5px]"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              id="run-migration-profiler-btn"
              type="button"
              onClick={() => profileCsvMigration(migrationCsv)}
              className="cursor-pointer rounded-xl bg-[#0E6B8A] px-4 py-2 text-xs font-semibold text-[#F4F8F7] hover:bg-[#072A2E]"
            >
              Run Dry-Run Migration Profiler
            </button>
            <button
              id="commit-migration-btn"
              type="button"
              disabled={!lastMigrationReport || lastMigrationReport.stagedRecords.length === 0}
              onClick={() => commitStagedMigration()}
              className="cursor-pointer rounded-xl border border-[#072A2E]/20 bg-[#FFFFFF] px-4 py-2 text-xs font-semibold hover:border-[#0B7A5C] disabled:opacity-40"
            >
              Commit Clean Staged Rows ({lastMigrationReport?.stagedRecords.length ?? 0})
            </button>
          </div>

          {lastMigrationReport ? (
            <div className="mt-3.5 rounded-xl border border-[#072A2E]/12 bg-[#F4F8F7] p-3.5 text-xs">
              <div className="flex flex-wrap gap-3 font-code text-[10.5px]">
                <span>TOTAL: {lastMigrationReport.totalRows}</span>
                <span className="font-semibold text-[#0E6B8A]">
                  VALID: {lastMigrationReport.validRows}
                </span>
                <span className="text-[#0B7A5C]">
                  DUPLICATES: {lastMigrationReport.duplicateRows}
                </span>
                <span className="text-[#0B7A5C]">
                  BAD RATIOS: {lastMigrationReport.invalidRatioRows}
                </span>
                <span className="text-[#0B7A5C]">
                  PII BLOCKED: {lastMigrationReport.piiBlockedRows}
                </span>
              </div>
              {lastMigrationReport.issues.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-[#072A2E]/8 pt-2 text-[11px] text-[#B45309]">
                  {lastMigrationReport.issues.map((iss, idx) => (
                    <li key={idx}>
                      <strong>Row {iss.rowNumber}</strong> ({iss.province} · {iss.indicatorCode}):{' '}
                      {iss.issue}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Backup & Staging Restore Drill (IT Admin Only) */}
        <div className="espresso-surface flex flex-col justify-between rounded-2xl p-5 text-[#F4F8F7] lg:col-span-5">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-[#14B88A]" />
              <p className="font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]">
                Gate 3 · IT Admin Backup &amp; Staging Restore
              </p>
            </div>
            <h2 className="mt-1 font-editorial text-2xl">
              SHA-256 Verified Snapshot &amp; Recovery
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#F4F8F7]/75">
              Restricted strictly to <strong>IT Admin</strong>. Export a full state snapshot sealed
              with SHA-256 and test checksum-verified staging restore with prototype-pollution
              protection.
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                id="export-backup-snapshot-btn"
                type="button"
                onClick={handleDownloadBackup}
                className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ${
                  canAdminBackup
                    ? 'bg-[#14B88A] text-[#072A2E] hover:bg-[#F4F8F7]'
                    : 'border border-[#F4F8F7]/20 bg-[#0B3A40] text-[#F4F8F7]/60'
                }`}
              >
                {canAdminBackup ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                <span>
                  {canAdminBackup
                    ? 'Export SHA-256 Backup Snapshot (.json)'
                    : `Locked (${activeRole} · Requires IT Admin)`}
                </span>
              </button>

              <div className="flex gap-2">
                <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#F4F8F7]/25 bg-[#0E6B8A] px-3 py-2 text-xs font-semibold text-[#F4F8F7] hover:bg-[#0B7A5C]">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Restore From File</span>
                  <input type="file" accept=".json" onChange={handleBackupFileUpload} className="sr-only" />
                </label>

                <button
                  type="button"
                  disabled={!backupJsonPreview}
                  onClick={() => handleRestoreBackupWithMfa(backupJsonPreview)}
                  className="flex-1 cursor-pointer rounded-xl border border-[#14B88A]/50 bg-[#14B88A]/15 px-3 py-2 text-xs font-semibold text-[#99F6E4] hover:bg-[#14B88A]/30 disabled:opacity-40"
                >
                  Verify Last Snapshot
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-[#F4F8F7]/12 pt-3.5">
            <button
              type="button"
              onClick={() => resetDemoData()}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#F4F8F7]/20 px-3 py-2 text-xs font-semibold text-[#F4F8F7]/80 hover:border-[#0B7A5C] hover:text-[#F4F8F7]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>IT Admin: Reset Workspace Seed Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section C: 6-Role RBAC & MFA Matrix (Includes IT Admin) */}
      <div className="editorial-surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#072A2E]/10 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#0B7A5C]" />
            <h2 className="font-editorial text-2xl">
              6-Role Least-Privilege RBAC &amp; MFA Enforcement Matrix
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E6B8A]/25 bg-[#0E6B8A]/8 px-2.5 py-1 font-code text-[10.5px] font-semibold text-[#0E6B8A]">
            <Fingerprint className="h-3.5 w-3.5" />
            STRICT STORE-LEVEL ENFORCEMENT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-[#072A2E]/10 bg-[#F4F8F7] text-[10px] uppercase tracking-wider text-[#3F6064]">
              <tr>
                <th className="px-4 py-3">Role &amp; MFA Policy</th>
                <th className="px-2 py-3 text-center">Intake</th>
                <th className="px-2 py-3 text-center">MERL Lock</th>
                <th className="px-2 py-3 text-center">Revise</th>
                <th className="px-2 py-3 text-center">DPA CMS</th>
                <th className="px-2 py-3 text-center">WS5 Vault</th>
                <th className="px-2 py-3 text-center">Backup/IT</th>
                <th className="px-4 py-3 text-right">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#072A2E]/8">
              {ROLE_ORDER.map((roleKey) => {
                const p = ROLE_PROFILES[roleKey];
                const isCurrent = activeRole === roleKey;
                const cells = [
                  p.permissions.fieldIntake,
                  p.permissions.merlApproveLock,
                  p.permissions.traceableRevision,
                  p.permissions.dpaCmsPublish,
                  p.permissions.sensitiveCohortView,
                  p.permissions.systemAdminBackup,
                ];
                return (
                  <tr key={roleKey} className={isCurrent ? 'bg-[#14B88A]/12' : 'hover:bg-[#F4F8F7]/75'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.role}</span>
                        {isCurrent ? (
                          <span className="rounded bg-[#072A2E] px-1.5 py-0.5 font-code text-[9.5px] text-[#5EEAD4]">
                            ACTIVE
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-[#3F6064]">
                        {p.actorName} · {p.mfaMethod} ({p.sessionTtl})
                      </div>
                    </td>
                    {cells.map((ok, i) => (
                      <td key={i} className="px-2 py-3 text-center">
                        {ok ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0E6B8A]/12 text-[#0E6B8A]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#072A2E]/6 text-[#3F6064]/40">
                            <Minus className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => requestRoleSwitch(roleKey)}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                          isCurrent
                            ? 'bg-[#0E6B8A] text-[#F4F8F7]'
                            : 'border border-[#072A2E]/18 bg-[#FFFFFF] hover:border-[#0B7A5C]'
                        }`}
                      >
                        <UserCheck className="h-3 w-3" />
                        <span>{isCurrent ? 'Active' : p.requiresMfaStepUp ? 'MFA Switch' : 'Assume'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section D: REA 01–09 Stage Numbered Lifecycle Stepper (Quality Built into the Process) */}
      <div className="editorial-surface rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#072A2E]/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4 text-[#0E6B8A]" />
              <p className="font-code text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#0B7A5C]">
                EMCA Consultancy × Digital Labs · Quality Built into the Process
              </p>
            </div>
            <h2 className="mt-1 font-editorial text-2xl sm:text-3xl">
              01–09 Lifecycle Stepper · 8-Week Sovereign Build + 12-Week Warranty
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-code text-xs font-semibold text-[#0E6B8A]">
              {signedOffCount}/{timeline.length} Gates ({completionPct}%)
            </span>
            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-[#072A2E]/10">
              <div className="h-full rounded-full bg-[#0E6B8A] transition-all duration-300" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {timeline.map((week, idx) => {
            const isSelected = week.id === selectedWeek.id;
            const stageNum = String(idx + 1).padStart(2, '0');
            return (
              <button
                key={week.id}
                type="button"
                onClick={() => selectTimelineWeek(week.id)}
                className={`flash-sheen-btn flex cursor-pointer flex-col justify-between rounded-xl border p-3 text-left ${
                  isSelected
                    ? 'border-[#14B88A] bg-[#072A2E] text-[#F4F8F7] shadow-md'
                    : 'border-[#072A2E]/12 bg-[#F4F8F7] hover:border-[#0B7A5C]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-code text-[10px] font-bold ${isSelected ? 'text-[#5EEAD4]' : 'text-[#0B7A5C]'}`}>
                    {stageNum} · {week.weekLabel}
                  </span>
                  {week.signedOff ? (
                    <CheckCircle2 className={`h-3.5 w-3.5 ${isSelected ? 'text-[#6CCAD9]' : 'text-[#0E6B8A]'}`} />
                  ) : null}
                </div>
                <div className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug">
                  {week.title}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-[#072A2E]/10 bg-[#F4F8F7] p-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-7">
            <span className="rounded bg-[#072A2E] px-2 py-0.5 font-code text-[10px] text-[#5EEAD4]">
              {selectedWeek.phase} · {selectedWeek.weekLabel}
            </span>
            <h3 className="font-editorial text-2xl">{selectedWeek.title}</h3>
            <p className="text-xs text-[#3F6064]">{selectedWeek.summary}</p>
            <ul className="space-y-1 text-xs">
              {selectedWeek.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E6B8A]" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-[#072A2E]/12 bg-[#FFFFFF] p-4 lg:col-span-5">
            <div>
              <p className="font-code text-[10px] uppercase text-[#3F6064]">CHZ Acceptance Gate</p>
              <p className="mt-1 font-editorial text-xl">{selectedWeek.acceptanceGate}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleTimelineSignOff(selectedWeek.id)}
              className={`mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold ${
                !canSignOff
                  ? 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                  : selectedWeek.signedOff
                    ? 'border border-[#072A2E]/20 bg-[#F4F8F7]'
                    : 'bg-[#0E6B8A] text-[#F4F8F7] hover:bg-[#072A2E]'
              }`}
            >
              {!canSignOff ? <Lock className="h-3.5 w-3.5" /> : null}
              <span>
                {selectedWeek.signedOff ? 'Reopen Milestone Sign-Off' : 'Record Milestone Sign-Off'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
