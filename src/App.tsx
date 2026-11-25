import { Component, type ComponentType, type ReactNode, lazy, Suspense } from 'react';
import { AmbientMotionBackdrop } from './components/AmbientMotionBackdrop';
import { CommandHeader } from './components/CommandHeader';
import { MfaStepUpModal } from './components/MfaStepUpModal';
import { ToastStack } from './components/ToastStack';
import { useChzStore } from './store/useChzStore';

function lazyWithRetry<T extends ComponentType<Record<string, never>>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch {
      await new Promise((r) => setTimeout(r, 700));
      return importer();
    }
  });
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Module failed to load.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="editorial-surface mx-auto my-8 max-w-lg rounded-2xl p-6 text-center">
          <p className="font-code text-[11px] font-semibold uppercase tracking-wider text-[#0B7A5C]">
            CHZ Platform Recovery Guard
          </p>
          <h2 className="mt-2 font-editorial text-2xl text-[#072A2E]">
            Unable to load module cleanly
          </h2>
          <p className="mt-2 text-xs text-[#3F6064]">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flash-sheen-btn mt-4 cursor-pointer rounded-xl bg-[#072A2E] px-4 py-2.5 text-xs font-semibold text-[#F4F8F7] hover:bg-[#0B7A5C]"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Code-split every screen with retry-hardened React.lazy for Zambian 3G & Vercel Edge reliability
const Screen1ExecutiveCommand = lazyWithRetry(() =>
  import('./screens/Screen1ExecutiveCommand').then((m) => ({ default: m.Screen1ExecutiveCommand }))
);
const ScreenPortfolioDonors = lazyWithRetry(() =>
  import('./screens/ScreenPortfolioDonors').then((m) => ({ default: m.ScreenPortfolioDonors }))
);
const Screen2FieldIntake = lazyWithRetry(() =>
  import('./screens/Screen2FieldIntake').then((m) => ({ default: m.Screen2FieldIntake }))
);
const Screen3MerlVerification = lazyWithRetry(() =>
  import('./screens/Screen3MerlVerification').then((m) => ({ default: m.Screen3MerlVerification }))
);
const Screen4PublicCms = lazyWithRetry(() =>
  import('./screens/Screen4PublicCms').then((m) => ({ default: m.Screen4PublicCms }))
);
const ScreenKnowledgeMedia = lazyWithRetry(() =>
  import('./screens/ScreenKnowledgeMedia').then((m) => ({ default: m.ScreenKnowledgeMedia }))
);
const Screen5GovernancePlan = lazyWithRetry(() =>
  import('./screens/Screen5GovernancePlan').then((m) => ({ default: m.Screen5GovernancePlan }))
);

function ScreenLoadingShell() {
  return (
    <div className="editorial-surface flex min-h-[320px] items-center justify-center rounded-2xl p-8 text-xs text-[#3F6064]">
      Loading CHZ Sovereign MERL module…
    </div>
  );
}

export function App() {
  const activeScreen = useChzStore((s) => s.activeScreen);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);
  const auditCount = useChzStore((s) => s.auditLog.length);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#F4F8F7] text-[#072A2E]">
      {/* REA 4-Layer Ambient Orbital & Particle Backdrop */}
      <AmbientMotionBackdrop variant="page" />

      <div className="relative z-20">
        <CommandHeader />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AppErrorBoundary>
          <Suspense fallback={<ScreenLoadingShell />}>
            {activeScreen === 'command' && <Screen1ExecutiveCommand />}
            {activeScreen === 'portfolio' && <ScreenPortfolioDonors />}
            {activeScreen === 'intake' && <Screen2FieldIntake />}
            {activeScreen === 'verification' && <Screen3MerlVerification />}
            {activeScreen === 'cms' && <Screen4PublicCms />}
            {activeScreen === 'knowledge' && <ScreenKnowledgeMedia />}
            {activeScreen === 'governance' && <Screen5GovernancePlan />}
          </Suspense>
        </AppErrorBoundary>
      </main>

      <footer className="relative z-10 mt-8 border-t border-[#072A2E]/12 bg-[#E6F0EE]/85 pb-20 backdrop-blur-xs md:pb-0">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-3 py-5 text-xs text-[#3F6064] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="space-y-0.5">
            <p className="font-semibold text-[#072A2E]">
              Coalition Health Zambia (CHZ) · Sovereign MERL &amp; Integrated Programme Platform
            </p>
            <p className="text-[11px]">
              Prepared by <strong className="text-[#072A2E]">EMCA Consultancy</strong> &amp;{' '}
              <strong className="text-[#072A2E]">Digital Labs</strong> · All 6 Proposal Workstreams
              · Zambia DPA No. 3 of 2021 &amp; VibeSec Hardened.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-code text-[10.5px]">
            <button
              type="button"
              onClick={() => setActiveScreen('governance')}
              className="flash-sheen-btn cursor-pointer rounded-lg border border-[#072A2E]/15 bg-[#FFFFFF] px-2.5 py-1 text-[#0E6B8A] hover:border-[#0E6B8A]"
            >
              SHA-256 AUDIT EVENTS: {auditCount}
            </button>
            <span className="text-[#3F6064]">AFRICA/LUSAKA (CAT)</span>
          </div>
        </div>
      </footer>

      <MfaStepUpModal />
      <ToastStack />
    </div>
  );
}

export default App;
