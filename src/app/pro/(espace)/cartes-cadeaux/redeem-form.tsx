"use client";

import { useActionState } from "react";
import { CheckCircle2, ScanLine } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { redeemGiftCard, type RedeemState } from "../actions";

const initial: RedeemState = { status: "idle" };

export function RedeemForm() {
  const [state, action] = useActionState(redeemGiftCard, initial);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="gift-code" className="label">
        Code de la carte
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="gift-code" name="code" required autoComplete="off" autoCapitalize="characters" placeholder="ABCD-EFGH-JKLM" className="input font-mono text-lg uppercase tracking-widest" />
        <SubmitButton>
          <ScanLine className="size-4" aria-hidden /> Valider
        </SubmitButton>
      </div>
      {state.status === "ok" && (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden /> {state.message}
        </p>
      )}
      {state.status === "error" && <p className="text-sm font-semibold text-danger">{state.message}</p>}
    </form>
  );
}
