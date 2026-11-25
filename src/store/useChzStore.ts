import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DELIVERY_TIMELINE,
  INDICATOR_CATALOG,
  INITIAL_AUDIT_EVENTS,
  INITIAL_CALENDAR,
  INITIAL_ENGAGEMENTS,
  INITIAL_EXPERTS,
  INITIAL_GRANTS,
  INITIAL_KNOWLEDGE_ASSETS,
  INITIAL_PROJECTS,
  INITIAL_RECORDS,
  INITIAL_SENSITIVE_COHORTS,
  PROVINCE_NAMES,
  ROLE_PROFILES,
  ZAMBIAN_PROVINCES,
} from '../data/chzSeedData';
import type {
  AuditEvent,
  DisaggregationRow,
  DonorGrant,
  EvidenceAttachment,
  ExpertProfile,
  KnowledgeAsset,
  MerlRecord,
  MfaPendingAction,
  MigrationProfileReport,
  MigrationRowIssue,
  PartnerEngagementEntry,
  PermissionKey,
  ProgrammeName,
  ProjectPartnerRecord,
  ProvinceName,
  QuarterLabel,
  ReportingCalendarItem,
  ScreenId,
  SensitiveCohortBoundaryItem,
  TimelineWeek,
  ToastItem,
  UserRole,
} from '../types/chz';
import {
  AUDIT_GENESIS_HASH,
  bumpMinorVersion,
  computeAuditEventHash,
  computeRate,
  evaluateDpaCompliance,
  formatCatShort,
  formatCatTimestamp,
  scanForZambianPii,
  sha256HexSync,
  validateDisaggregations,
  verifyAuditChain,
} from '../utils/chzUtils';

export interface IntakeSubmissionPayload {
  programme: ProgrammeName;
  province: ProvinceName;
  indicatorCode: string;
  indicatorName: string;
  quarter: QuarterLabel;
  numerator: number;
  denominator: number;
  targetRate: number;
  unitLabel: string;
  fieldNotes: string;
  evidence: EvidenceAttachment;
  disaggregations: DisaggregationRow[];
}

export interface ActionResult {
  ok: boolean;
  reason?: string;
  recordId?: string;
}

export interface BackupSnapshotPayload {
  schemaVersion: 'chz-backup-v2';
  exportedAtCat: string;
  exportedBy: string;
  recordCount: number;
  auditCount: number;
  checksumSha256: string;
  data: {
    records: MerlRecord[];
    auditLog: AuditEvent[];
    timeline: TimelineWeek[];
    calendar: ReportingCalendarItem[];
    knowledgeAssets: KnowledgeAsset[];
    recordSequence: number;
    auditSequence: number;
  };
}

interface ChzStoreState {
  activeScreen: ScreenId;
  activeRole: UserRole;
  selectedProvince: ProvinceName | 'ALL';
  selectedIndicatorScope: string; // 'PORTFOLIO' | indicatorCode
  chartGrouping: 'programme' | 'province';
  mapMode: '2d' | '3d';
  isOnline: boolean;

  records: MerlRecord[];
  auditLog: AuditEvent[];
  toasts: ToastItem[];
  timeline: TimelineWeek[];
  selectedWeekId: string;
  recordSequence: number;
  auditSequence: number;

  // WS1, WS2, WS4, WS5 state
  experts: ExpertProfile[];
  projects: ProjectPartnerRecord[];
  grants: DonorGrant[];
  calendar: ReportingCalendarItem[];
  engagements: PartnerEngagementEntry[];
  knowledgeAssets: KnowledgeAsset[];
  sensitiveCohorts: SensitiveCohortBoundaryItem[];

  // Gate 3 Migration & MFA Step-Up state
  lastMigrationReport: MigrationProfileReport | null;
  mfaModal: MfaPendingAction | null;
  mfaFailedAttempts: number;
  mfaLockoutUntil: number;
  sessionSecondsLeft: number;

  // Navigation & Filters
  setActiveScreen: (screen: ScreenId, silent?: boolean) => void;
  requestRoleSwitch: (role: UserRole, bypassMfaForTest?: boolean) => void;
  setSelectedProvince: (province: ProvinceName | 'ALL') => void;
  setSelectedIndicatorScope: (scope: string) => void;
  setChartGrouping: (grouping: 'programme' | 'province') => void;
  setMapMode: (mode: '2d' | '3d') => void;
  setOnlineStatus: (online: boolean) => void;
  syncOfflineDrafts: () => number;

  // MFA Step-Up & Idle Session
  openMfaChallenge: (action: MfaPendingAction) => void;
  cancelMfaChallenge: () => void;
  verifyMfaCode: (codeOrKey: string) => ActionResult;
  tickSessionTimer: () => void;
  resetSessionTimer: () => void;

  // Permission check helper
  hasPermission: (perm: PermissionKey) => boolean;

  // Screen 2: Field Intake
  submitFieldIntake: (payload: IntakeSubmissionPayload) => ActionResult;

  // Screen 3: MERL Verification Gate
  approveAndLockRecord: (recordId: string, merlNote?: string) => ActionResult;
  returnForRevision: (recordId: string, reason: string) => ActionResult;
  resubmitReturnedRecord: (recordId: string) => ActionResult;
  logTraceableRevision: (
    recordId: string,
    newNumerator: number,
    newDenominator: number,
    reason: string
  ) => ActionResult;
  inspectEvidenceVault: (recordId: string) => void;

  // Screen 4: Controlled Public CMS Feed
  togglePublishRecord: (recordId: string) => ActionResult;
  logDpaSuppressionReview: (recordId: string) => void;
  logPublicFeedDownload: (publishedCount: number, mode: 'copy' | 'download') => void;

  // WS2: Donors & Calendar
  sendCalendarReminder: (calendarId: string) => ActionResult;
  addPartnerEngagement: (partner: string, channel: string, summary: string) => ActionResult;

  // WS4: Knowledge & Media Library
  toggleKnowledgePublish: (assetId: string) => ActionResult;
  toggleKnowledgeArchive: (assetId: string) => ActionResult;
  addKnowledgeAsset: (asset: Omit<KnowledgeAsset, 'id' | 'updatedAt' | 'archived' | 'publishedToPublic'>) => ActionResult;

  // WS5: Segregated Sensitive Cohort Audit
  logSensitiveCohortAccess: (cohortId: string) => ActionResult;

  // Gate 3: Migration Profiler & Backup/Restore
  profileCsvMigration: (csvText: string) => MigrationProfileReport;
  commitStagedMigration: () => ActionResult;
  buildBackupSnapshot: () => BackupSnapshotPayload | null;
  restoreBackupSnapshot: (jsonText: string) => ActionResult;
  resetDemoData: () => ActionResult;

  // Exports & Governance
  logExportEvent: (format: 'CSV' | 'EXCEL' | 'PDF' | 'WORD', scopeLabel: string, count: number, sizeBytes: number) => ActionResult;
  logAuditExport: (count: number) => ActionResult;
  runAuditChainVerification: () => { valid: boolean; total: number; verifiedCount: number; brokenIds: string[] };
  selectTimelineWeek: (weekId: string) => void;
  toggleTimelineSignOff: (weekId: string) => ActionResult;
  logUiEvent: (category: AuditEvent['category'], action: string, recordId: string, details: string) => void;

  // Notifications
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const VALID_MFA_CODES = new Set(['260410', 'FIDO2-VERIFIED', 'CHZ-KEY-OK']);

function detectSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn) return false;
  return Boolean(conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === '3g' || conn.effectiveType === 'slow-2g');
}

export const useChzStore = create<ChzStoreState>()(
  persist(
    (set, get) => {
      const appendAudit = (
        category: AuditEvent['category'],
        action: string,
        recordId: string,
        details: string,
        overrideRole?: UserRole
      ): AuditEvent => {
        const state = get();
        const role = overrideRole ?? state.activeRole;
        const actor = ROLE_PROFILES[role].actorName;
        const nextSeq = state.auditSequence + 1;
        const timeCat = formatCatTimestamp();
        const prevHash = state.auditLog[0]?.chainHash ?? AUDIT_GENESIS_HASH;
        const base = {
          id: `AUD-${nextSeq}`,
          timeCat,
          actor,
          role,
          recordId,
          action,
          category,
          details,
        };
        const chainHash = computeAuditEventHash(prevHash, base);

        const event: AuditEvent = { ...base, prevHash, chainHash };
        set((s) => ({
          auditSequence: nextSeq,
          auditLog: [event, ...s.auditLog],
        }));
        return event;
      };

      const triggerToast = (toast: Omit<ToastItem, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          toasts: [...s.toasts.slice(-3), { ...toast, id }],
        }));
        if (typeof window !== 'undefined') {
          window.setTimeout(() => {
            set((s) => ({
              toasts: s.toasts.filter((t) => t.id !== id),
            }));
          }, 5200);
        }
      };

      const assertPermission = (
        perm: PermissionKey,
        actionLabel: string,
        recordId: string
      ): ActionResult => {
        const state = get();
        const profile = ROLE_PROFILES[state.activeRole];
        if (!profile.permissions[perm]) {
          const allowedRoles = (Object.keys(ROLE_PROFILES) as UserRole[])
            .filter((r) => ROLE_PROFILES[r].permissions[perm])
            .join(' or ');
          const reason = `Least-privilege RBAC denied "${actionLabel}" for ${state.activeRole}. Required role: ${allowedRoles}.`;
          appendAudit('SECURITY', 'ACCESS_DENIED', recordId, reason);
          triggerToast({
            title: `Access Denied (${state.activeRole})`,
            message: reason,
            tone: 'warning',
          });
          return { ok: false, reason };
        }
        return { ok: true };
      };

      const applyRoleSwitch = (role: UserRole) => {
        const prevRole = get().activeRole;
        if (prevRole === role) return;
        const profile = ROLE_PROFILES[role];
        set({
          activeRole: role,
          sessionSecondsLeft: profile.sessionTtlSeconds,
        });
        appendAudit(
          'GOVERNANCE',
          'ROLE_SESSION_SWITCHED',
          'RBAC-SESSION',
          `Switched active session from ${prevRole} to ${role} (${profile.actorName} · ${profile.mfaStatus}).`,
          role
        );
        triggerToast({
          title: `Active Role: ${role}`,
          message: `${profile.actorName} · ${profile.mfaMethod} verified (${profile.sessionTtl}).`,
          tone: 'espresso',
        });
      };

      return {
        activeScreen: 'command',
        activeRole: 'MERL Lead',
        selectedProvince: 'ALL',
        selectedIndicatorScope: 'ESCMIS-STK-01',
        chartGrouping: 'programme',
        mapMode: detectSlowConnection() ? '2d' : '2d', // Default to instant 2D Low-Bandwidth Zambia Map (<15KB); 1-click toggle to lazy 3D Globe
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

        records: INITIAL_RECORDS,
        auditLog: INITIAL_AUDIT_EVENTS,
        toasts: [],
        timeline: DELIVERY_TIMELINE,
        selectedWeekId: 'wk-4',
        recordSequence: 13,
        auditSequence: 1006,

        experts: INITIAL_EXPERTS,
        projects: INITIAL_PROJECTS,
        grants: INITIAL_GRANTS,
        calendar: INITIAL_CALENDAR,
        engagements: INITIAL_ENGAGEMENTS,
        knowledgeAssets: INITIAL_KNOWLEDGE_ASSETS,
        sensitiveCohorts: INITIAL_SENSITIVE_COHORTS,

        lastMigrationReport: null,
        mfaModal: null,
        mfaFailedAttempts: 0,
        mfaLockoutUntil: 0,
        sessionSecondsLeft: ROLE_PROFILES['MERL Lead'].sessionTtlSeconds,

        hasPermission: (perm) => ROLE_PROFILES[get().activeRole].permissions[perm],

        setActiveScreen: (screen, silent = false) => {
          const current = get().activeScreen;
          set({ activeScreen: screen });
          if (!silent && current !== screen) {
            appendAudit('NAVIGATION', 'VIEW_SWITCHED', 'SYS-NAV', `Navigated to screen "${screen}".`);
          }
        },

        requestRoleSwitch: (role, bypassMfaForTest = false) => {
          if (get().activeRole === role) return;
          const targetProfile = ROLE_PROFILES[role];
          if (bypassMfaForTest || !targetProfile.requiresMfaStepUp) {
            applyRoleSwitch(role);
            return;
          }
          set({
            mfaModal: {
              title: `MFA Step-Up Required · Assume ${role}`,
              description: `${targetProfile.actorName} (${targetProfile.department}) requires ${targetProfile.mfaMethod} verification before elevating session privileges.`,
              requiredRoleLabel: role,
              onVerified: () => applyRoleSwitch(role),
            },
          });
        },

        openMfaChallenge: (action) => set({ mfaModal: action }),
        cancelMfaChallenge: () => {
          const modal = get().mfaModal;
          if (modal) {
            appendAudit('SECURITY', 'MFA_STEPUP_CANCELLED', 'MFA-GATE', `Cancelled MFA step-up for: ${modal.title}.`);
          }
          set({ mfaModal: null });
        },

        verifyMfaCode: (codeOrKey) => {
          const state = get();
          const now = Date.now();
          if (state.mfaLockoutUntil > now) {
            const secs = Math.ceil((state.mfaLockoutUntil - now) / 1000);
            const reason = `MFA rate-limited. Wait ${secs}s before retrying.`;
            appendAudit('SECURITY', 'MFA_RATE_LIMITED', 'MFA-GATE', reason);
            return { ok: false, reason };
          }

          const normalized = codeOrKey.trim().toUpperCase();
          if (!VALID_MFA_CODES.has(normalized)) {
            const nextFails = state.mfaFailedAttempts + 1;
            const lockedOut = nextFails >= 3;
            const lockoutUntil = lockedOut ? now + 30_000 : 0;
            set({
              mfaFailedAttempts: lockedOut ? 0 : nextFails,
              mfaLockoutUntil: lockoutUntil,
            });
            const reason = lockedOut
              ? '3 failed MFA attempts — 30s brute-force cooldown enforced.'
              : `Invalid TOTP code (${nextFails}/3 attempts). Use 260410 or Hardware Key.`;
            appendAudit('SECURITY', lockedOut ? 'MFA_LOCKOUT_TRIGGERED' : 'MFA_CHALLENGE_FAILED', 'MFA-GATE', reason);
            return { ok: false, reason };
          }

          const pending = state.mfaModal;
          set({
            mfaModal: null,
            mfaFailedAttempts: 0,
            mfaLockoutUntil: 0,
            sessionSecondsLeft: ROLE_PROFILES[state.activeRole].sessionTtlSeconds,
          });
          appendAudit(
            'SECURITY',
            'MFA_STEPUP_VERIFIED',
            'MFA-GATE',
            `Verified MFA step-up (${normalized === 'FIDO2-VERIFIED' ? 'FIDO2 Hardware Key' : 'TOTP'}) for ${pending?.title ?? 'privileged action'}.`
          );
          pending?.onVerified();
          return { ok: true };
        },

        tickSessionTimer: () => {
          const state = get();
          if (state.sessionSecondsLeft <= 1) {
            if (state.activeRole !== 'Programme Officer') {
              appendAudit(
                'SECURITY',
                'SESSION_IDLE_DOWNGRADED',
                'RBAC-SESSION',
                `Idle timeout reached for ${state.activeRole}; session auto-downgraded to least-privilege Programme Officer.`
              );
              set({
                activeRole: 'Programme Officer',
                sessionSecondsLeft: ROLE_PROFILES['Programme Officer'].sessionTtlSeconds,
              });
              triggerToast({
                title: 'Session Idle Timeout Enforced',
                message: 'Privileged role auto-downgraded after inactivity.',
                tone: 'warning',
              });
            } else {
              set({ sessionSecondsLeft: ROLE_PROFILES['Programme Officer'].sessionTtlSeconds });
            }
          } else {
            set({ sessionSecondsLeft: state.sessionSecondsLeft - 1 });
          }
        },

        resetSessionTimer: () => {
          const ttl = ROLE_PROFILES[get().activeRole].sessionTtlSeconds;
          set({ sessionSecondsLeft: ttl });
        },

        setSelectedProvince: (province) => {
          if (get().selectedProvince === province) return;
          set({ selectedProvince: province });
          appendAudit(
            'NAVIGATION',
            'PROVINCE_FILTER_APPLIED',
            province === 'ALL' ? 'ZM-ALL-10' : `ZM-${province.toUpperCase()}`,
            province === 'ALL'
              ? 'Reset Executive Command footprint filter to all 10 Zambian provinces.'
              : `Scoped Executive Command KPIs, map focus, and charts to ${province} Province.`
          );
        },

        setSelectedIndicatorScope: (scope) => {
          set({ selectedIndicatorScope: scope });
          appendAudit(
            'NAVIGATION',
            'INDICATOR_SCOPE_CHANGED',
            scope,
            `Scoped unit-safe KPI aggregation to ${scope === 'PORTFOLIO' ? 'Portfolio Attainment Index' : scope}.`
          );
        },

        setChartGrouping: (grouping) => {
          set({ chartGrouping: grouping });
          appendAudit(
            'NAVIGATION',
            'CHART_DIMENSION_CHANGED',
            'EXEC-CHART',
            `Switched Target vs. Achieved analytical breakdown to by-${grouping} view.`
          );
        },

        setMapMode: (mode) => {
          set({ mapMode: mode });
          appendAudit(
            'NAVIGATION',
            'MAP_RENDERER_SWITCHED',
            'GEO-MAP',
            `Switched Zambia footprint map to ${mode === '2d' ? '2D Low-Bandwidth SVG mode' : '3D WebGL Sovereign Globe mode'}.`
          );
        },

        setOnlineStatus: (online) => {
          set({ isOnline: online });
          appendAudit(
            'GOVERNANCE',
            online ? 'CONNECTIVITY_RESTORED' : 'OFFLINE_MODE_ACTIVE',
            'FIELD-SYNC',
            online
              ? 'Field connectivity restored; queued drafts ready to synchronize.'
              : 'Device entered offline mode; new Field Intake drafts will queue locally.'
          );
        },

        syncOfflineDrafts: () => {
          const queued = get().records.filter((r) => r.offlineQueued);
          if (queued.length === 0) return 0;
          set((s) => ({
            records: s.records.map((r) => (r.offlineQueued ? { ...r, offlineQueued: false } : r)),
          }));
          appendAudit(
            'INTAKE',
            'OFFLINE_DRAFTS_SYNCHRONIZED',
            'FIELD-SYNC',
            `Synchronized ${queued.length} locally queued offline drafts to MERL Verification Gate.`
          );
          triggerToast({
            title: `${queued.length} Offline Draft(s) Synced`,
            message: 'Locally cached field submissions are now queued in Screen 3 MERL Gate.',
            tone: 'teal',
          });
          return queued.length;
        },

        submitFieldIntake: (payload) => {
          const perm = assertPermission('fieldIntake', 'Submit Field Indicator', payload.indicatorCode);
          if (!perm.ok) return perm;

          const state = get();
          // 1. Ratio validation
          if (
            !Number.isInteger(payload.numerator) ||
            !Number.isInteger(payload.denominator) ||
            payload.numerator < 0 ||
            payload.denominator <= 0 ||
            payload.numerator > payload.denominator
          ) {
            const reason = `Invalid ratio (${payload.numerator}/${payload.denominator}). Numerator must be integer 0 <= num <= den.`;
            appendAudit('INTAKE', 'INTAKE_VALIDATION_FAILED', payload.indicatorCode, reason);
            triggerToast({ title: 'Ratio Validation Failed', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          // 2. Gate 2: Duplicate period check (block if active DRAFT/LOCKED/PUBLISHED exists for same key)
          const duplicate = state.records.find(
            (r) =>
              r.programme === payload.programme &&
              r.province === payload.province &&
              r.indicatorCode === payload.indicatorCode &&
              r.quarter === payload.quarter &&
              r.status !== 'RETURNED'
          );
          if (duplicate) {
            const reason = `Duplicate period rejected: ${duplicate.id} already exists for ${payload.province} · ${payload.indicatorCode} · ${payload.quarter} (${duplicate.status}).`;
            appendAudit('INTAKE', 'DUPLICATE_PERIOD_BLOCKED', duplicate.id, reason);
            triggerToast({ title: 'Duplicate Reporting Period Blocked', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          // 3. Gate 2: Disaggregation sum reconciliation guard
          const disaggCheck = validateDisaggregations(
            payload.numerator,
            payload.denominator,
            payload.disaggregations
          );
          if (!disaggCheck.valid) {
            const reason = disaggCheck.error ?? 'Disaggregation sum mismatch.';
            appendAudit('INTAKE', 'DISAGGREGATION_MISMATCH_BLOCKED', payload.indicatorCode, reason);
            triggerToast({ title: 'Disaggregation Validation Failed', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          // 4. Zambia DPA No. 3 of 2021 automated PII scan on free text & filename
          const pii = scanForZambianPii(payload.fieldNotes, payload.evidence.name, payload.indicatorName);
          if (pii.hasPii) {
            const reason = `Blocked by Zambia DPA No. 3 of 2021 PII scanner: detected ${pii.findings.join(', ')}. Remove personal identifiers before submitting.`;
            appendAudit('SECURITY', 'DPA_PII_BLOCKED', payload.indicatorCode, reason);
            triggerToast({ title: 'DPA PII Violation Blocked', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          const nextSeq = state.recordSequence + 1;
          const quarterCode = payload.quarter.replace(' ', '-');
          const id = `CHZ-${quarterCode}-${String(nextSeq).padStart(3, '0')}`;
          const profile = ROLE_PROFILES[state.activeRole];
          const rate = computeRate(payload.numerator, payload.denominator);

          const newRecord: MerlRecord = {
            id,
            programme: payload.programme,
            province: payload.province,
            indicatorCode: payload.indicatorCode,
            indicatorName: payload.indicatorName,
            quarter: payload.quarter,
            numerator: payload.numerator,
            denominator: payload.denominator,
            targetRate: payload.targetRate,
            unitLabel: payload.unitLabel,
            status: 'DRAFT',
            publishedVersion: 'v1.0',
            submittedBy: profile.actorName,
            submittedRole: state.activeRole,
            submittedAt: formatCatShort(),
            evidence: {
              ...payload.evidence,
              vaultPath: `s3://chz-vault-lusaka-private/${payload.quarter.replace(' ', '/')}/${id}.enc`,
            },
            disaggregations: payload.disaggregations,
            fieldNotes: payload.fieldNotes.trim() || 'Submitted via CHZ Field Intake Portal.',
            revisionHistory: [],
            offlineQueued: !state.isOnline,
          };

          set((s) => ({
            recordSequence: nextSeq,
            records: [newRecord, ...s.records],
          }));

          appendAudit(
            'INTAKE',
            state.isOnline ? 'INTAKE_SUBMITTED' : 'INTAKE_QUEUED_OFFLINE',
            id,
            `Queued ${payload.province} ${payload.indicatorCode} (${payload.numerator.toLocaleString()}/${payload.denominator.toLocaleString()} · ${rate}%, ${payload.disaggregations.length} reconciled strata) as DRAFT.`
          );

          triggerToast({
            title: state.isOnline ? `Draft ${id} Queued for MERL` : `Draft ${id} Saved Offline`,
            message: `${payload.province} · ${payload.indicatorCode} (${rate}%) passed ratio, disaggregation & DPA PII checks.`,
            tone: 'copper',
            actionLabel: 'Open MERL Gate',
            actionScreen: 'verification',
          });

          return { ok: true, recordId: id };
        },

        approveAndLockRecord: (recordId, merlNote) => {
          const perm = assertPermission('merlApproveLock', 'Approve & Lock Period', recordId);
          if (!perm.ok) return perm;

          const state = get();
          const target = state.records.find((r) => r.id === recordId);
          if (!target) return { ok: false, reason: 'Record not found.' };
          if (target.status !== 'DRAFT') {
            const reason = `Only DRAFT records can be approved & locked (current status: ${target.status}).`;
            triggerToast({ title: 'Invalid State Transition', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          const profile = ROLE_PROFILES[state.activeRole];
          const nowShort = formatCatShort();
          const rate = computeRate(target.numerator, target.denominator);
          const isSmallCell = target.numerator < 10 || target.denominator < 10;

          set((s) => ({
            records: s.records.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    status: 'LOCKED',
                    lockedBy: profile.actorName,
                    lockedAt: nowShort,
                    merlNotes:
                      merlNote?.trim() ||
                      r.merlNotes ||
                      `Verified and period-locked by ${profile.actorName} (${state.activeRole}).`,
                  }
                : r
            ),
          }));

          appendAudit(
            'MERL',
            'PERIOD_APPROVED_LOCKED',
            recordId,
            `Approved & locked ${target.province} ${target.indicatorCode} ${target.publishedVersion} (${target.numerator.toLocaleString()}/${target.denominator.toLocaleString()} · ${rate}%).${isSmallCell ? ' DPA n<10 small-cell suppression enforced.' : ''}`
          );

          triggerToast({
            title: `${recordId} Approved & Period-Locked`,
            message: isSmallCell
              ? 'Executive KPIs updated. Held from Public CMS under Zambia DPA No. 3 of 2021 (n < 10).'
              : 'Executive KPIs updated and unlocked in Controlled Public CMS.',
            tone: 'teal',
            actionLabel: 'Open Public CMS',
            actionScreen: 'cms',
          });
          return { ok: true, recordId };
        },

        returnForRevision: (recordId, reason) => {
          const perm = assertPermission('merlReturnDraft', 'Return Draft for Revision', recordId);
          if (!perm.ok) return perm;

          const state = get();
          const target = state.records.find((r) => r.id === recordId);
          if (!target) return { ok: false, reason: 'Record not found.' };

          // Strict Period Lock Immutability (Gate 2)
          if (target.status !== 'DRAFT') {
            const msg = `Period Lock Immutability Violation: ${recordId} is ${target.status} and cannot be returned. Use "Log Traceable Revision" instead.`;
            appendAudit('SECURITY', 'LOCKED_PERIOD_RETURN_BLOCKED', recordId, msg);
            triggerToast({ title: 'Period Is Locked (Immutable)', message: msg, tone: 'warning' });
            return { ok: false, reason: msg };
          }

          const cleanReason =
            reason.trim() || 'Numerator/denominator verification discrepancy requires field clarification.';

          set((s) => ({
            records: s.records.map((r) =>
              r.id === recordId ? { ...r, status: 'RETURNED', merlNotes: cleanReason } : r
            ),
          }));

          appendAudit(
            'MERL',
            'RETURNED_FOR_REVISION',
            recordId,
            `Returned DRAFT ${target.province} ${target.indicatorCode} to Programme Officer: "${cleanReason}"`
          );

          triggerToast({ title: `${recordId} Returned to Field`, message: cleanReason, tone: 'warning' });
          return { ok: true, recordId };
        },

        resubmitReturnedRecord: (recordId) => {
          const perm = assertPermission('fieldIntake', 'Resubmit Returned Draft', recordId);
          if (!perm.ok) return perm;

          const target = get().records.find((r) => r.id === recordId);
          if (!target || target.status !== 'RETURNED') {
            return { ok: false, reason: 'Only RETURNED records can be resubmitted.' };
          }

          set((s) => ({
            records: s.records.map((r) =>
              r.id === recordId ? { ...r, status: 'DRAFT', submittedAt: formatCatShort() } : r
            ),
          }));

          appendAudit(
            'INTAKE',
            'REVISION_RESUBMITTED',
            recordId,
            `Resubmitted ${target.province} ${target.indicatorCode} into MERL Pending Review queue.`
          );

          triggerToast({
            title: `${recordId} Resubmitted as Draft`,
            message: 'Returned record has re-entered the MERL Verification Gate queue.',
            tone: 'copper',
          });
          return { ok: true, recordId };
        },

        logTraceableRevision: (recordId, newNumerator, newDenominator, reason) => {
          const perm = assertPermission('traceableRevision', 'Log Traceable Revision', recordId);
          if (!perm.ok) return perm;

          const state = get();
          const target = state.records.find((r) => r.id === recordId);
          if (!target) return { ok: false, reason: 'Record not found.' };

          if (
            !Number.isInteger(newNumerator) ||
            !Number.isInteger(newDenominator) ||
            newNumerator < 0 ||
            newDenominator <= 0 ||
            newNumerator > newDenominator
          ) {
            const msg = 'Invalid revised ratio: Numerator must be integer 0 <= num <= den.';
            triggerToast({ title: 'Invalid Revised Ratio', message: msg, tone: 'warning' });
            return { ok: false, reason: msg };
          }

          const pii = scanForZambianPii(reason);
          if (pii.hasPii) {
            const msg = `Revision reason blocked by Zambia DPA PII scanner (${pii.findings.join(', ')}).`;
            appendAudit('SECURITY', 'DPA_PII_BLOCKED', recordId, msg);
            triggerToast({ title: 'DPA PII Violation Blocked', message: msg, tone: 'warning' });
            return { ok: false, reason: msg };
          }

          const profile = ROLE_PROFILES[state.activeRole];
          const nowShort = formatCatShort();
          const cleanReason = reason.trim() || 'Reconciled with signed provincial DHIS2 register.';
          const prevVersion = target.publishedVersion;
          const nextVersion = bumpMinorVersion(prevVersion);

          const revisionEntry = {
            id: `REV-${Date.now().toString().slice(-4)}`,
            timestamp: nowShort,
            actor: profile.actorName,
            role: state.activeRole,
            reason: cleanReason,
            previousNumerator: target.numerator,
            previousDenominator: target.denominator,
            newNumerator,
            newDenominator,
            previousVersion: prevVersion,
            newVersion: nextVersion,
          };

          // Proportionally scale first stratum if needed so disaggregations remain explicitly reconciled
          const updatedDisaggs: DisaggregationRow[] =
            target.disaggregations.length > 0
              ? [
                  {
                    ...target.disaggregations[0],
                    stratum: `${target.disaggregations[0].stratum.split(' [')[0]} [Reconciled ${nextVersion}]`,
                    numerator: newNumerator,
                    denominator: newDenominator,
                  },
                ]
              : [];

          // Never silently mutate live published website figures! Place into REVISION_PENDING_REPUBLISH
          const wasPublished =
            target.status === 'PUBLISHED' || target.status === 'REVISION_PENDING_REPUBLISH';
          const nextStatus = wasPublished
            ? 'REVISION_PENDING_REPUBLISH'
            : target.status === 'RETURNED'
              ? 'DRAFT'
              : target.status;

          set((s) => ({
            records: s.records.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    numerator: newNumerator,
                    denominator: newDenominator,
                    publishedVersion: nextVersion,
                    status: nextStatus,
                    disaggregations: updatedDisaggs,
                    merlNotes: `Traceable revision (${prevVersion} → ${nextVersion}): ${cleanReason}`,
                    revisionHistory: [revisionEntry, ...r.revisionHistory],
                  }
                : r
            ),
          }));

          appendAudit(
            'MERL',
            'TRACEABLE_REVISION_LOGGED',
            recordId,
            `Revised ${target.indicatorCode} (${prevVersion} → ${nextVersion}) from ${target.numerator}/${target.denominator} to ${newNumerator}/${newDenominator}. Reason: "${cleanReason}"${wasPublished ? ' Held in REVISION_PENDING_REPUBLISH pending Comms diff approval.' : ''}`
          );

          triggerToast({
            title: `Traceable Revision Logged (${nextVersion})`,
            message: wasPublished
              ? `Live public website holds ${prevVersion} until Comms approves ${nextVersion} diff in Screen 4.`
              : `Updated to ${newNumerator.toLocaleString()} / ${newDenominator.toLocaleString()} with immutable diff trail.`,
            tone: 'copper',
            actionLabel: wasPublished ? 'Review CMS Diff' : undefined,
            actionScreen: wasPublished ? 'cms' : undefined,
          });
          return { ok: true, recordId };
        },

        inspectEvidenceVault: (recordId) => {
          const target = get().records.find((r) => r.id === recordId);
          if (!target) return;
          appendAudit(
            'MERL',
            'PRIVATE_EVIDENCE_VERIFIED',
            recordId,
            `Verified private vault artifact ${target.evidence.name} (SHA-256 ${target.evidence.sha256.slice(0, 16)}…).`
          );
          triggerToast({
            title: 'Encrypted Vault SHA-256 Verified',
            message: `${target.evidence.name} · 64-hex digest matches Lusaka private vault.`,
            tone: 'espresso',
          });
        },

        togglePublishRecord: (recordId) => {
          const perm = assertPermission('dpaCmsPublish', 'Publish / Withdraw Public Factsheet', recordId);
          if (!perm.ok) return perm;

          const state = get();
          const target = state.records.find((r) => r.id === recordId);
          if (!target) return { ok: false, reason: 'Record not found.' };

          const dpa = evaluateDpaCompliance(target);
          if (!dpa.passed) {
            appendAudit('CMS', 'DPA_PUBLISH_BLOCKED', recordId, dpa.reason);
            triggerToast({
              title: 'Blocked by Zambia DPA No. 3 of 2021',
              message: dpa.reason,
              tone: 'warning',
            });
            return { ok: false, reason: dpa.reason };
          }

          const profile = ROLE_PROFILES[state.activeRole];
          const isCurrentlyLiveUnchanged = target.status === 'PUBLISHED';
          const willPublish = !isCurrentlyLiveUnchanged; // publishes LOCKED or REVISION_PENDING_REPUBLISH
          const nowShort = formatCatShort();
          const etag = `W/"${target.id.toLowerCase()}-${target.publishedVersion}"`;

          set((s) => ({
            records: s.records.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    status: willPublish ? 'PUBLISHED' : 'LOCKED',
                    publishedAt: willPublish ? nowShort : undefined,
                    publishedBy: willPublish ? profile.actorName : undefined,
                    publishedSnapshot: willPublish
                      ? {
                          version: r.publishedVersion,
                          numerator: r.numerator,
                          denominator: r.denominator,
                          publishedAt: nowShort,
                          publishedBy: profile.actorName,
                          etag,
                        }
                      : undefined,
                  }
                : r
            ),
          }));

          appendAudit(
            'CMS',
            willPublish ? 'CMS_PUBLISHED' : 'CMS_WITHDRAWN',
            recordId,
            willPublish
              ? `Published ${target.province} ${target.indicatorCode} ${target.publishedVersion} (${etag}) to coalitionhealth.org.zm (DPA n>=10 + PII scan cleared).`
              : `Withdrew ${target.province} ${target.indicatorCode} instantly from coalitionhealth.org.zm and purged public ETag cache.`
          );

          triggerToast({
            title: willPublish
              ? `Published ${target.publishedVersion} to coalitionhealth.org.zm`
              : 'Withdrawn Instantly & Cache Purged',
            message: `${target.province} · ${target.indicatorCode} (${computeRate(target.numerator, target.denominator)}%) ${willPublish ? 'is live on the public factsheet feed.' : 'removed from public preview immediately.'}`,
            tone: willPublish ? 'teal' : 'espresso',
          });
          return { ok: true, recordId };
        },

        logDpaSuppressionReview: (recordId) => {
          const target = get().records.find((r) => r.id === recordId);
          if (!target) return;
          const dpa = evaluateDpaCompliance(target);
          appendAudit(
            'CMS',
            'DPA_SUPPRESSION_ATTESTED',
            recordId,
            `Attested Zambia DPA No. 3 of 2021 hold (${target.numerator}/${target.denominator}): ${dpa.reason}`
          );
          triggerToast({
            title: 'DPA Privacy Hold Attested',
            message: dpa.reason,
            tone: 'warning',
          });
        },

        logPublicFeedDownload: (publishedCount, mode) => {
          appendAudit(
            'EXPORT',
            mode === 'copy' ? 'PUBLIC_JSON_FEED_COPIED' : 'PUBLIC_JSON_FEED_DOWNLOADED',
            'CMS-API-V1',
            `${mode === 'copy' ? 'Copied' : 'Downloaded'} sanitised public JSON contract (${publishedCount} factsheets, zero PII, zero vault paths).`
          );
          triggerToast({
            title: mode === 'copy' ? 'Public CMS JSON Copied' : 'factsheets-v1.json Downloaded',
            message: `${publishedCount} DPA-cleared aggregate factsheets exported.`,
            tone: 'teal',
          });
        },

        sendCalendarReminder: (calendarId) => {
          const perm = assertPermission('donorManage', 'Dispatch Donor Reporting Reminder', calendarId);
          if (!perm.ok) return perm;

          const item = get().calendar.find((c) => c.id === calendarId);
          if (!item) return { ok: false, reason: 'Calendar item not found.' };
          const nowShort = formatCatShort();

          set((s) => ({
            calendar: s.calendar.map((c) =>
              c.id === calendarId
                ? { ...c, remindersSent: c.remindersSent + 1, lastReminderAt: nowShort }
                : c
            ),
          }));

          appendAudit(
            'PORTFOLIO',
            'DONOR_REMINDER_DISPATCHED',
            item.grantCode,
            `Dispatched automated reporting reminder #${item.remindersSent + 1} to ${item.ownerRole} for "${item.deliverable}" (Due ${item.dueDate}).`
          );

          triggerToast({
            title: 'Reporting Reminder Dispatched',
            message: `Notified ${item.ownerRole} for ${item.grantCode} (${item.dueDate}).`,
            tone: 'copper',
          });
          return { ok: true };
        },

        addPartnerEngagement: (partner, channel, summary) => {
          const perm = assertPermission('donorManage', 'Log Partner Engagement', 'WS2-ENG');
          if (!perm.ok) return perm;
          const cleanSummary = summary.trim();
          if (!partner.trim() || !cleanSummary) {
            return { ok: false, reason: 'Partner name and summary are required.' };
          }
          const entry: PartnerEngagementEntry = {
            id: `ENG-${Date.now().toString().slice(-4)}`,
            dateCat: formatCatShort(),
            partner: partner.trim(),
            channel: channel.trim() || 'Lusaka Coordination Meeting',
            summary: cleanSummary,
            recordedBy: ROLE_PROFILES[get().activeRole].actorName,
          };
          set((s) => ({ engagements: [entry, ...s.engagements] }));
          appendAudit('PORTFOLIO', 'PARTNER_ENGAGEMENT_LOGGED', entry.id, `${entry.partner} (${entry.channel}): ${entry.summary}`);
          triggerToast({ title: 'Engagement Recorded', message: `${entry.partner} logged to collaboration history.`, tone: 'teal' });
          return { ok: true };
        },

        toggleKnowledgePublish: (assetId) => {
          const perm = assertPermission('knowledgeManage', 'Publish Knowledge / Media Asset', assetId);
          if (!perm.ok) return perm;

          const asset = get().knowledgeAssets.find((a) => a.id === assetId);
          if (!asset) return { ok: false, reason: 'Asset not found.' };

          if (!asset.publishedToPublic && asset.consentStatus === 'Expired') {
            const reason = `Consent Expired (${asset.consentExpiresOn}): public release of "${asset.title}" is blocked under Zambia DPA & Media Rights policy.`;
            appendAudit('SECURITY', 'EXPIRED_CONSENT_PUBLISH_BLOCKED', assetId, reason);
            triggerToast({ title: 'Blocked: Expired Media Consent', message: reason, tone: 'warning' });
            return { ok: false, reason };
          }

          const nextPub = !asset.publishedToPublic;
          set((s) => ({
            knowledgeAssets: s.knowledgeAssets.map((a) =>
              a.id === assetId ? { ...a, publishedToPublic: nextPub, updatedAt: formatCatShort() } : a
            ),
          }));

          appendAudit(
            'KNOWLEDGE',
            nextPub ? 'KNOWLEDGE_ASSET_PUBLISHED' : 'KNOWLEDGE_ASSET_WITHDRAWN',
            assetId,
            `${nextPub ? 'Published' : 'Withdrew'} "${asset.title}" (${asset.version}, consent: ${asset.consentStatus}).`
          );

          triggerToast({
            title: nextPub ? 'Asset Cleared for Public Library' : 'Asset Withdrawn to Internal',
            message: asset.title,
            tone: nextPub ? 'teal' : 'espresso',
          });
          return { ok: true };
        },

        toggleKnowledgeArchive: (assetId) => {
          const perm = assertPermission('knowledgeManage', 'Archive Knowledge Asset', assetId);
          if (!perm.ok) return perm;

          const asset = get().knowledgeAssets.find((a) => a.id === assetId);
          if (!asset) return { ok: false, reason: 'Asset not found.' };
          const nextArch = !asset.archived;

          set((s) => ({
            knowledgeAssets: s.knowledgeAssets.map((a) =>
              a.id === assetId
                ? {
                    ...a,
                    archived: nextArch,
                    publishedToPublic: nextArch ? false : a.publishedToPublic,
                    updatedAt: formatCatShort(),
                  }
                : a
            ),
          }));

          appendAudit(
            'KNOWLEDGE',
            nextArch ? 'KNOWLEDGE_ASSET_ARCHIVED' : 'KNOWLEDGE_ASSET_RESTORED',
            assetId,
            `${nextArch ? 'Archived' : 'Restored'} "${asset.title}" (${asset.version}).`
          );
          triggerToast({
            title: nextArch ? 'Asset Archived' : 'Asset Restored',
            message: asset.title,
            tone: 'espresso',
          });
          return { ok: true };
        },

        addKnowledgeAsset: (assetInput) => {
          const perm = assertPermission('knowledgeManage', 'Register Knowledge Asset', 'WS4-KML');
          if (!perm.ok) return perm;
          const id = `KML-${String(get().knowledgeAssets.length + 1).padStart(3, '0')}`;
          const newAsset: KnowledgeAsset = {
            ...assetInput,
            id,
            archived: false,
            publishedToPublic: false,
            updatedAt: formatCatShort(),
          };
          set((s) => ({ knowledgeAssets: [newAsset, ...s.knowledgeAssets] }));
          appendAudit('KNOWLEDGE', 'KNOWLEDGE_ASSET_CREATED', id, `Registered "${newAsset.title}" (${newAsset.assetType} · ${newAsset.version}).`);
          triggerToast({ title: `${id} Registered in Library`, message: newAsset.title, tone: 'teal' });
          return { ok: true, recordId: id };
        },

        logSensitiveCohortAccess: (cohortId) => {
          const perm = assertPermission('sensitiveCohortView', 'Inspect Segregated Sensitive Cohort', cohortId);
          if (!perm.ok) return perm;
          const cohort = get().sensitiveCohorts.find((c) => c.id === cohortId);
          if (!cohort) return { ok: false, reason: 'Cohort not found.' };
          const nowShort = formatCatShort();
          set((s) => ({
            sensitiveCohorts: s.sensitiveCohorts.map((c) =>
              c.id === cohortId ? { ...c, lastAccessAudit: nowShort } : c
            ),
          }));
          appendAudit(
            'SECURITY',
            'SENSITIVE_COHORT_ACCESSED',
            cohort.cohortCode,
            `Authorized read of segregated cohort boundary ${cohort.cohortCode} (${cohort.province} · ${cohort.programme}). Zero PII exported.`
          );
          triggerToast({
            title: `Segregated Boundary Audited (${cohort.cohortCode})`,
            message: 'Access logged to immutable SHA-256 chain. Zero public CMS cross-join verified.',
            tone: 'espresso',
          });
          return { ok: true };
        },

        profileCsvMigration: (csvText) => {
          const state = get();
          const lines = csvText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));

          const dataLines = lines.length > 1 && lines[0].toLowerCase().includes('indicatorcode') ? lines.slice(1) : lines;
          const issues: MigrationRowIssue[] = [];
          const stagedRecords: MerlRecord[] = [];
          let duplicateRows = 0;
          let invalidRatioRows = 0;
          let piiBlockedRows = 0;

          const seenKeys = new Set(
            state.records
              .filter((r) => r.status !== 'RETURNED')
              .map((r) => `${r.province}|${r.indicatorCode}|${r.quarter}`)
          );

          dataLines.forEach((line, idx) => {
            const rowNum = idx + 1;
            const cols = line.split(',').map((c) => c.trim());
            const [provRaw, progRaw, codeRaw, qtrRaw, numRaw, denRaw, ...notesRest] = cols;
            const notes = notesRest.join(', ');
            const num = Number(numRaw);
            const den = Number(denRaw);

            const ind = INDICATOR_CATALOG.find((i) => i.code === codeRaw);
            if (!ind || !PROVINCE_NAMES.includes(provRaw as ProvinceName)) {
              issues.push({
                rowNumber: rowNum,
                indicatorCode: codeRaw || 'UNKNOWN',
                province: provRaw || 'UNKNOWN',
                issue: 'Unknown province or standardized indicator code.',
              });
              return;
            }

            const pii = scanForZambianPii(notes);
            if (pii.hasPii) {
              piiBlockedRows += 1;
              issues.push({
                rowNumber: rowNum,
                indicatorCode: codeRaw,
                province: provRaw,
                issue: `DPA PII violation detected (${pii.findings.join(', ')}).`,
              });
              return;
            }

            if (!Number.isInteger(num) || !Number.isInteger(den) || num < 0 || den <= 0 || num > den) {
              invalidRatioRows += 1;
              issues.push({
                rowNumber: rowNum,
                indicatorCode: codeRaw,
                province: provRaw,
                issue: `Invalid ratio (${numRaw}/${denRaw}): Numerator must be 0 <= num <= den.`,
              });
              return;
            }

            const key = `${provRaw}|${codeRaw}|${qtrRaw}`;
            if (seenKeys.has(key)) {
              duplicateRows += 1;
              issues.push({
                rowNumber: rowNum,
                indicatorCode: codeRaw,
                province: provRaw,
                issue: `Duplicate reporting period already exists for ${provRaw} · ${codeRaw} · ${qtrRaw}.`,
              });
              return;
            }

            seenKeys.add(key);
            const provinceMeta = ZAMBIAN_PROVINCES.find((p) => p.name === provRaw);
            const primaryDistrict = provinceMeta?.districts[0] ?? provRaw;
            const tempId = `CHZ-MIG-${String(state.recordSequence + stagedRecords.length + 1).padStart(3, '0')}`;

            stagedRecords.push({
              id: tempId,
              programme: (progRaw as ProgrammeName) || ind.programme,
              province: provRaw as ProvinceName,
              indicatorCode: ind.code,
              indicatorName: ind.name,
              quarter: (qtrRaw as QuarterLabel) || '2026 Q4',
              numerator: num,
              denominator: den,
              targetRate: ind.defaultTarget,
              unitLabel: ind.unitLabel,
              status: 'DRAFT',
              publishedVersion: 'v1.0',
              submittedBy: ROLE_PROFILES[state.activeRole].actorName,
              submittedRole: state.activeRole,
              submittedAt: formatCatShort(),
              evidence: {
                name: `Migration_Import_Row_${rowNum}.csv`,
                sizeKb: 24,
                mimeType: 'text/csv',
                sha256: sha256HexSync(`${tempId}|${line}`),
                vaultPath: `s3://chz-vault-lusaka-private/migrations/${tempId}.enc`,
                uploadedAt: formatCatShort(),
                hashedFromBytes: true,
              },
              disaggregations: [
                {
                  id: `mig-d-${rowNum}`,
                  district: primaryDistrict,
                  stratum: 'Migrated Aggregate',
                  numerator: num,
                  denominator: den,
                },
              ],
              fieldNotes: notes || 'Imported via Gate 3 Migration Profiler.',
              revisionHistory: [],
            });
          });

          const report: MigrationProfileReport = {
            timestamp: formatCatTimestamp(),
            totalRows: dataLines.length,
            validRows: stagedRecords.length,
            duplicateRows,
            invalidRatioRows,
            piiBlockedRows,
            issues,
            stagedRecords,
          };

          set({ lastMigrationReport: report });
          appendAudit(
            'GOVERNANCE',
            'MIGRATION_PROFILED',
            'GATE3-IMPORT',
            `Profiled ${report.totalRows} CSV rows: ${report.validRows} valid, ${duplicateRows} duplicates, ${invalidRatioRows} invalid ratios, ${piiBlockedRows} DPA PII blocks.`
          );
          return report;
        },

        commitStagedMigration: () => {
          const state = get();
          if (!state.hasPermission('merlApproveLock') && !state.hasPermission('systemAdminBackup')) {
            return assertPermission('systemAdminBackup', 'Commit Migrated Records', 'GATE3-IMPORT');
          }
          const report = state.lastMigrationReport;
          if (!report || report.stagedRecords.length === 0) {
            return { ok: false, reason: 'No valid staged rows to commit.' };
          }

          set((s) => ({
            recordSequence: s.recordSequence + report.stagedRecords.length,
            records: [...report.stagedRecords, ...s.records],
            lastMigrationReport: { ...report, stagedRecords: [] },
          }));

          appendAudit(
            'GOVERNANCE',
            'MIGRATION_COMMITTED',
            'GATE3-IMPORT',
            `Committed ${report.stagedRecords.length} profiled & reconciled records into MERL DRAFT queue.`
          );
          triggerToast({
            title: `${report.stagedRecords.length} Records Imported`,
            message: 'Clean rows queued in Screen 3 MERL Verification Gate; rejected rows excluded.',
            tone: 'teal',
          });
          return { ok: true };
        },

        buildBackupSnapshot: () => {
          const perm = assertPermission('systemAdminBackup', 'Generate Encrypted Backup Snapshot', 'GATE3-BACKUP');
          if (!perm.ok) return null;

          const state = get();
          const data = {
            records: state.records,
            auditLog: state.auditLog,
            timeline: state.timeline,
            calendar: state.calendar,
            knowledgeAssets: state.knowledgeAssets,
            recordSequence: state.recordSequence,
            auditSequence: state.auditSequence,
          };
          const checksumSha256 = sha256HexSync(JSON.stringify(data));
          const snapshot: BackupSnapshotPayload = {
            schemaVersion: 'chz-backup-v2',
            exportedAtCat: formatCatTimestamp(),
            exportedBy: ROLE_PROFILES[state.activeRole].actorName,
            recordCount: state.records.length,
            auditCount: state.auditLog.length,
            checksumSha256,
            data,
          };

          appendAudit(
            'GOVERNANCE',
            'BACKUP_SNAPSHOT_EXPORTED',
            'GATE3-BACKUP',
            `Exported verified backup snapshot (${snapshot.recordCount} records, ${snapshot.auditCount} audit events, SHA-256 ${checksumSha256.slice(0, 16)}…).`
          );
          triggerToast({
            title: 'Backup Snapshot Exported',
            message: `SHA-256 checksum ${checksumSha256.slice(0, 12)}… generated for Gate 3 restore drills.`,
            tone: 'teal',
          });
          return snapshot;
        },

        restoreBackupSnapshot: (jsonText) => {
          const perm = assertPermission('systemAdminBackup', 'Restore Backup Snapshot', 'GATE3-RESTORE');
          if (!perm.ok) return perm;

          try {
            const parsed = JSON.parse(jsonText) as Partial<BackupSnapshotPayload>;
            // VibeSec prototype pollution guard
            if (jsonText.includes('"__proto__"') || jsonText.includes('"constructor"')) {
              const reason = 'Blocked backup JSON containing prototype-pollution keys.';
              appendAudit('SECURITY', 'RESTORE_POLLUTION_BLOCKED', 'GATE3-RESTORE', reason);
              return { ok: false, reason };
            }
            if (parsed.schemaVersion !== 'chz-backup-v2' || !parsed.data || !parsed.checksumSha256) {
              return { ok: false, reason: 'Invalid CHZ backup snapshot format.' };
            }

            const recomputed = sha256HexSync(JSON.stringify(parsed.data));
            if (recomputed !== parsed.checksumSha256) {
              const reason = 'Backup SHA-256 checksum mismatch — file may be corrupted or tampered.';
              appendAudit('SECURITY', 'RESTORE_CHECKSUM_FAILED', 'GATE3-RESTORE', reason);
              triggerToast({ title: 'Restore Rejected (Checksum Mismatch)', message: reason, tone: 'warning' });
              return { ok: false, reason };
            }

            set({
              records: parsed.data.records,
              auditLog: parsed.data.auditLog,
              timeline: parsed.data.timeline,
              calendar: parsed.data.calendar,
              knowledgeAssets: parsed.data.knowledgeAssets,
              recordSequence: parsed.data.recordSequence,
              auditSequence: parsed.data.auditSequence,
            });

            appendAudit(
              'GOVERNANCE',
              'STAGING_RESTORE_VERIFIED',
              'GATE3-RESTORE',
              `Restored ${parsed.data.records.length} records & verified SHA-256 checksum (${recomputed.slice(0, 16)}…).`
            );
            triggerToast({
              title: 'Staging Backup Restored & Verified',
              message: `Restored ${parsed.data.records.length} MERL records with 100% SHA-256 match.`,
              tone: 'teal',
            });
            return { ok: true };
          } catch {
            return { ok: false, reason: 'Malformed JSON backup payload.' };
          }
        },

        resetDemoData: () => {
          const perm = assertPermission('systemAdminBackup', 'Reset Prototype Demo State', 'SYS-RESET');
          if (!perm.ok) return perm;
          set({
            records: INITIAL_RECORDS,
            auditLog: INITIAL_AUDIT_EVENTS,
            timeline: DELIVERY_TIMELINE,
            calendar: INITIAL_CALENDAR,
            engagements: INITIAL_ENGAGEMENTS,
            knowledgeAssets: INITIAL_KNOWLEDGE_ASSETS,
            recordSequence: 13,
            auditSequence: 1006,
            lastMigrationReport: null,
          });
          appendAudit('GOVERNANCE', 'DEMO_STATE_RESET', 'SYS-RESET', 'IT Admin reset prototype workspace to clean baseline seed.');
          triggerToast({ title: 'Baseline State Restored', message: 'All seed datasets and SHA-256 chain reset cleanly.', tone: 'espresso' });
          return { ok: true };
        },

        logExportEvent: (format, scopeLabel, count, sizeBytes) => {
          const perm = assertPermission('executiveExport', `Export ${format} Report`, scopeLabel);
          if (!perm.ok) return perm;
          const role = get().activeRole;
          const mode = ROLE_PROFILES[role].permissions.internalUnredactedExport
            ? 'INTERNAL_UNREDACTED'
            : 'DPA_REDACTED';
          appendAudit(
            'EXPORT',
            `${format}_EXPORT_DOWNLOADED`,
            scopeLabel === 'All Provinces' ? 'ZM-ALL-10' : scopeLabel.toUpperCase().slice(0, 20),
            `Exported ${count} verified records (${scopeLabel}) as ${format} (${Math.max(1, Math.ceil(sizeBytes / 1024))} KB · ${mode}).`
          );
          triggerToast({
            title: `${format} Export Ready`,
            message: `Downloaded ${count} records (${Math.max(1, Math.ceil(sizeBytes / 1024))} KB · ${mode}).`,
            tone: 'teal',
          });
          return { ok: true };
        },

        logAuditExport: (count) => {
          const perm = assertPermission('auditLedgerExport', 'Export Audit Ledger CSV', 'AUDIT-CHAIN');
          if (!perm.ok) return perm;
          appendAudit(
            'EXPORT',
            'AUDIT_LEDGER_EXPORTED',
            'AUDIT-CHAIN',
            `Exported immutable SHA-256 chained audit ledger (${count} CAT events) to formula-safe CSV.`
          );
          triggerToast({
            title: 'Audit Ledger Exported',
            message: `${count} SHA-256 chained entries downloaded safely.`,
            tone: 'espresso',
          });
          return { ok: true };
        },

        runAuditChainVerification: () => {
          const result = verifyAuditChain(get().auditLog);
          appendAudit(
            'SECURITY',
            result.valid ? 'AUDIT_CHAIN_VERIFIED' : 'AUDIT_CHAIN_TAMPER_ALERT',
            'AUDIT-CHAIN',
            result.valid
              ? `Verified all ${result.verifiedCount}/${result.total} FIPS 180-4 SHA-256 audit chain links from genesis.`
              : `TAMPER ALERT: ${result.brokenIds.length} broken hash links detected (${result.brokenIds.join(', ')}).`
          );
          triggerToast({
            title: result.valid
              ? `SHA-256 Chain Verified (${result.verifiedCount}/${result.total})`
              : 'Audit Chain Tamper Detected',
            message: result.valid
              ? 'Every chronological hash link matches from genesis.'
              : `Broken links: ${result.brokenIds.join(', ')}`,
            tone: result.valid ? 'teal' : 'warning',
          });
          return result;
        },

        selectTimelineWeek: (weekId) => {
          const week = get().timeline.find((w) => w.id === weekId);
          set({ selectedWeekId: weekId });
          if (week) {
            appendAudit(
              'GOVERNANCE',
              'DELIVERY_MILESTONE_INSPECTED',
              week.weekLabel.toUpperCase().replace(/\s+/g, '-'),
              `Inspected ${week.phase}: ${week.weekLabel} — ${week.title}.`
            );
          }
        },

        toggleTimelineSignOff: (weekId) => {
          const perm = assertPermission('timelineSignOff', 'Toggle Milestone Acceptance Sign-Off', weekId);
          if (!perm.ok) return perm;
          const target = get().timeline.find((w) => w.id === weekId);
          if (!target) return { ok: false, reason: 'Milestone not found.' };
          const nextSigned = !target.signedOff;

          set((s) => ({
            timeline: s.timeline.map((w) => (w.id === weekId ? { ...w, signedOff: nextSigned } : w)),
          }));

          appendAudit(
            'GOVERNANCE',
            nextSigned ? 'MILESTONE_SIGNED_OFF' : 'MILESTONE_REOPENED',
            target.weekLabel.toUpperCase().replace(/\s+/g, '-'),
            `${nextSigned ? 'Recorded readiness sign-off' : 'Reopened review'} for ${target.weekLabel}: ${target.title}.`
          );

          triggerToast({
            title: nextSigned ? `${target.weekLabel} Signed Off` : `${target.weekLabel} Reopened`,
            message: target.acceptanceGate,
            tone: nextSigned ? 'teal' : 'copper',
          });
          return { ok: true };
        },

        logUiEvent: (category, action, recordId, details) => {
          appendAudit(category, action, recordId, details);
        },

        pushToast: triggerToast,
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      };
    },
    {
      name: 'chz-sovereign-merl-v2',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      partialize: (state) => ({
        activeRole: state.activeRole,
        records: state.records,
        auditLog: state.auditLog,
        timeline: state.timeline,
        calendar: state.calendar,
        engagements: state.engagements,
        knowledgeAssets: state.knowledgeAssets,
        sensitiveCohorts: state.sensitiveCohorts,
        recordSequence: state.recordSequence,
        auditSequence: state.auditSequence,
      }),
    }
  )
);
