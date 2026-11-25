"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { fr } from "@/i18n/fr";
import { createStudio, type OnboardingState } from "./actions";

const t = fr.onboarding;
const initial: OnboardingState = {};

export function OnboardingForm({ defaults }: { defaults: { name: string; city: string; email: string } }) {
  const [state, action] = useActionState(createStudio, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">
          {t.studioName}
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={defaults.name} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">
            {t.email}
          </label>
          <input id="email" name="email" type="email" required defaultValue={defaults.email} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            {t.phone}
          </label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">
          {t.address}
        </label>
        <input id="address" name="address" required minLength={5} autoComplete="street-address" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="city">
          {t.city}
        </label>
        <input id="city" name="city" required defaultValue={defaults.city} className="input" />
      </div>
      <fieldset>
        <legend className="label">{t.serviceMode}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["workshop", "mobile", "both"] as const).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="service_mode" value={mode} defaultChecked={mode === "both"} className="accent-[#0F766E]" />
              {fr.serviceModes[mode]}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && (
        <p className="text-sm text-red-600">{state.error === "geocode" ? t.geocodeFailed : fr.common.error}</p>
      )}
      <p className="text-xs text-slate-500">{t.includes}</p>
      <SubmitButton className="btn-primary w-full py-3">{t.submit}</SubmitButton>
    </form>
  );
}
