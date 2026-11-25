"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { fr } from "@/i18n/fr";
import { saveProfile, type ProfileState } from "../actions";

export function ProfileForm({ defaults }: { defaults: { full_name: string; phone: string; default_address: string } }) {
  const [state, action] = useActionState(saveProfile, {} as ProfileState);
  const t = fr.account;
  return (
    <form action={action} className="card max-w-xl space-y-4">
      <div>
        <label className="label" htmlFor="full_name">{t.fullName}</label>
        <input id="full_name" name="full_name" defaultValue={defaults.full_name} autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.phone}</label>
        <input id="phone" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="default_address">{t.defaultAddress}</label>
        <input id="default_address" name="default_address" defaultValue={defaults.default_address} autoComplete="street-address" className="input" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>{fr.common.save}</SubmitButton>
        {state.saved && <span className="text-sm font-semibold text-success">{t.saved}</span>}
      </div>
    </form>
  );
}
