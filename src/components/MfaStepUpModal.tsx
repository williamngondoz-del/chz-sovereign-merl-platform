import { Fingerprint, KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useChzStore } from '../store/useChzStore';
import type { MfaPendingAction } from '../types/chz';

function MfaStepUpDialog({ mfaModal }: { mfaModal: MfaPendingAction }) {
  const mfaFailedAttempts = useChzStore((s) => s.mfaFailedAttempts);
  const mfaLockoutUntil = useChzStore((s) => s.mfaLockoutUntil);
  const verifyMfaCode = useChzStore((s) => s.verifyMfaCode);
  const cancelMfaChallenge = useChzStore((s) => s.cancelMfaChallenge);

  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setErrorMsg('MFA challenge cannot be bypassed via Escape. Verify or click Cancel.');
      }
    };
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, []);

  useEffect(() => {
    if (mfaLockoutUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [mfaLockoutUntil]);

  const lockoutSeconds = Math.max(0, Math.ceil((mfaLockoutUntil - nowMs) / 1000));
  const isLockedOut = lockoutSeconds > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = verifyMfaCode(code);
    if (!res.ok) {
      setErrorMsg(res.reason ?? 'Verification failed.');
      setNowMs(Date.now());
    }
  };

  const handleHardwareKey = () => {
    const res = verifyMfaCode('FIDO2-VERIFIED');
    if (!res.ok) {
      setErrorMsg(res.reason ?? 'Hardware key challenge blocked during cooldown.');
      setNowMs(Date.now());
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#072A2E]/75 p-4 backdrop-blur-xs"
    >
      <div className="espresso-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl p-5 text-[#F4F8F7] shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#14B88A]/50 bg-[#14B88A]/15 text-[#5EEAD4]">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <p className="font-code text-[10px] font-semibold uppercase tracking-[0.16em] text-[#14B88A]">
              VibeSec Privileged Step-Up Gate
            </p>
            <h2 id="mfa-modal-title" className="mt-0.5 font-editorial text-2xl leading-tight">
              {mfaModal.title}
            </h2>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#F4F8F7]/80">{mfaModal.description}</p>

        <div className="mt-3 rounded-xl border border-[#0E6B8A]/45 bg-[#0E6B8A]/20 px-3 py-2 font-code text-[10.5px] text-[#B7E8F2]">
          EVALUATOR DEMO CREDENTIALS: TOTP <strong className="text-[#F4F8F7]">260410</strong> · or
          tap FIDO2 Hardware Key below (3 wrong tries trigger 30s lockout).
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="mfa-totp-input"
              className="block font-code text-[10px] uppercase tracking-wider text-[#5EEAD4]"
            >
              6-Digit Authenticator TOTP Code
            </label>
            <input
              id="mfa-totp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={isLockedOut}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="260410"
              className="mt-1.5 w-full rounded-xl border border-[#14B88A]/40 bg-[#041A1D] px-3.5 py-2.5 font-code text-base tracking-[0.28em] text-[#F4F8F7] placeholder:text-[#F4F8F7]/30 focus:border-[#14B88A] focus:outline-none disabled:opacity-45"
            />
          </div>

          {errorMsg || isLockedOut ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#0B7A5C] bg-[#0B7A5C]/20 px-3 py-2 text-xs text-[#FDE68A]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isLockedOut
                  ? `Brute-force cooldown active: retry in ${lockoutSeconds}s.`
                  : errorMsg}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              id="mfa-verify-totp-btn"
              type="submit"
              disabled={isLockedOut || code.trim().length < 6}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0E6B8A] px-4 py-2.5 text-xs font-semibold text-[#F4F8F7] transition-colors hover:bg-[#0B7A5C] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Verify TOTP</span>
            </button>

            <button
              id="mfa-verify-fido2-btn"
              type="button"
              disabled={isLockedOut}
              onClick={handleHardwareKey}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#14B88A]/60 bg-[#14B88A]/20 px-4 py-2.5 text-xs font-semibold text-[#99F6E4] transition-colors hover:bg-[#14B88A] hover:text-[#072A2E] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Tap FIDO2 Key</span>
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between border-t border-[#F4F8F7]/12 pt-3 text-[11px] text-[#F4F8F7]/65">
          <span className="font-code">FAILED ATTEMPTS: {mfaFailedAttempts}/3</span>
          <button
            id="mfa-cancel-btn"
            type="button"
            onClick={cancelMfaChallenge}
            className="cursor-pointer rounded-lg border border-[#F4F8F7]/20 px-3 py-1 text-xs font-medium text-[#F4F8F7]/80 hover:border-[#F4F8F7]/45 hover:text-[#F4F8F7]"
          >
            Cancel Step-Up
          </button>
        </div>
      </div>
    </div>
  );
}

export function MfaStepUpModal() {
  const mfaModal = useChzStore((s) => s.mfaModal);
  if (!mfaModal) return null;
  return <MfaStepUpDialog key={mfaModal.title} mfaModal={mfaModal} />;
}
