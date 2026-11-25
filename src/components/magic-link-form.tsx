"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { sendMagicLink, type MagicLinkState } from "@/lib/auth-actions";
import { fr } from "@/i18n/fr";
import { SubmitButton } from "./submit-button";

const initial: MagicLinkState = { status: "idle" };

export function MagicLinkForm({ next, defaultEmail = "" }: { next: string; defaultEmail?: string }) {
  const [state, action] = useActionState(sendMagicLink, initial);
  const t = fr.login;

  if (state.status === "sent") {
    return (
      <div className="flex gap-3 rounded-xl bg-accent-soft p-4 text-sm text-accent-dark">
        <MailCheck className="size-5 shrink-0" aria-hidden />
        <p>{t.sent}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          {t.email}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} className="input" />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message === "invalid_email" ? t.invalidEmail : fr.common.error}</p>
      )}
      <SubmitButton className="btn-primary w-full">{t.submit}</SubmitButton>
    </form>
  );
}
