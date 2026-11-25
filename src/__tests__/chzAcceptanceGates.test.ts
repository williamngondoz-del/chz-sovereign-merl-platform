import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_MIGRATION_CSV } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import {
  computeWeightedTarget,
  escapeCsvCell,
  evaluateDpaCompliance,
  scanForZambianPii,
  sha256HexSync,
  validateDisaggregations,
  verifyAuditChain,
} from '../utils/chzUtils';
import {
  buildExcelWorkbookXml,
  buildValidPdfContent,
  buildVerifiedCsvContent,
  buildWordBriefHtml,
  estimateExportSizesKb,
} from '../utils/exportEngine';

function resetStoreForTest() {
  const store = useChzStore.getState();
  store.requestRoleSwitch('IT Admin', true);
  store.resetDemoData();
}

describe('CHZ 5 Mandatory Acceptance Gates & VibeSec Hardening', () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  // ===========================================================================
  // GATE 1: Permissions, MFA Rate-Limiting & Controlled Publishing / Withdrawal
  // ===========================================================================
  it('Gate 1: Enforces strict 6-role RBAC, logs ACCESS_DENIED, and enforces MFA brute-force lockout', () => {
    const store = useChzStore.getState();

    // Programme Officer cannot approve & lock OR publish CMS
    store.requestRoleSwitch('Programme Officer', true);
    const denyLock = useChzStore.getState().approveAndLockRecord('CHZ-2026-Q4-011');
    expect(denyLock.ok).toBe(false);
    expect(useChzStore.getState().auditLog[0].action).toBe('ACCESS_DENIED');

    const denyPublish = useChzStore.getState().togglePublishRecord('CHZ-2026-Q3-006');
    expect(denyPublish.ok).toBe(false);
    expect(useChzStore.getState().auditLog[0].action).toBe('ACCESS_DENIED');

    // IT Admin cannot publish CMS or approve MERL (least privilege)
    store.requestRoleSwitch('IT Admin', true);
    expect(useChzStore.getState().approveAndLockRecord('CHZ-2026-Q4-011').ok).toBe(false);
    expect(useChzStore.getState().togglePublishRecord('CHZ-2026-Q3-006').ok).toBe(false);

    // MFA Step-Up brute-force lockout after 3 invalid attempts
    useChzStore.getState().openMfaChallenge({
      title: 'Test MFA',
      description: 'Test lockout',
      requiredRoleLabel: 'MERL Lead',
      onVerified: () => {},
    });
    expect(useChzStore.getState().verifyMfaCode('000000').ok).toBe(false);
    expect(useChzStore.getState().verifyMfaCode('111111').ok).toBe(false);
    const thirdFail = useChzStore.getState().verifyMfaCode('222222');
    expect(thirdFail.ok).toBe(false);
    expect(useChzStore.getState().mfaLockoutUntil).toBeGreaterThan(Date.now());
    expect(useChzStore.getState().verifyMfaCode('260410').ok).toBe(false); // Blocked during 30s cooldown!
  });

  it('Gate 1: Controlled CMS blocks DPA small-cell (n<10), allows Comms publish & instant withdrawal', () => {
    useChzStore.getState().requestRoleSwitch('Comms & CMS Officer', true);

    // Muchinga n=7/8 must remain blocked under Zambia DPA No. 3 of 2021
    const smallCellAttempt = useChzStore.getState().togglePublishRecord('CHZ-2026-Q3-008');
    expect(smallCellAttempt.ok).toBe(false);
    expect(useChzStore.getState().auditLog[0].action).toBe('DPA_PUBLISH_BLOCKED');

    // DPA-cleared locked record CHZ-2026-Q3-006 publishes & withdraws cleanly
    const pub = useChzStore.getState().togglePublishRecord('CHZ-2026-Q3-006');
    expect(pub.ok).toBe(true);
    expect(
      useChzStore.getState().records.find((r) => r.id === 'CHZ-2026-Q3-006')?.status
    ).toBe('PUBLISHED');

    const withdraw = useChzStore.getState().togglePublishRecord('CHZ-2026-Q3-006');
    expect(withdraw.ok).toBe(true);
    const afterWithdraw = useChzStore.getState().records.find((r) => r.id === 'CHZ-2026-Q3-006');
    expect(afterWithdraw?.status).toBe('LOCKED');
    expect(afterWithdraw?.publishedSnapshot).toBeUndefined();
  });

  // ===========================================================================
  // GATE 2: Accuracy, Duplicates, Disaggregation, Period Locks & Formula-Safe Exports
  // ===========================================================================
  it('Gate 2: Blocks duplicates, invalid ratios, disaggregation mismatches, PII, and locked-period reversion', () => {
    useChzStore.getState().requestRoleSwitch('Programme Officer', true);

    // 1. Duplicate period blocked (Lusaka ESCMIS-STK-01 2026 Q3 already PUBLISHED)
    const dupRes = useChzStore.getState().submitFieldIntake({
      programme: 'eSCMIS Supply Chain',
      province: 'Lusaka',
      indicatorCode: 'ESCMIS-STK-01',
      indicatorName: 'Health facilities reporting zero essential tracer stock-outs',
      quarter: '2026 Q3',
      numerator: 150,
      denominator: 164,
      targetRate: 92,
      unitLabel: 'Facilities stocked',
      fieldNotes: 'Duplicate submission test',
      evidence: {
        name: 'dup.pdf',
        sizeKb: 100,
        mimeType: 'application/pdf',
        sha256: sha256HexSync('dup'),
        vaultPath: 's3://private/dup.enc',
        uploadedAt: '2026-11-25 10:00 CAT',
        hashedFromBytes: true,
      },
      disaggregations: [{ id: 'd1', district: 'Lusaka', stratum: 'All', numerator: 150, denominator: 164 }],
    });
    expect(dupRes.ok).toBe(false);

    // 2. Disaggregation sum mismatch rejected
    const disaggCheck = validateDisaggregations(100, 120, [
      { id: 'd1', district: 'Choma', stratum: 'Urban', numerator: 60, denominator: 70 },
      { id: 'd2', district: 'Monze', stratum: 'Rural', numerator: 30, denominator: 50 }, // sums to 90 != 100
    ]);
    expect(disaggCheck.valid).toBe(false);

    // 3. Zambian NRC / phone PII detection blocks intake
    const piiHit = scanForZambianPii('Patient NRC 123456/78/1 contacted on +260977112233');
    expect(piiHit.hasPii).toBe(true);
    expect(piiHit.findings.length).toBeGreaterThanOrEqual(2);

    // 4. Period lock immutability: MERL Lead cannot return an already LOCKED or PUBLISHED record
    useChzStore.getState().requestRoleSwitch('MERL Lead', true);
    const badReturn = useChzStore.getState().returnForRevision('CHZ-2026-Q3-001', 'Trying to unlock');
    expect(badReturn.ok).toBe(false);
    expect(useChzStore.getState().auditLog[0].action).toBe('LOCKED_PERIOD_RETURN_BLOCKED');

    // 5. Traceable revision bumps version & holds live web in REVISION_PENDING_REPUBLISH
    const rev = useChzStore.getState().logTraceableRevision('CHZ-2026-Q3-001', 156, 164, 'Reconciled Lusaka Chongwe clinic');
    expect(rev.ok).toBe(true);
    const revised = useChzStore.getState().records.find((r) => r.id === 'CHZ-2026-Q3-001')!;
    expect(revised.publishedVersion).toBe('v1.1');
    expect(revised.status).toBe('REVISION_PENDING_REPUBLISH');
    expect(revised.publishedSnapshot?.numerator).toBe(154); // Live website snapshot untouched until Comms approves!
  });

  it('Gate 2: Verifies denominator-weighted target math, CSV formula neutralization, and DPA CSV redaction', () => {
    // Denominator-weighted target: (90*1000 + 80*100) / 1100 = 89.1% (NOT unweighted average 85.0%!)
    const wTarget = computeWeightedTarget([
      { targetRate: 90, denominator: 1000 },
      { targetRate: 80, denominator: 100 },
    ]);
    expect(wTarget).toBe(89.1);

    // VibeSec CSV formula injection neutralization
    expect(escapeCsvCell('=CMD|"/C calc"!A0')).toMatch(/^"'=CMD/);
    expect(escapeCsvCell('+SUM(A1:A5)')).toBe("'+SUM(A1:A5)");
    expect(escapeCsvCell('-1+1')).toBe("'-1+1");
    expect(escapeCsvCell('@HYPERLINK("http://evil")')).toMatch(/^"'@HYPERLINK/);

    // Small-cell record redacted for Executive Director CSV, visible only to MERL Lead / Auditor
    const muchingaSmall = useChzStore.getState().records.find((r) => r.id === 'CHZ-2026-Q3-008')!;
    expect(evaluateDpaCompliance(muchingaSmall).passed).toBe(false);
    const execCsv = buildVerifiedCsvContent([muchingaSmall], 'Muchinga', 'Executive Director');
    expect(execCsv).toContain('<10 (DPA Suppressed)');
    expect(execCsv).not.toContain(',7,8,');

    const merlCsv = buildVerifiedCsvContent([muchingaSmall], 'Muchinga', 'MERL Lead');
    expect(merlCsv).toContain('INTERNAL_UNREDACTED');
  });

  // ===========================================================================
  // GATE 3: Data Migration Profiler & Checksum-Verified Backup / Restore
  // ===========================================================================
  it('Gate 3: Profiles CSV migration issues accurately and verifies SHA-256 backup/restore round-trip', () => {
    useChzStore.getState().requestRoleSwitch('IT Admin', true);

    const report = useChzStore.getState().profileCsvMigration(SAMPLE_MIGRATION_CSV);
    expect(report.totalRows).toBe(5);
    expect(report.validRows).toBe(2);
    expect(report.duplicateRows).toBe(1);
    expect(report.invalidRatioRows).toBe(1);
    expect(report.piiBlockedRows).toBe(1);

    // Commit valid staged rows
    const beforeCount = useChzStore.getState().records.length;
    expect(useChzStore.getState().commitStagedMigration().ok).toBe(true);
    expect(useChzStore.getState().records.length).toBe(beforeCount + 2);

    // Backup snapshot export + tamper detection + clean restore
    const snapshot = useChzStore.getState().buildBackupSnapshot();
    expect(snapshot).not.toBeNull();
    const rawJson = JSON.stringify(snapshot);

    // Tampered snapshot must be rejected
    const tampered = rawJson.replace('"Lusaka"', '"TamperedProvince"');
    expect(useChzStore.getState().restoreBackupSnapshot(tampered).ok).toBe(false);

    // Prototype pollution payload must be rejected
    expect(useChzStore.getState().restoreBackupSnapshot('{"__proto__":{"polluted":true}}').ok).toBe(false);

    // Reset then restore authentic snapshot
    useChzStore.getState().resetDemoData();
    expect(useChzStore.getState().records.length).toBe(beforeCount);
    expect(useChzStore.getState().restoreBackupSnapshot(rawJson).ok).toBe(true);
    expect(useChzStore.getState().records.length).toBe(beforeCount + 2);
  });

  // ===========================================================================
  // GATE 4: Performance — 2D Low-Bandwidth Default & 4-Format Reconciled Exports
  // ===========================================================================
  it('Gate 4: Defaults to 2D low-bandwidth map mode and generates valid 4-format exports with KB estimates', () => {
    const state = useChzStore.getState();
    expect(state.mapMode).toBe('2d');

    const verified = state.records.filter((r) => r.status === 'LOCKED' || r.status === 'PUBLISHED');
    const sizes = estimateExportSizesKb(verified, 'All Provinces', 'Executive Director');
    expect(sizes.csvKb).toBeGreaterThanOrEqual(1);
    expect(sizes.excelKb).toBeGreaterThanOrEqual(1);
    expect(sizes.wordKb).toBeGreaterThanOrEqual(1);
    expect(sizes.pdfKb).toBeGreaterThanOrEqual(1);

    expect(buildExcelWorkbookXml(verified, 'All Provinces', 'Executive Director')).toContain(
      '<Worksheet ss:Name="Disaggregations">'
    );
    expect(buildWordBriefHtml(verified, 'All Provinces', 'Executive Director')).toContain(
      'Coalition Health Zambia'
    );
    expect(buildValidPdfContent(verified, 'All Provinces', 'Executive Director')).toMatch(
      /^%PDF-1\.4/
    );
  });

  // ===========================================================================
  // GATE 5: End-to-End Multi-Role Quarterly Cycle + SHA-256 Audit Chain Integrity
  // ===========================================================================
  it('Gate 5: Completes full 4-role quarterly lifecycle with 100% valid FIPS 180-4 SHA-256 audit chain', () => {
    // 1. Programme Officer submits clean Q4 Southern eSCMIS draft with reconciled strata
    useChzStore.getState().requestRoleSwitch('Programme Officer', true);
    const submitRes = useChzStore.getState().submitFieldIntake({
      programme: 'eSCMIS Supply Chain',
      province: 'Southern',
      indicatorCode: 'ESCMIS-STK-01',
      indicatorName: 'Health facilities reporting zero essential tracer stock-outs',
      quarter: '2026 Q4',
      numerator: 124,
      denominator: 132,
      targetRate: 92,
      unitLabel: 'Facilities stocked',
      fieldNotes: 'Reconciled Southern Province ZAMMSA Q4 hub manifest.',
      evidence: {
        name: 'SO_eSCMIS_Q4.pdf',
        sizeKb: 640,
        mimeType: 'application/pdf',
        sha256: sha256HexSync('SO_eSCMIS_Q4.pdf'),
        vaultPath: 's3://chz-vault-lusaka-private/2026/Q4/SO_eSCMIS_Q4.enc',
        uploadedAt: '2026-11-25 11:00 CAT',
        hashedFromBytes: true,
      },
      disaggregations: [
        { id: 's1', district: 'Choma', stratum: 'Urban', numerator: 74, denominator: 78 },
        { id: 's2', district: 'Monze', stratum: 'Rural', numerator: 50, denominator: 54 },
      ],
    });
    expect(submitRes.ok).toBe(true);
    const createdId = submitRes.recordId!;

    // 2. MERL Lead approves & locks period
    useChzStore.getState().requestRoleSwitch('MERL Lead', true);
    expect(useChzStore.getState().approveAndLockRecord(createdId).ok).toBe(true);

    // 3. Comms & CMS Officer publishes to coalitionhealth.org.zm
    useChzStore.getState().requestRoleSwitch('Comms & CMS Officer', true);
    expect(useChzStore.getState().togglePublishRecord(createdId).ok).toBe(true);

    // 4. System Auditor verifies entire FIPS 180-4 SHA-256 chain from genesis
    useChzStore.getState().requestRoleSwitch('System Auditor', true);
    const chainCheck = verifyAuditChain(useChzStore.getState().auditLog);
    expect(chainCheck.valid).toBe(true);
    expect(chainCheck.brokenIds).toHaveLength(0);
    expect(chainCheck.verifiedCount).toBe(chainCheck.total);
  });
});
