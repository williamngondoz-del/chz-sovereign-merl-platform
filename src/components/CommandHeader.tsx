import {
  Activity,
  BookOpen,
  Briefcase,
  ChevronDown,
  Clock,
  FilePlus2,
  Globe2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Verified,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROLE_PROFILES } from '../data/chzSeedData';
import { useChzStore } from '../store/useChzStore';
import type { ScreenId, UserRole } from '../types/chz';
import { formatCatTimestamp } from '../utils/chzUtils';
import { HeaderSparkleCanvas } from './HeaderSparkleCanvas';

const NAV_ITEMS: { id: ScreenId; code: string; label: string; shortLabel: string }[] = [
  { id: 'command', code: '01', label: 'Command & Map', shortLabel: 'Command' },
  { id: 'portfolio', code: '02', label: 'Portfolio & Donors', shortLabel: 'Portfolio' },
  { id: 'intake', code: '03', label: 'Field Intake', shortLabel: 'Intake' },
  { id: 'verification', code: '04', label: 'MERL Gate', shortLabel: 'MERL' },
  { id: 'cms', code: '05', label: 'Public CMS', shortLabel: 'CMS' },
  { id: 'knowledge', code: '06', label: 'Knowledge & Media', shortLabel: 'Library' },
  { id: 'governance', code: '07', label: 'Audit, RBAC & Migration', shortLabel: 'Audit' },
];

const ROLES: UserRole[] = [
  'Executive Director',
  'Programme Officer',
  'MERL Lead',
  'Comms & CMS Officer',
  'System Auditor',
  'IT Admin',
];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CommandHeader() {
  const activeScreen = useChzStore((s) => s.activeScreen);
  const activeRole = useChzStore((s) => s.activeRole);
  const records = useChzStore((s) => s.records);
  const auditLog = useChzStore((s) => s.auditLog);
  const isOnline = useChzStore((s) => s.isOnline);
  const sessionSecondsLeft = useChzStore((s) => s.sessionSecondsLeft);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);
  const requestRoleSwitch = useChzStore((s) => s.requestRoleSwitch);
  const setOnlineStatus = useChzStore((s) => s.setOnlineStatus);
  const syncOfflineDrafts = useChzStore((s) => s.syncOfflineDrafts);
  const tickSessionTimer = useChzStore((s) => s.tickSessionTimer);
  const resetSessionTimer = useChzStore((s) => s.resetSessionTimer);

  const [catClock, setCatClock] = useState<string>(() => formatCatTimestamp());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCatClock(formatCatTimestamp());
      tickSessionTimer();
    }, 1000);

    const onActivity = () => resetSessionTimer();
    const onOnline = () => setOnlineStatus(true);
    const onOffline = () => setOnlineStatus(false);

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [tickSessionTimer, resetSessionTimer, setOnlineStatus]);

  const pendingMerlCount = records.filter(
    (r) => r.status === 'DRAFT' || r.status === 'RETURNED'
  ).length;
  const publishedOrPendingCmsCount = records.filter(
    (r) => r.status === 'PUBLISHED' || r.status === 'REVISION_PENDING_REPUBLISH'
  ).length;
  const offlineQueuedCount = records.filter((r) => r.offlineQueued).length;
  const currentProfile = ROLE_PROFILES[activeRole];

  const getIcon = (id: ScreenId) => {
    switch (id) {
      case 'command':
        return <Globe2 className="h-3.5 w-3.5" />;
      case 'portfolio':
        return <Briefcase className="h-3.5 w-3.5" />;
      case 'intake':
        return <FilePlus2 className="h-3.5 w-3.5" />;
      case 'verification':
        return <Verified className="h-3.5 w-3.5" />;
      case 'cms':
        return <Sparkles className="h-3.5 w-3.5" />;
      case 'knowledge':
        return <BookOpen className="h-3.5 w-3.5" />;
      case 'governance':
        return <ShieldCheck className="h-3.5 w-3.5" />;
    }
  };

  const getBadge = (id: ScreenId): number | null => {
    if (id === 'verification') return pendingMerlCount;
    if (id === 'cms') return publishedOrPendingCmsCount;
    if (id === 'governance') return auditLog.length;
    return null;
  };

  return (
    <>
    <header className="relative overflow-hidden border-b border-[#14B88A]/25 bg-[#072A2E] text-[#F4F8F7]">
      <HeaderSparkleCanvas />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,138,0.16),transparent_52%),radial-gradient(ellipse_at_bottom_right,rgba(15,76,92,0.22),transparent_55%)]"
      />

      <div className="relative z-10 mx-auto max-w-[1440px] px-3 pt-3.5 pb-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <button
              type="button"
              id="chz-brand-home-btn"
              onClick={() => setActiveScreen('command')}
              className="group flex cursor-pointer items-center gap-3 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#14B88A]/45 bg-[#0A353B] shadow-inner transition-colors group-hover:border-[#14B88A]">
                <svg viewBox="0 0 40 40" className="h-6 w-6" fill="none" aria-hidden="true">
                  <circle
                    cx="20"
                    cy="20"
                    r="15"
                    stroke="#14B88A"
                    strokeWidth="1.4"
                    strokeDasharray="2.5 2"
                  />
                  <circle cx="20" cy="20" r="9.5" fill="#0E6B8A" fillOpacity="0.45" />
                  <path
                    d="M20 13V27M13 20H27"
                    stroke="#F4F8F7"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <circle cx="20" cy="20" r="2.2" fill="#F59E0B" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-editorial text-xl tracking-tight text-[#F4F8F7] sm:text-2xl">
                    Coalition Health Zambia
                  </span>
                  <span className="rounded border border-[#14B88A]/40 bg-[#14B88A]/15 px-1.5 py-0.5 font-code text-[10px] font-medium uppercase tracking-wider text-[#5EEAD4]">
                    CHZ · Sovereign MERL v2
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#F4F8F7]/65">
                  <span className="text-[#5EEAD4]">EMCA Consultancy</span> ×{' '}
                  <span className="text-[#F4F8F7]/90 font-medium">Digital Labs</span> ·
                  VibeSec Hardened
                </p>
              </div>
            </button>
          </div>

          {/* Right Controls: Connectivity + CAT Clock + Idle Timer + Role Switcher (MFA Step-Up) */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              id="connectivity-toggle-btn"
              onClick={() => {
                if (!isOnline) {
                  setOnlineStatus(true);
                  syncOfflineDrafts();
                } else {
                  setOnlineStatus(false);
                }
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-code text-[10.5px] transition-colors ${
                isOnline
                  ? 'border-[#0E6B8A]/50 bg-[#0E6B8A]/25 text-[#9BE0EE] hover:border-[#14B88A]'
                  : 'border-[#0B7A5C] bg-[#0B7A5C]/25 text-[#FDE68A]'
              }`}
              title="Toggle simulated rural 3G offline mode to test local draft queuing"
            >
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span>{isOnline ? 'ONLINE' : 'OFFLINE QUEUE'}</span>
              {offlineQueuedCount > 0 ? (
                <span className="rounded bg-[#F4F8F7] px-1 text-[9.5px] font-bold text-[#072A2E]">
                  {offlineQueuedCount}
                </span>
              ) : null}
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-[#F4F8F7]/12 bg-[#0B3A40]/80 px-3 py-1.5 sm:flex">
              <Activity className="h-3.5 w-3.5 text-[#14B88A]" />
              <span className="font-code text-[11px] text-[#F4F8F7]/90">{catClock}</span>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-xl border border-[#F4F8F7]/12 bg-[#0B3A40]/80 px-2.5 py-1.5 font-code text-[10.5px] text-[#5EEAD4]"
              title="Idle session auto-downgrade timer"
            >
              <Clock className="h-3 w-3" />
              <span>TTL {formatCountdown(sessionSecondsLeft)}</span>
            </div>

            {/* 6-Role Active Switcher with MFA Step-Up */}
            <div className="flex w-full items-center gap-2 rounded-xl border border-[#14B88A]/35 bg-[#0D4148]/90 px-2.5 py-1.5 sm:w-auto">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0E6B8A]/40 text-[#9AD6E5]">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="active-role-switcher"
                  className="block font-code text-[9px] uppercase tracking-[0.12em] text-[#14B88A]"
                >
                  RBAC · {currentProfile.requiresMfaStepUp ? 'MFA Step-Up' : 'Standard'}
                </label>
                <div className="relative flex items-center">
                  <select
                    id="active-role-switcher"
                    value={activeRole}
                    onChange={(e) => requestRoleSwitch(e.target.value as UserRole)}
                    className="w-full cursor-pointer appearance-none bg-transparent pr-5 text-xs font-semibold text-[#F4F8F7] focus:outline-none"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role} className="bg-[#072A2E] text-[#F4F8F7]">
                        {role} — {ROLE_PROFILES[role].actorName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-[#14B88A]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Screen Responsive Navigation Strip covering all 6 CHZ Proposal Workstreams */}
        <nav
          aria-label="CHZ Platform Screens"
          className="mt-3.5 flex snap-x snap-mandatory touch-pan-x items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id;
            const badge = getBadge(item.id);
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`group flex min-h-[40px] shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-[#14B88A]/70 bg-[#F4F8F7] text-[#072A2E] shadow-sm'
                    : 'border-[#F4F8F7]/10 bg-[#0B3A40]/65 text-[#F4F8F7]/80 hover:border-[#14B88A]/40 hover:bg-[#0F4B53] hover:text-[#F4F8F7]'
                }`}
              >
                <span
                  className={`font-code text-[10px] font-semibold ${
                    isActive ? 'text-[#0B7A5C]' : 'text-[#14B88A]/80'
                  }`}
                >
                  {item.code}
                </span>
                <span className={isActive ? 'text-[#0E6B8A]' : 'text-[#F4F8F7]/70'}>
                  {getIcon(item.id)}
                </span>
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">{item.shortLabel}</span>
                {badge !== null ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-code text-[10px] font-semibold ${
                      isActive
                        ? 'bg-[#072A2E] text-[#F4F8F7]'
                        : item.id === 'verification' && badge > 0
                          ? 'bg-[#0B7A5C] text-[#F4F8F7]'
                          : 'bg-[#F4F8F7]/12 text-[#F4F8F7]/90'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </header>

    {/* Mobile Thumb-Friendly Bottom Quick-Nav Dock (hidden on tablet/PC) */}
    <nav
      aria-label="Mobile Quick Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#14B88A]/30 bg-[#072A2E]/96 px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-7 gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id;
          const badge = getBadge(item.id);
          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              onClick={() => {
                setActiveScreen(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[9.5px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#14B88A]/20 text-[#5EEAD4]'
                  : 'text-[#F4F8F7]/70 hover:text-[#F4F8F7]'
              }`}
            >
              {getIcon(item.id)}
              <span className="max-w-full truncate leading-none">{item.shortLabel}</span>
              {badge !== null && badge > 0 && item.id === 'verification' ? (
                <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#F59E0B] px-1 font-code text-[8px] font-bold text-[#072A2E]">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
