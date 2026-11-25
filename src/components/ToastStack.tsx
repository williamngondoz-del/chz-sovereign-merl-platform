import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useChzStore } from '../store/useChzStore';
import type { ToastItem } from '../types/chz';

export function ToastStack() {
  const toasts = useChzStore((s) => s.toasts);
  const dismissToast = useChzStore((s) => s.dismissToast);
  const setActiveScreen = useChzStore((s) => s.setActiveScreen);

  if (toasts.length === 0) return null;

  const toneStyles: Record<ToastItem['tone'], string> = {
    teal: 'border-[#0E6B8A]/40 bg-[#072A2E] text-[#F4F8F7]',
    copper: 'border-[#14B88A]/55 bg-[#072A2E] text-[#F4F8F7]',
    espresso: 'border-[#14B88A]/35 bg-[#072A2E] text-[#F4F8F7]',
    warning: 'border-[#F59E0B] bg-[#3A2206] text-[#F4F8F7]',
  };

  const renderIcon = (tone: ToastItem['tone']) => {
    if (tone === 'warning') return <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />;
    if (tone === 'teal') return <CheckCircle2 className="h-4 w-4 text-[#6CCAD9]" />;
    return <Info className="h-4 w-4 text-[#14B88A]" />;
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-20 left-3 z-50 flex flex-col items-end gap-2 sm:right-5 sm:left-auto sm:w-[390px] md:bottom-5"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`animate-toast-in pointer-events-auto w-full rounded-2xl border p-3.5 shadow-2xl ${toneStyles[toast.tone]}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{renderIcon(toast.tone)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-[#F4F8F7]">{toast.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#F4F8F7]/75">{toast.message}</p>
              {toast.actionLabel && toast.actionScreen ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveScreen(toast.actionScreen!);
                    dismissToast(toast.id);
                  }}
                  className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-[#14B88A]/50 bg-[#14B88A]/15 px-2.5 py-1 text-[11px] font-semibold text-[#99F6E4] transition-colors hover:bg-[#14B88A]/30"
                >
                  {toast.actionLabel} →
                </button>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 cursor-pointer rounded-md p-1 text-[#F4F8F7]/55 transition-colors hover:bg-[#F4F8F7]/10 hover:text-[#F4F8F7]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
