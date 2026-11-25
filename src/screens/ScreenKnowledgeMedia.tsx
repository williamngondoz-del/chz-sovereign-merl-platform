import {
  Archive,
  BookOpen,
  CheckCircle2,
  FileDown,
  Lock,
  PlusCircle,
  Search,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { PROGRAMMES } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import type { KnowledgeAsset, ProgrammeName } from '../types/chz';
import { downloadEditableWordBrief, downloadVerifiedPdf } from '../utils/exportEngine';

export function ScreenKnowledgeMedia() {
  const assets = useChzStore((s) => s.knowledgeAssets);
  const records = useChzStore((s) => s.records);
  const activeRole = useChzStore((s) => s.activeRole);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const toggleKnowledgePublish = useChzStore((s) => s.toggleKnowledgePublish);
  const toggleKnowledgeArchive = useChzStore((s) => s.toggleKnowledgeArchive);
  const addKnowledgeAsset = useChzStore((s) => s.addKnowledgeAsset);
  const logExportEvent = useChzStore((s) => s.logExportEvent);

  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Editable Factsheet / Policy Brief Template Builder state
  const [briefTitle, setBriefTitle] = useState(
    'Coalition Health Zambia — Q3/Q4 Verified National Impact Brief'
  );
  const [briefProgramme, setBriefProgramme] = useState<ProgrammeName | 'ALL'>('ALL');
  const [briefNarrative, setBriefNarrative] = useState(
    'This executive policy brief synthesizes MERL-locked, Zambia Data Protection Act No. 3 of 2021 compliant aggregate indicators across supported districts. All counts reconcile directly to the CHZ SHA-256 verification ledger.'
  );

  // Quick Asset Registration form
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('eSCMIS, Q4-2026, Lusaka');
  const [newAttribution, setNewAttribution] = useState('CHZ MERL Directorate');
  const [newConsent, setNewConsent] = useState<KnowledgeAsset['consentStatus']>('Valid');

  const canManage = hasPermission('knowledgeManage');

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => (showArchived ? true : !a.archived))
      .filter(
        (a) =>
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.attribution.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.assetType.toLowerCase().includes(q)
      );
  }, [assets, query, showArchived]);

  const briefRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          (r.status === 'LOCKED' || r.status === 'PUBLISHED') &&
          (briefProgramme === 'ALL' || r.programme === briefProgramme)
      ),
    [records, briefProgramme]
  );

  const handleRegisterAsset = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = addKnowledgeAsset({
      title: newTitle.trim(),
      assetType: 'Policy Brief',
      programme: 'eSCMIS Supply Chain',
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      attribution: newAttribution.trim() || 'Coalition Health Zambia',
      consentStatus: newConsent,
      consentExpiresOn: newConsent === 'Valid' ? '2027-12-31' : newConsent === 'Expired' ? '2026-09-01' : undefined,
      rightsScope:
        newConsent === 'Expired'
          ? 'Expired Consent — Public Sharing Blocked'
          : 'CHZ Verified Attribution & Media Release',
      version: 'v1.0',
      sizeKb: 540,
    });
    if (res.ok) setNewTitle('');
  };

  const handleExportBrief = (mode: 'WORD' | 'PDF') => {
    const scope = briefProgramme === 'ALL' ? 'National Brief' : briefProgramme;
    const bytes =
      mode === 'WORD'
        ? downloadEditableWordBrief(briefRecords, scope, activeRole, briefTitle, briefNarrative)
        : downloadVerifiedPdf(briefRecords, scope, activeRole);
    logExportEvent(mode, `Template:${scope}`, briefRecords.length, bytes);
  };

  return (
    <section aria-labelledby="screen-knowledge-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Workstream 04 · Searchable Repository, Consent Governance &amp; Brief Templates
          </p>
          <h1
            id="screen-knowledge-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            Knowledge &amp; Media Library
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Tag-searchable institutional library enforcing media attribution, version control,
            archiving, automated expired-consent blocking, and live MERL-backed editable Factsheet
            / Brief exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#3F6064]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, tag, author..."
              className="w-full rounded-xl border border-[#072A2E]/15 bg-[#FFFFFF] py-2 pr-3 pl-8 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold ${
              showArchived
                ? 'border-[#072A2E] bg-[#072A2E] text-[#F4F8F7]'
                : 'border-[#072A2E]/15 bg-[#FFFFFF] text-[#3F6064]'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Searchable Media & Document Vault */}
        <div className="space-y-4 xl:col-span-7">
          {filteredAssets.map((asset) => {
            const expired = asset.consentStatus === 'Expired';
            return (
              <article
                key={asset.id}
                className={`editorial-surface rounded-2xl p-4 sm:p-5 ${
                  expired ? 'border-[#0B7A5C]/45 bg-[#FFFBEB]' : ''
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 font-code text-[10px]">
                      <span className="font-semibold text-[#072A2E]">{asset.id}</span>
                      <span className="rounded bg-[#F4F8F7] px-2 py-0.5 font-semibold text-[#0B7A5C] border border-[#072A2E]/10">
                        {asset.assetType}
                      </span>
                      <span className="text-[#0E6B8A] font-semibold">{asset.version}</span>
                      <span className="text-[#3F6064]">{asset.sizeKb.toLocaleString()} KB</span>
                      {asset.archived ? (
                        <span className="rounded-full bg-[#072A2E]/12 px-2 py-0.5 text-[#3F6064]">
                          ARCHIVED
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 font-editorial text-2xl leading-snug">{asset.title}</h2>
                    <p className="text-xs text-[#3F6064]">
                      Attribution: <strong className="text-[#072A2E]">{asset.attribution}</strong> ·{' '}
                      {asset.rightsScope}
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2.5 py-1 font-code text-[10px] font-semibold ${
                      expired
                        ? 'bg-[#0B7A5C]/15 text-[#0B7A5C]'
                        : 'bg-[#0E6B8A]/12 text-[#0E6B8A]'
                    }`}
                  >
                    {expired ? (
                      <ShieldAlert className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    <span>
                      Consent: {asset.consentStatus}
                      {asset.consentExpiresOn ? ` (${asset.consentExpiresOn})` : ''}
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#072A2E]/8 pt-3">
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md border border-[#072A2E]/10 bg-[#F4F8F7] px-2 py-0.5 font-code text-[10px] text-[#3F6064]"
                      >
                        <Tag className="h-2.5 w-2.5 text-[#14B88A]" />
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleKnowledgePublish(asset.id)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        !canManage
                          ? 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                          : expired
                            ? 'border border-[#0B7A5C] bg-[#0B7A5C]/12 text-[#B45309]'
                            : asset.publishedToPublic
                              ? 'border border-[#0B7A5C]/40 bg-[#0B7A5C]/10 text-[#0B7A5C] hover:bg-[#0B7A5C] hover:text-[#F4F8F7]'
                              : 'bg-[#0E6B8A] text-[#F4F8F7] hover:bg-[#072A2E]'
                      }`}
                    >
                      {!canManage ? <Lock className="h-3 w-3" /> : null}
                      <span>
                        {asset.publishedToPublic
                          ? 'Withdraw Public'
                          : expired
                            ? 'Blocked (Expired Consent)'
                            : 'Approve for Public'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleKnowledgeArchive(asset.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#072A2E]/16 bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#072A2E] hover:border-[#0B7A5C]"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>{asset.archived ? 'Restore' : 'Archive'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Right: Editable Factsheet / Brief Template Builder + Register Asset */}
        <div className="space-y-5 xl:col-span-5">
          <div className="espresso-surface rounded-2xl p-5 text-[#F4F8F7]">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#14B88A]" />
              <p className="font-code text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]">
                Editable Factsheet &amp; Brief Template Engine
              </p>
            </div>
            <h2 className="mt-1 font-editorial text-2xl">
              Generate Reconciled Brief from Locked MERL Data
            </h2>

            <div className="mt-3.5 space-y-3 text-xs">
              <div>
                <label className="block font-code text-[10px] uppercase text-[#14B88A]">
                  Brief Title
                </label>
                <input
                  type="text"
                  value={briefTitle}
                  onChange={(e) => setBriefTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#14B88A]/35 bg-[#041A1D] px-3 py-2 text-xs text-[#F4F8F7]"
                />
              </div>

              <div>
                <label className="block font-code text-[10px] uppercase text-[#14B88A]">
                  Inject Live Locked Indicators From
                </label>
                <select
                  value={briefProgramme}
                  onChange={(e) => setBriefProgramme(e.target.value as ProgrammeName | 'ALL')}
                  className="mt-1 w-full rounded-xl border border-[#14B88A]/35 bg-[#041A1D] px-3 py-2 text-xs text-[#F4F8F7]"
                >
                  <option value="ALL">All Programmes ({records.filter((r) => r.status === 'LOCKED' || r.status === 'PUBLISHED').length} locked)</option>
                  {PROGRAMMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-code text-[10px] uppercase text-[#14B88A]">
                  Editable Executive Narrative
                </label>
                <textarea
                  rows={3}
                  value={briefNarrative}
                  onChange={(e) => setBriefNarrative(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#14B88A]/35 bg-[#041A1D] px-3 py-2 text-xs text-[#F4F8F7]"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExportBrief('WORD')}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#14B88A] px-3.5 py-2.5 text-xs font-semibold text-[#072A2E] hover:bg-[#F4F8F7]"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Export Editable Word (.doc)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportBrief('PDF')}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#F4F8F7]/25 bg-[#0E6B8A] px-3.5 py-2.5 text-xs font-semibold text-[#F4F8F7] hover:bg-[#0B7A5C]"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Export Print PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Register New Asset */}
          <form onSubmit={handleRegisterAsset} className="editorial-surface space-y-3 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-[#0B7A5C]" />
              <h3 className="font-editorial text-2xl">Register Library Asset</h3>
            </div>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Document or media title..."
              className="w-full rounded-xl border border-[#072A2E]/15 bg-[#F4F8F7] px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={newAttribution}
                onChange={(e) => setNewAttribution(e.target.value)}
                placeholder="Attribution / Author"
                className="w-full rounded-xl border border-[#072A2E]/15 bg-[#F4F8F7] px-3 py-2 text-xs"
              />
              <select
                value={newConsent}
                onChange={(e) => setNewConsent(e.target.value as KnowledgeAsset['consentStatus'])}
                className="w-full rounded-xl border border-[#072A2E]/15 bg-[#F4F8F7] px-3 py-2 text-xs"
              >
                <option value="Valid">Consent: Valid (2027)</option>
                <option value="Expired">Consent: Expired (Test Block)</option>
                <option value="Not Required">Consent: Aggregate / N/A</option>
              </select>
            </div>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Comma-separated tags..."
              className="w-full rounded-xl border border-[#072A2E]/15 bg-[#F4F8F7] px-3 py-2 font-code text-xs"
            />
            <button
              type="submit"
              className={`w-full cursor-pointer rounded-xl py-2.5 text-xs font-semibold ${
                canManage
                  ? 'bg-[#072A2E] text-[#F4F8F7] hover:bg-[#0B7A5C]'
                  : 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
              }`}
            >
              {canManage ? 'Add Versioned Asset to Library' : `Locked (${activeRole} lacks knowledgeManage)`}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
