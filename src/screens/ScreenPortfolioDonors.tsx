import {
  BellRing,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Lock,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ZAMBIAN_PROVINCES } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import { formatUsdFromCents, formatZmwFromNgwee } from '../utils/chzUtils';

export function ScreenPortfolioDonors() {
  const experts = useChzStore((s) => s.experts);
  const projects = useChzStore((s) => s.projects);
  const grants = useChzStore((s) => s.grants);
  const calendar = useChzStore((s) => s.calendar);
  const engagements = useChzStore((s) => s.engagements);
  const activeRole = useChzStore((s) => s.activeRole);
  const hasPermission = useChzStore((s) => s.hasPermission);
  const sendCalendarReminder = useChzStore((s) => s.sendCalendarReminder);
  const addPartnerEngagement = useChzStore((s) => s.addPartnerEngagement);

  const [tab, setTab] = useState<'ws1' | 'ws2'>('ws1');
  const [partnerName, setPartnerName] = useState('');
  const [channel, setChannel] = useState('Lusaka Technical Working Group');
  const [summary, setSummary] = useState('');

  const canManageDonors = hasPermission('donorManage');

  const handleLogEngagement = (e: FormEvent) => {
    e.preventDefault();
    const res = addPartnerEngagement(partnerName, channel, summary);
    if (res.ok) {
      setPartnerName('');
      setSummary('');
    }
  };

  return (
    <section aria-labelledby="screen-portfolio-heading" className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#072A2E]/12 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B7A5C]">
            Workstreams 01 &amp; 02 · Institutional Portfolio &amp; Donor Collaboration
          </p>
          <h1
            id="screen-portfolio-heading"
            className="mt-1 font-editorial text-3xl leading-tight text-[#072A2E] sm:text-4xl lg:text-[2.75rem]"
          >
            Projects, Experts, Grants &amp; Reporting Calendar
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#3F6064]">
            Complete CHZ institutional register (integer ZMW Ngwee &amp; USD cents budget precision),
            verified 10-province district registry, donor compliance obligations, and automated
            reporting reminders.
          </p>
        </div>

        <div className="inline-flex self-start rounded-xl border border-[#072A2E]/14 bg-[#FFFFFF] p-1">
          <button
            id="ws1-tab-btn"
            type="button"
            onClick={() => setTab('ws1')}
            className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'ws1' ? 'bg-[#072A2E] text-[#F4F8F7]' : 'text-[#3F6064] hover:text-[#072A2E]'
            }`}
          >
            WS1 · Portfolio &amp; Experts
          </button>
          <button
            id="ws2-tab-btn"
            type="button"
            onClick={() => setTab('ws2')}
            className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === 'ws2' ? 'bg-[#0E6B8A] text-[#F4F8F7]' : 'text-[#3F6064] hover:text-[#072A2E]'
            }`}
          >
            WS2 · Donors &amp; Calendar
          </button>
        </div>
      </div>

      {tab === 'ws1' ? (
        <div className="space-y-6">
          {/* Active Projects, Sub-Agreements & Integer-Ngwee Budget Burn-Rate */}
          <div className="editorial-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#072A2E]/10 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#0E6B8A]" />
                <h2 className="font-editorial text-2xl">
                  Active Projects, Sub-Partners &amp; Budget Burn Rate (ZMW)
                </h2>
              </div>
              <span className="font-code text-[10.5px] text-[#3F6064]">
                MINOR-UNIT NGWEE MATH
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
              {projects.map((prj) => {
                const burnPct = Math.round((prj.spentNgwee / prj.budgetNgwee) * 100);
                return (
                  <div
                    key={prj.id}
                    className="rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-code text-[10.5px] font-semibold text-[#0B7A5C]">
                          {prj.projectCode} · {prj.agreementNumber}
                        </span>
                        <h3 className="mt-0.5 font-editorial text-xl text-[#072A2E]">{prj.title}</h3>
                        <p className="text-xs text-[#3F6064]">Sub-Partner: {prj.subPartner}</p>
                      </div>
                      <span className="rounded-full bg-[#0E6B8A]/12 px-2.5 py-0.5 font-code text-[10px] font-semibold text-[#0E6B8A]">
                        {prj.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between font-code text-[11px]">
                        <span>Burn: {formatZmwFromNgwee(prj.spentNgwee)}</span>
                        <span className="text-[#3F6064]">
                          Ceiling: {formatZmwFromNgwee(prj.budgetNgwee)} ({burnPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#072A2E]/10">
                        <div
                          className="h-full rounded-full bg-[#0E6B8A]"
                          style={{ width: `${Math.min(100, burnPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#072A2E]/8 pt-2.5 font-code text-[10px] text-[#3F6064]">
                      <span>PROVINCES: {prj.provinceCoverage.join(', ')}</span>
                      <span className="text-[#0E6B8A]">MILESTONES: {prj.milestoneProgress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CHZ Technical Expert Directory + Verified District Registry */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="editorial-surface rounded-2xl p-4 sm:p-5 lg:col-span-6">
              <div className="flex items-center gap-2 border-b border-[#072A2E]/10 pb-3">
                <Users className="h-4 w-4 text-[#0B7A5C]" />
                <h2 className="font-editorial text-2xl">CHZ Institutional &amp; Expert Directory</h2>
              </div>
              <div className="mt-3.5 space-y-3">
                {experts.map((exp) => (
                  <div
                    key={exp.id}
                    className="rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#072A2E]">{exp.name}</span>
                      <span className="rounded bg-[#0E6B8A]/12 px-2 py-0.5 font-code text-[10px] font-semibold text-[#0E6B8A]">
                        {exp.availability}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#0B7A5C]">{exp.title}</p>
                    <p className="mt-1 text-xs text-[#3F6064]">{exp.specialty}</p>
                    <p className="mt-1 font-code text-[10px] text-[#3F6064]">
                      {exp.qualifications} · Hub: {exp.provinceHub}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="editorial-surface rounded-2xl p-4 sm:p-5 lg:col-span-6">
              <div className="flex items-center gap-2 border-b border-[#072A2E]/10 pb-3">
                <Building2 className="h-4 w-4 text-[#0E6B8A]" />
                <h2 className="font-editorial text-2xl">Verified 10-Province &amp; District Register</h2>
              </div>
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {ZAMBIAN_PROVINCES.map((prov) => (
                  <div
                    key={prov.name}
                    className="rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#072A2E]">
                        {prov.name} ({prov.capital})
                      </span>
                      <span className="font-code text-[10.5px] text-[#0E6B8A]">
                        {prov.regionalHubCode} · {prov.facilitiesCount} facilities
                      </span>
                    </div>
                    <p className="mt-1 font-code text-[10px] text-[#3F6064]">
                      DISTRICTS: {prov.districts.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Donor Grant Portfolio & Obligations */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {grants.map((g) => {
              const pct = Math.round((g.disbursedUsdCents / g.awardCeilingUsdCents) * 100);
              return (
                <div key={g.id} className="editorial-surface flex flex-col justify-between rounded-2xl p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-[10.5px] font-semibold text-[#0B7A5C]">
                        {g.grantCode}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-code text-[10px] font-semibold ${
                          g.complianceStatus === 'On Track'
                            ? 'bg-[#0E6B8A]/12 text-[#0E6B8A]'
                            : 'bg-[#0B7A5C]/15 text-[#0B7A5C]'
                        }`}
                      >
                        {g.complianceStatus}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-editorial text-2xl leading-snug">{g.donorName}</h3>
                    <p className="text-xs text-[#3F6064]">{g.programme}</p>

                    <div className="mt-3 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3">
                      <div className="flex justify-between font-code text-[11px]">
                        <span>{formatUsdFromCents(g.disbursedUsdCents)}</span>
                        <span className="text-[#3F6064]">
                          / {formatUsdFromCents(g.awardCeilingUsdCents)} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#072A2E]/10">
                        <div className="h-full rounded-full bg-[#0E6B8A]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <ul className="mt-3 space-y-1.5 text-xs text-[#072A2E]">
                      {g.obligations.map((ob, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E6B8A]" />
                          <span>{ob}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Reporting Calendar & Reminders + Partner Engagement Log */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="editorial-surface rounded-2xl p-4 sm:p-5 lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[#072A2E]/10 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#0B7A5C]" />
                  <h2 className="font-editorial text-2xl">
                    Donor Reporting Calendar &amp; Automated Reminders
                  </h2>
                </div>
              </div>

              <div className="mt-3.5 space-y-2.5">
                {calendar.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-code text-[10.5px] font-semibold text-[#0B7A5C]">
                          {item.grantCode}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-code text-[9.5px] font-semibold ${
                            item.status === 'Submitted'
                              ? 'bg-[#0E6B8A]/12 text-[#0E6B8A]'
                              : item.status === 'Overdue'
                                ? 'bg-[#0B7A5C] text-[#F4F8F7]'
                                : 'bg-[#14B88A]/22 text-[#085E47]'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="font-code text-[10px] text-[#3F6064]">
                          DUE {item.dueDate}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#072A2E]">{item.deliverable}</p>
                      <p className="font-code text-[10px] text-[#3F6064]">
                        Owner: {item.ownerRole} · Reminders sent: {item.remindersSent}
                        {item.lastReminderAt ? ` (Last: ${item.lastReminderAt})` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => sendCalendarReminder(item.id)}
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        canManageDonors
                          ? 'bg-[#072A2E] text-[#F4F8F7] hover:bg-[#0B7A5C]'
                          : 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                      }`}
                    >
                      {canManageDonors ? (
                        <BellRing className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      <span>Send Reminder</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="editorial-surface rounded-2xl p-4 sm:p-5 lg:col-span-5">
              <div className="flex items-center gap-2 border-b border-[#072A2E]/10 pb-3">
                <MessageSquarePlus className="h-4 w-4 text-[#0E6B8A]" />
                <h2 className="font-editorial text-2xl">Partner Engagement History</h2>
              </div>

              <form onSubmit={handleLogEngagement} className="mt-3 space-y-2.5 rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3">
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Partner / Donor agency (e.g. Global Fund Country Team)"
                  className="w-full rounded-lg border border-[#072A2E]/15 bg-[#FFFFFF] px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="Channel (e.g. Lusaka Quarterly Review)"
                  className="w-full rounded-lg border border-[#072A2E]/15 bg-[#FFFFFF] px-3 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Key alignment decisions & action items..."
                  className="w-full rounded-lg border border-[#072A2E]/15 bg-[#FFFFFF] px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className={`w-full cursor-pointer rounded-xl py-2 text-xs font-semibold ${
                    canManageDonors
                      ? 'bg-[#0E6B8A] text-[#F4F8F7] hover:bg-[#072A2E]'
                      : 'border border-[#072A2E]/15 bg-[#E6F0EE] text-[#3F6064]'
                  }`}
                >
                  {canManageDonors
                    ? 'Record Partner Engagement'
                    : `Locked (${activeRole} lacks donorManage)`}
                </button>
              </form>

              <div className="mt-3.5 space-y-2.5">
                {engagements.map((eng) => (
                  <div key={eng.id} className="rounded-xl border border-[#072A2E]/10 bg-[#F4F8F7] p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-[#072A2E]">{eng.partner}</span>
                      <span className="font-code text-[10px] text-[#3F6064]">{eng.dateCat}</span>
                    </div>
                    <p className="mt-1 text-[#3F6064]">{eng.summary}</p>
                    <p className="mt-1 font-code text-[10px] text-[#0E6B8A]">
                      {eng.channel} · Logged by {eng.recordedBy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
