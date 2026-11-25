"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { sendMagicLink, verifyEmailCode, type CodeState, type MagicLinkState } from "@/lib/auth-actions";
import { fr } from "@/i18n/fr";
import { SubmitButton } from "./submit-button";

const initial: MagicLinkState = { status: "idle" };
const initialCode: CodeState = { status: "idle" };

function CodeForm({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const [state, action] = useActionState(verifyEmailCode, initialCode);
  const t = fr.login;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-brand-soft p-4 text-sm text-brand-dark">
        <MailCheck className="size-5 shrink-0" aria-hidden />
        <p>{t.sent}</p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label htmlFor="code" className="label">
          {t.codeLabel}
        </label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,9}" maxLength={9} required placeholder="123456" className="input text-center text-xl font-semibold tracking-[.4em]" />
        {state.status === "error" && <p className="text-sm text-danger">{t.invalidCode}</p>}
        <SubmitButton className="btn-primary w-full">{t.codeSubmit}</SubmitButton>
      </form>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-semibold text-brand hover:underline">
        {t.changeEmail}
      </button>
    </div>
  );
}

export function MagicLinkForm({ next, defaultEmail = "" }: { next: string; defaultEmail?: string }) {
  const [state, action] = useActionState(sendMagicLink, initial);
  const [reset, setReset] = useState(0);
  const t = fr.login;

  if (state.status === "sent" && state.email && reset === 0) {
    return <CodeForm email={state.email} next={next} onBack={() => setReset((r) => r + 1)} />;
  }

  return (
    <form action={(fd) => { setReset(0); return action(fd); }} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          {t.email}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email ?? defaultEmail} className="input" />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-danger">{state.message === "invalid_email" ? t.invalidEmail : state.message === "rate_limited" ? t.rateLimited : fr.common.error}</p>
      )}
      <SubmitButton className="btn-primary w-full">{t.submit}</SubmitButton>
    </form>
  );
}
