import type { AuditEvent, MerlRecord, UserRole } from '../types/chz';
import {
  canExportUnredactedSmallCells,
  computeRate,
  computeWeightedTarget,
  escapeCsvCell,
  evaluateDpaCompliance,
  formatCatTimestamp,
  sha256HexSync,
} from './chzUtils';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFormulaForExcel(val: string | number): string {
  const str = String(val);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

export interface ExportReconciliationMeta {
  recordCount: number;
  totalNumerator: number;
  totalDenominator: number;
  weightedTarget: number;
  redactedCount: number;
  checksum: string;
}

export function buildReconciliationMeta(
  records: MerlRecord[],
  role: UserRole
): ExportReconciliationMeta {
  const allowUnredacted = canExportUnredactedSmallCells(role);
  let totalNumerator = 0;
  let totalDenominator = 0;
  let redactedCount = 0;

  for (const r of records) {
    const dpa = evaluateDpaCompliance(r);
    if (!dpa.smallCellPassed && !allowUnredacted) {
      redactedCount += 1;
    } else {
      totalNumerator += r.numerator;
      totalDenominator += r.denominator;
    }
  }

  const weightedTarget = computeWeightedTarget(records);
  const checksum = sha256HexSync(
    `${records.map((r) => `${r.id}:${r.numerator}/${r.denominator}:${r.publishedVersion}`).join('|')}`
  ).slice(0, 16);

  return {
    recordCount: records.length,
    totalNumerator,
    totalDenominator,
    weightedTarget,
    redactedCount,
    checksum,
  };
}

// =============================================================================
// 1. FORMULA-SAFE CSV EXPORT (WITH DPA SMALL-CELL REDACTION)
// =============================================================================
export function buildVerifiedCsvContent(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): string {
  const allowUnredacted = canExportUnredactedSmallCells(role);
  const meta = buildReconciliationMeta(records, role);

  const headers = [
    'Record ID',
    'Version',
    'Quarter',
    'Province',
    'Programme',
    'Indicator Code',
    'Indicator Description',
    'Numerator',
    'Denominator',
    'Achieved Rate (%)',
    'Target Rate (%)',
    'Status',
    'DPA Privacy Status',
    'Locked By',
    'Locked At (CAT)',
  ];

  const rows = records.map((r) => {
    const dpa = evaluateDpaCompliance(r);
    const shouldRedact = !dpa.smallCellPassed && !allowUnredacted;
    return [
      r.id,
      r.publishedVersion,
      r.quarter,
      r.province,
      r.programme,
      r.indicatorCode,
      r.indicatorName,
      shouldRedact ? '<10 (DPA Suppressed)' : r.numerator,
      shouldRedact ? '<10 (DPA Suppressed)' : r.denominator,
      shouldRedact ? 'Suppressed' : computeRate(r.numerator, r.denominator),
      r.targetRate,
      r.status,
      dpa.passed
        ? 'CLEARED (n>=10, Zero PII)'
        : shouldRedact
          ? 'REDACTED (Zambia DPA No. 3 of 2021)'
          : 'INTERNAL_UNREDACTED (MERL/Auditor Only)',
      r.lockedBy ?? 'Pending',
      r.lockedAt ?? 'Pending',
    ];
  });

  const csvLines = [
    `# Coalition Health Zambia (CHZ) — Verified MERL Export (${scopeLabel})`,
    `# Exported: ${formatCatTimestamp()} | Role: ${role} | Mode: ${allowUnredacted ? 'INTERNAL_UNREDACTED' : 'DPA_REDACTED'} | Reconciliation Checksum: ${meta.checksum}`,
    `# Totals: Records=${meta.recordCount} | Numerator=${meta.totalNumerator} | Denominator=${meta.totalDenominator} | WeightedTarget=${meta.weightedTarget}% | RedactedSmallCells=${meta.redactedCount}`,
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  return csvLines.join('\n');
}

export function downloadVerifiedCsv(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): number {
  const content = buildVerifiedCsvContent(records, scopeLabel, role);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const slug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerDownload(blob, `chz-verified-merl-${slug}-${new Date().toISOString().slice(0, 10)}.csv`);
  return blob.size;
}

// =============================================================================
// 2. MULTI-SHEET EXCEL SPREADSHEETML (.xls — Opens natively in Excel/Calc)
// =============================================================================
export function buildExcelWorkbookXml(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): string {
  const allowUnredacted = canExportUnredactedSmallCells(role);
  const meta = buildReconciliationMeta(records, role);

  const rowXml = (cells: (string | number)[]) =>
    `<Row>${cells
      .map((c) => {
        const isNum = typeof c === 'number' && Number.isFinite(c);
        const safe = isNum ? c : escapeXml(sanitizeFormulaForExcel(c));
        return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${safe}</Data></Cell>`;
      })
      .join('')}</Row>`;

  const summaryRows = [
    rowXml(['Coalition Health Zambia (CHZ) — Verified MERL Reconciliation Workbook']),
    rowXml(['Scope', scopeLabel]),
    rowXml(['Exported (CAT)', formatCatTimestamp()]),
    rowXml(['Exporting Role', role]),
    rowXml(['Privacy Mode', allowUnredacted ? 'INTERNAL_UNREDACTED' : 'DPA_REDACTED (n>=10)']),
    rowXml(['Verified Record Count', meta.recordCount]),
    rowXml(['Reconciled Numerator Sum', meta.totalNumerator]),
    rowXml(['Reconciled Denominator Sum', meta.totalDenominator]),
    rowXml(['Denominator-Weighted Target (%)', meta.weightedTarget]),
    rowXml(['Redacted Small-Cell Rows', meta.redactedCount]),
    rowXml(['SHA-256 Reconciliation Checksum', meta.checksum]),
  ].join('');

  const recordHeader = rowXml([
    'Record ID',
    'Version',
    'Quarter',
    'Province',
    'Programme',
    'Indicator Code',
    'Numerator',
    'Denominator',
    'Achieved (%)',
    'Target (%)',
    'Status',
    'DPA Status',
  ]);

  const recordRows = records
    .map((r) => {
      const dpa = evaluateDpaCompliance(r);
      const redact = !dpa.smallCellPassed && !allowUnredacted;
      return rowXml([
        r.id,
        r.publishedVersion,
        r.quarter,
        r.province,
        r.programme,
        r.indicatorCode,
        redact ? '<10 (DPA Suppressed)' : r.numerator,
        redact ? '<10 (DPA Suppressed)' : r.denominator,
        redact ? 'Suppressed' : computeRate(r.numerator, r.denominator),
        r.targetRate,
        r.status,
        dpa.passed ? 'CLEARED' : redact ? 'REDACTED' : 'INTERNAL_UNREDACTED',
      ]);
    })
    .join('');

  const disaggHeader = rowXml([
    'Record ID',
    'Province',
    'Indicator Code',
    'District',
    'Stratum',
    'Numerator',
    'Denominator',
    'Stratum Rate (%)',
  ]);

  const disaggRows = records
    .flatMap((r) => {
      const dpa = evaluateDpaCompliance(r);
      const redact = !dpa.smallCellPassed && !allowUnredacted;
      return r.disaggregations.map((d) =>
        rowXml([
          r.id,
          r.province,
          r.indicatorCode,
          d.district,
          d.stratum,
          redact ? '<10 (Suppressed)' : d.numerator,
          redact ? '<10 (Suppressed)' : d.denominator,
          redact ? 'Suppressed' : computeRate(d.numerator, d.denominator),
        ])
      );
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Executive Summary"><Table>${summaryRows}</Table></Worksheet>
 <Worksheet ss:Name="Verified Records"><Table>${recordHeader}${recordRows}</Table></Worksheet>
 <Worksheet ss:Name="Disaggregations"><Table>${disaggHeader}${disaggRows}</Table></Worksheet>
</Workbook>`;
}

export function downloadVerifiedExcel(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): number {
  const xml = buildExcelWorkbookXml(records, scopeLabel, role);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const slug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerDownload(blob, `chz-verified-merl-${slug}-${new Date().toISOString().slice(0, 10)}.xls`);
  return blob.size;
}

// =============================================================================
// 3. EDITABLE WORD BRIEF EXPORT (.doc Wordprocessing-compatible HTML)
// =============================================================================
export function buildWordBriefHtml(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole,
  customHeading?: string,
  customNarrative?: string
): string {
  const allowUnredacted = canExportUnredactedSmallCells(role);
  const meta = buildReconciliationMeta(records, role);

  const tableRows = records
    .map((r) => {
      const dpa = evaluateDpaCompliance(r);
      const redact = !dpa.smallCellPassed && !allowUnredacted;
      return `<tr>
        <td>${escapeXml(r.id)} (${escapeXml(r.publishedVersion)})</td>
        <td>${escapeXml(r.province)}</td>
        <td>${escapeXml(r.indicatorCode)}</td>
        <td align="right">${redact ? '&lt;10 (Suppressed)' : `${r.numerator.toLocaleString()} / ${r.denominator.toLocaleString()}`}</td>
        <td align="right">${redact ? 'Suppressed' : `${computeRate(r.numerator, r.denominator)}%`}</td>
        <td align="right">${r.targetRate}%</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>CHZ Verified MERL Brief</title>
<style>
  body { font-family: Georgia, serif; color: #072A2E; margin: 28pt; }
  h1 { color: #0E6B8A; font-size: 20pt; margin-bottom: 4pt; }
  .meta { font-family: Consolas, monospace; font-size: 9pt; color: #3F6064; margin-bottom: 14pt; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9.5pt; margin-top: 12pt; }
  th { background: #072A2E; color: #F4F8F7; padding: 6pt; text-align: left; }
  td { border-bottom: 1px solid #CFE2DF; padding: 5pt 6pt; }
</style></head>
<body>
  <h1>${escapeXml(customHeading ?? `Coalition Health Zambia — Quarterly MERL Executive Brief (${scopeLabel})`)}</h1>
  <div class="meta">Generated: ${escapeXml(formatCatTimestamp())} | Role: ${escapeXml(role)} | Checksum: ${escapeXml(meta.checksum)} | Zambia DPA No. 3 of 2021 Compliant</div>
  <p>${escapeXml(customNarrative ?? 'This editable executive brief is generated directly from MERL-locked periods within the Coalition Health Zambia Sovereign MERL Platform. All totals reconcile to the verified database checksum.')}</p>
  <p><strong>Reconciled Totals:</strong> ${meta.recordCount} Verified Periods | Numerator Sum: ${meta.totalNumerator.toLocaleString()} | Denominator Sum: ${meta.totalDenominator.toLocaleString()} | Denominator-Weighted Target: ${meta.weightedTarget}%</p>
  <table>
    <thead><tr><th>Record</th><th>Province</th><th>Indicator</th><th align="right">Num / Den</th><th align="right">Achieved</th><th align="right">Target</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body></html>`;
}

export function downloadEditableWordBrief(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole,
  customHeading?: string,
  customNarrative?: string
): number {
  const html = buildWordBriefHtml(records, scopeLabel, role, customHeading, customNarrative);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const slug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerDownload(blob, `chz-merl-brief-${slug}-${new Date().toISOString().slice(0, 10)}.doc`);
  return blob.size;
}

// =============================================================================
// 4. STANDALONE BINARY PDF 1.4 GENERATOR (Zero External Dependencies)
// =============================================================================
function escapePdfText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildValidPdfContent(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): string {
  const allowUnredacted = canExportUnredactedSmallCells(role);
  const meta = buildReconciliationMeta(records, role);

  const lines: string[] = [
    `Coalition Health Zambia (CHZ) - Verified MERL Report`,
    `Scope: ${scopeLabel} | Role: ${role} | ${formatCatTimestamp()}`,
    `Reconciliation Checksum: ${meta.checksum} | Records: ${meta.recordCount} | Weighted Target: ${meta.weightedTarget}%`,
    `Zambia Data Protection Act No. 3 of 2021 (${allowUnredacted ? 'INTERNAL_UNREDACTED' : 'DPA_REDACTED'})`,
    `--------------------------------------------------------------------------------`,
    `RECORD ID           PROVINCE       CODE            NUM / DEN           RATE  TGT`,
    `--------------------------------------------------------------------------------`,
  ];

  for (const r of records.slice(0, 34)) {
    const dpa = evaluateDpaCompliance(r);
    const redact = !dpa.smallCellPassed && !allowUnredacted;
    const ratioStr = redact ? '<10 (Suppressed)' : `${r.numerator}/${r.denominator}`;
    const rateStr = redact ? 'SUPP' : `${computeRate(r.numerator, r.denominator)}%`;
    lines.push(
      `${r.id.padEnd(19)} ${r.province.slice(0, 13).padEnd(14)} ${r.indicatorCode.padEnd(15)} ${ratioStr.padEnd(19)} ${rateStr.padEnd(6)} ${r.targetRate}%`
    );
  }

  lines.push(`--------------------------------------------------------------------------------`);
  lines.push(`RECONCILED SUMS: Numerator=${meta.totalNumerator} | Denominator=${meta.totalDenominator}`);

  const streamOps = [
    'BT',
    '/F1 9 Tf',
    '36 756 Td',
    '13 TL',
    ...lines.map((line, i) => `${i === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',
    `5 0 obj << /Length ${streamOps.length} >> stream\n${streamOps}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return pdf;
}

export function downloadVerifiedPdf(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): number {
  const pdfStr = buildValidPdfContent(records, scopeLabel, role);
  const blob = new Blob([pdfStr], { type: 'application/pdf' });
  const slug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerDownload(blob, `chz-verified-merl-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  return blob.size;
}

export function estimateExportSizesKb(
  records: MerlRecord[],
  scopeLabel: string,
  role: UserRole
): { csvKb: number; excelKb: number; wordKb: number; pdfKb: number } {
  const kb = (s: string) => Math.max(1, Math.ceil(new TextEncoder().encode(s).length / 1024));
  return {
    csvKb: kb(buildVerifiedCsvContent(records, scopeLabel, role)),
    excelKb: kb(buildExcelWorkbookXml(records, scopeLabel, role)),
    wordKb: kb(buildWordBriefHtml(records, scopeLabel, role)),
    pdfKb: kb(buildValidPdfContent(records, scopeLabel, role)),
  };
}

export function downloadAuditLedgerCsv(events: AuditEvent[]): number {
  const headers = [
    'Event ID',
    'Time (CAT)',
    'Actor',
    'Role',
    'Record ID',
    'Category',
    'Action',
    'Details',
    'Prev SHA-256',
    'Chain SHA-256',
  ];
  const csvLines = [
    `# Coalition Health Zambia (CHZ) — Immutable SHA-256 Chained Audit Ledger`,
    `# Exported: ${formatCatTimestamp()} | Engineered by EMCA Consultancy & Digital Labs`,
    headers.map(escapeCsvCell).join(','),
    ...events.map((e) =>
      [
        e.id,
        e.timeCat,
        e.actor,
        e.role,
        e.recordId,
        e.category,
        e.action,
        e.details,
        e.prevHash,
        e.chainHash,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `chz-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
  return blob.size;
}
