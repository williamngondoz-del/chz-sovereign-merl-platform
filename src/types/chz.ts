export type ScreenId =
  | 'command'
  | 'portfolio'
  | 'intake'
  | 'verification'
  | 'cms'
  | 'knowledge'
  | 'governance';

export type UserRole =
  | 'Executive Director'
  | 'Programme Officer'
  | 'MERL Lead'
  | 'Comms & CMS Officer'
  | 'System Auditor'
  | 'IT Admin';

export type PermissionKey =
  | 'fieldIntake'
  | 'vaultUpload'
  | 'merlApproveLock'
  | 'merlReturnDraft'
  | 'traceableRevision'
  | 'dpaCmsPublish'
  | 'executiveExport'
  | 'internalUnredactedExport'
  | 'auditLedgerExport'
  | 'knowledgeManage'
  | 'donorManage'
  | 'sensitiveCohortView'
  | 'systemAdminBackup'
  | 'timelineSignOff';

export type ProvinceName =
  | 'Lusaka'
  | 'Copperbelt'
  | 'Southern'
  | 'Central'
  | 'Eastern'
  | 'Northern'
  | 'Luapula'
  | 'Muchinga'
  | 'North-Western'
  | 'Western';

export type ProgrammeName =
  | 'eSCMIS Supply Chain'
  | 'Maternal & Newborn Health'
  | 'Routine Immunization'
  | 'Malaria Surveillance & Vector Control'
  | 'HIV/TB Continuum of Care';

export type RecordStatus =
  | 'DRAFT'
  | 'RETURNED'
  | 'LOCKED'
  | 'PUBLISHED'
  | 'REVISION_PENDING_REPUBLISH';

export type QuarterLabel = '2026 Q1' | '2026 Q2' | '2026 Q3' | '2026 Q4';

export interface RoleProfile {
  role: UserRole;
  actorName: string;
  department: string;
  mfaMethod: string;
  mfaStatus: 'Verified · Active' | 'Hardware Key · Enforced';
  requiresMfaStepUp: boolean;
  sessionTtl: string;
  sessionTtlSeconds: number;
  primaryScreen: ScreenId;
  permissions: Record<PermissionKey, boolean>;
}

export interface EvidenceAttachment {
  name: string;
  sizeKb: number;
  mimeType: string;
  sha256: string;
  vaultPath: string;
  uploadedAt: string;
  hashedFromBytes: boolean;
}

export interface DisaggregationRow {
  id: string;
  district: string;
  stratum: string;
  numerator: number;
  denominator: number;
}

export interface RevisionEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  reason: string;
  previousNumerator: number;
  previousDenominator: number;
  newNumerator: number;
  newDenominator: number;
  previousVersion: string;
  newVersion: string;
}

export interface PublishedSnapshot {
  version: string;
  numerator: number;
  denominator: number;
  publishedAt: string;
  publishedBy: string;
  etag: string;
}

export interface MerlRecord {
  id: string;
  programme: ProgrammeName;
  province: ProvinceName;
  indicatorCode: string;
  indicatorName: string;
  quarter: QuarterLabel;
  numerator: number;
  denominator: number;
  targetRate: number;
  unitLabel: string;
  status: RecordStatus;
  publishedVersion: string;
  publishedSnapshot?: PublishedSnapshot;
  submittedBy: string;
  submittedRole: UserRole;
  submittedAt: string;
  evidence: EvidenceAttachment;
  disaggregations: DisaggregationRow[];
  fieldNotes: string;
  merlNotes?: string;
  lockedBy?: string;
  lockedAt?: string;
  publishedAt?: string;
  publishedBy?: string;
  revisionHistory: RevisionEntry[];
  offlineQueued?: boolean;
}

export interface AuditEvent {
  id: string;
  timeCat: string;
  actor: string;
  role: UserRole;
  recordId: string;
  action: string;
  category:
    | 'INTAKE'
    | 'MERL'
    | 'CMS'
    | 'GOVERNANCE'
    | 'EXPORT'
    | 'SECURITY'
    | 'PORTFOLIO'
    | 'KNOWLEDGE'
    | 'NAVIGATION';
  details: string;
  prevHash: string;
  chainHash: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: 'teal' | 'copper' | 'espresso' | 'warning';
  actionLabel?: string;
  actionScreen?: ScreenId;
}

export interface ProvinceGeoNode {
  name: ProvinceName;
  capital: string;
  lat: number;
  lng: number;
  svgX: number;
  svgY: number;
  facilitiesCount: number;
  regionalHubCode: string;
  districts: string[];
  isNationalHub?: boolean;
}

export type IndicatorDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
export type LogframeLevel = 'Impact' | 'Outcome' | 'Output';

export interface IndicatorCatalogItem {
  code: string;
  programme: ProgrammeName;
  name: string;
  logframeLevel: LogframeLevel;
  theoryOfChangePath: string;
  definition: string;
  unitLabel: string;
  direction: IndicatorDirection;
  baselineValue: number;
  baselineYear: string;
  defaultTarget: number;
  frequency: 'Quarterly' | 'Monthly' | 'Semi-Annual';
  owner: string;
  dataSource: string;
  verificationMethod: string;
}

export interface TimelineWeek {
  id: string;
  weekLabel: string;
  phase: '8-Week Sovereign Build' | '12-Week Post-Launch Warranty';
  title: string;
  leadTeam: string;
  summary: string;
  deliverables: string[];
  acceptanceGate: string;
  signedOff: boolean;
}

// WS1: Institutional & Portfolio
export interface ExpertProfile {
  id: string;
  name: string;
  title: string;
  specialty: string;
  provinceHub: ProvinceName;
  qualifications: string;
  availability: 'Active Deployment' | 'Advisory Pool';
}

export interface ProjectPartnerRecord {
  id: string;
  projectCode: string;
  title: string;
  subPartner: string;
  agreementNumber: string;
  provinceCoverage: ProvinceName[];
  budgetNgwee: number; // Integer minor units (1 ZMW = 100 Ngwee)
  spentNgwee: number;
  milestoneProgress: number;
  status: 'Active' | 'Monitoring' | 'Closeout';
}

// WS2: Donors, Grants & Compliance Calendar
export interface DonorGrant {
  id: string;
  grantCode: string;
  donorName: string;
  programme: ProgrammeName;
  awardCeilingUsdCents: number; // Integer cents
  disbursedUsdCents: number;
  obligations: string[];
  complianceStatus: 'On Track' | 'Action Due';
}

export interface ReportingCalendarItem {
  id: string;
  grantCode: string;
  donorName: string;
  deliverable: string;
  dueDate: string;
  ownerRole: UserRole;
  status: 'Submitted' | 'Due Soon' | 'Overdue';
  remindersSent: number;
  lastReminderAt?: string;
}

export interface PartnerEngagementEntry {
  id: string;
  dateCat: string;
  partner: string;
  channel: string;
  summary: string;
  recordedBy: string;
}

// WS4: Knowledge & Media Library
export interface KnowledgeAsset {
  id: string;
  title: string;
  assetType: 'Factsheet' | 'Policy Brief' | 'SOP Manual' | 'Field Photo' | 'DHIS2 Dataset';
  programme: ProgrammeName;
  tags: string[];
  attribution: string;
  consentStatus: 'Valid' | 'Expired' | 'Not Required';
  consentExpiresOn?: string;
  rightsScope: string;
  version: string;
  sizeKb: number;
  archived: boolean;
  publishedToPublic: boolean;
  updatedAt: string;
}

// WS5: Segregated Sensitive Cohort Summary (RBAC + MFA Gated)
export interface SensitiveCohortBoundaryItem {
  id: string;
  cohortCode: string;
  province: ProvinceName;
  programme: ProgrammeName;
  encryptionStandard: string;
  custodianRole: string;
  retainedCount: number;
  publicExposure: 'ZERO (Air-Gapped from CMS)';
  lastAccessAudit: string;
}

// Gate 3: Migration Profiler & Backup Snapshot
export interface MigrationRowIssue {
  rowNumber: number;
  indicatorCode: string;
  province: string;
  issue: string;
}

export interface MigrationProfileReport {
  timestamp: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRatioRows: number;
  piiBlockedRows: number;
  issues: MigrationRowIssue[];
  stagedRecords: MerlRecord[];
}

export interface MfaPendingAction {
  title: string;
  description: string;
  requiredRoleLabel: string;
  onVerified: () => void;
}
