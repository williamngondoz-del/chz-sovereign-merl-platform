import type {
  AuditEvent,
  DisaggregationRow,
  MerlRecord,
  UserRole,
} from '../types/chz';

/**
 * Formats current time in Central Africa Time (Africa/Lusaka, UTC+2).
 */
export function formatCatTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} CAT`;
}

export function formatCatShort(date: Date = new Date()): string {
  return formatCatTimestamp(date).replace(/:\d{2} CAT$/, ' CAT');
}

export function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * Denominator-weighted target rate (eliminates invalid unweighted average-of-percentages).
 */
export function computeWeightedTarget(records: Pick<MerlRecord, 'targetRate' | 'denominator'>[]): number {
  const totalDen = records.reduce((sum, r) => sum + (r.denominator > 0 ? r.denominator : 0), 0);
  if (totalDen <= 0) return 0;
  const weightedSum = records.reduce(
    (sum, r) => sum + r.targetRate * (r.denominator > 0 ? r.denominator : 0),
    0
  );
  return Number((weightedSum / totalDen).toFixed(1));
}

export function bumpMinorVersion(version: string): string {
  const match = /^v(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return 'v1.1';
  const major = Number(match[1]);
  const minor = Number(match[2]) + 1;
  return `v${major}.${minor}`;
}

// =============================================================================
// REAL FIPS 180-4 SHA-256 (Synchronous for chain verification + Web Crypto for Files)
// =============================================================================
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

export async function sha256FileBytes(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const fallbackText = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 65536)));
  return sha256HexSync(`${file.name}:${file.size}:${fallbackText}`);
}

export const AUDIT_GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

export function computeAuditEventHash(
  prevHash: string,
  payload: Pick<AuditEvent, 'id' | 'timeCat' | 'actor' | 'role' | 'recordId' | 'action' | 'details'>
): string {
  const canonical = [
    prevHash,
    payload.id,
    payload.timeCat,
    payload.actor,
    payload.role,
    payload.recordId,
    payload.action,
    payload.details,
  ].join('|');
  return sha256HexSync(canonical);
}

export interface AuditChainVerificationResult {
  valid: boolean;
  total: number;
  verifiedCount: number;
  brokenIds: string[];
}

/**
 * Recomputes every SHA-256 link chronologically from oldest (genesis) to newest.
 */
export function verifyAuditChain(eventsNewestFirst: AuditEvent[]): AuditChainVerificationResult {
  const chronological = [...eventsNewestFirst].reverse();
  const brokenIds: string[] = [];
  let expectedPrev = AUDIT_GENESIS_HASH;

  for (const evt of chronological) {
    const expectedHash = computeAuditEventHash(expectedPrev, evt);
    if (evt.prevHash !== expectedPrev || evt.chainHash !== expectedHash) {
      brokenIds.push(evt.id);
    }
    expectedPrev = evt.chainHash;
  }

  return {
    valid: brokenIds.length === 0,
    total: chronological.length,
    verifiedCount: chronological.length - brokenIds.length,
    brokenIds,
  };
}

// =============================================================================
// ZAMBIA DATA PROTECTION ACT NO. 3 OF 2021 — AUTOMATED PII & SMALL-CELL ENGINE
// =============================================================================
export interface PiiScanResult {
  hasPii: boolean;
  findings: string[];
}

const ZAMBIA_PII_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'Zambian NRC Number', regex: /\b\d{6}\/\d{2}\/\d\b/ },
  { label: 'Zambian Mobile Phone', regex: /(?:\+260|(?<!\d)0)(?:9[567]|7[567])\d{7}\b/ },
  { label: 'Email Address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  {
    label: 'Patient Identifier Marker',
    regex: /\b(?:patient\s*name|patient\s*id|art\s*no\.?|smartcare\s*id|dob\s*:|nrc\s*:)/i,
  },
];

export function scanForZambianPii(...fields: (string | undefined)[]): PiiScanResult {
  const combined = fields.filter(Boolean).join(' \n ');
  const findings: string[] = [];
  for (const rule of ZAMBIA_PII_PATTERNS) {
    if (rule.regex.test(combined)) {
      findings.push(rule.label);
    }
  }
  return {
    hasPii: findings.length > 0,
    findings,
  };
}

export interface DpaComplianceResult {
  passed: boolean;
  smallCellPassed: boolean;
  zeroPiiPassed: boolean;
  piiFindings: string[];
  merlLockedPassed: boolean;
  reason: string;
}

export function evaluateDpaCompliance(record: MerlRecord): DpaComplianceResult {
  const smallCellPassed = record.numerator >= 10 && record.denominator >= 10;
  const piiScan = scanForZambianPii(
    record.fieldNotes,
    record.merlNotes,
    record.evidence.name,
    record.indicatorName
  );
  const zeroPiiPassed = !piiScan.hasPii;
  const merlLockedPassed =
    record.status === 'LOCKED' ||
    record.status === 'PUBLISHED' ||
    record.status === 'REVISION_PENDING_REPUBLISH';

  if (!zeroPiiPassed) {
    return {
      passed: false,
      smallCellPassed,
      zeroPiiPassed: false,
      piiFindings: piiScan.findings,
      merlLockedPassed,
      reason: `Blocked under Zambia DPA No. 3 of 2021: potential personal data detected (${piiScan.findings.join(', ')}). Strip PII before publication.`,
    };
  }

  if (!merlLockedPassed) {
    return {
      passed: false,
      smallCellPassed,
      zeroPiiPassed: true,
      piiFindings: [],
      merlLockedPassed: false,
      reason: 'Awaiting MERL period lock before public eligibility.',
    };
  }

  if (!smallCellPassed) {
    return {
      passed: false,
      smallCellPassed: false,
      zeroPiiPassed: true,
      piiFindings: [],
      merlLockedPassed: true,
      reason: `Suppressed under Zambia Data Protection Act No. 3 of 2021: cell size (n=${Math.min(record.numerator, record.denominator)}) is below minimum aggregate disclosure threshold (n >= 10).`,
    };
  }

  return {
    passed: true,
    smallCellPassed: true,
    zeroPiiPassed: true,
    piiFindings: [],
    merlLockedPassed: true,
    reason: 'Cleared for aggregate public factsheet disclosure (n >= 10, PII scan clean, MERL locked).',
  };
}

// =============================================================================
// DISAGGREGATION RECONCILIATION VALIDATION (CHZ GATE 2)
// =============================================================================
export interface DisaggregationValidation {
  valid: boolean;
  sumNumerator: number;
  sumDenominator: number;
  error: string | null;
}

export function validateDisaggregations(
  totalNumerator: number,
  totalDenominator: number,
  rows: DisaggregationRow[]
): DisaggregationValidation {
  if (rows.length === 0) {
    return {
      valid: false,
      sumNumerator: 0,
      sumDenominator: 0,
      error: 'At least one district/stratum disaggregation row is required.',
    };
  }

  let sumNumerator = 0;
  let sumDenominator = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.numerator) || !Number.isInteger(row.denominator)) {
      return {
        valid: false,
        sumNumerator,
        sumDenominator,
        error: `Disaggregation "${row.district} (${row.stratum})" must use whole integer counts.`,
      };
    }
    if (row.numerator < 0 || row.denominator <= 0 || row.numerator > row.denominator) {
      return {
        valid: false,
        sumNumerator,
        sumDenominator,
        error: `Invalid disaggregation ratio in ${row.district} (${row.stratum}): ${row.numerator}/${row.denominator}.`,
      };
    }
    sumNumerator += row.numerator;
    sumDenominator += row.denominator;
  }

  if (sumNumerator !== totalNumerator || sumDenominator !== totalDenominator) {
    return {
      valid: false,
      sumNumerator,
      sumDenominator,
      error: `Disaggregation sum mismatch: strata total ${sumNumerator.toLocaleString()}/${sumDenominator.toLocaleString()} must exactly equal headline ${totalNumerator.toLocaleString()}/${totalDenominator.toLocaleString()}.`,
    };
  }

  return { valid: true, sumNumerator, sumDenominator, error: null };
}

// =============================================================================
// VIBESEC FORMULA-SAFE CSV SANITIZATION
// =============================================================================
export function escapeCsvCell(value: string | number): string {
  let str = String(value);
  // Neutralize Excel/Calc CSV formula injection (VibeSec Rule #3)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function canExportUnredactedSmallCells(role: UserRole): boolean {
  return role === 'MERL Lead' || role === 'System Auditor';
}

export function formatZmwFromNgwee(ngwee: number): string {
  const kwacha = Math.round(ngwee / 100);
  return `ZMW ${kwacha.toLocaleString()}`;
}

export function formatUsdFromCents(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `USD ${dollars.toLocaleString()}`;
}
