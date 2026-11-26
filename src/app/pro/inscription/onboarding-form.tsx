"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { SubmitButton } from "@/components/submit-button";
import { CATEGORIES, GROUPS, getCategory, normalizeText, type LocationMode } from "@/config/categories";
import { fr } from "@/i18n/fr";
import { createBusiness, type OnboardingState } from "./actions";

const t = fr.onboarding;

export function OnboardingForm({ defaults }: { defaults: { name: string; city: string; email: string; category: string | null } }) {
  const [state, action] = useActionState(createBusiness, {} as OnboardingState);
  const [category, setCategory] = useState<string | null>(defaults.category);
  const [filter, setFilter] = useState("");
  const cat = getCategory(category);
  const [modes, setModes] = useState<LocationMode[]>(cat?.modes ?? ["on_site"]);

  const filtered = useMemo(() => {
    const q = normalizeText(filter);
    return q ? CATEGORIES.filter((c) => normalizeText(`${c.label} ${c.keywords.join(" ")}`).includes(q)) : CATEGORIES;
  }, [filter]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="category" value={category ?? ""} />
      <div>
        <p className="label">{t.category}</p>
        {cat ? (
          <div className="flex items-center justify-between rounded-lg border border-brand bg-brand-softer px-3.5 py-3">
            <span className="flex items-center gap-2.5 font-semibold">
              <CategoryIcon name={cat.icon} className="size-5 text-brand" /> {cat.label}
            </span>
            <button type="button" onClick={() => setCategory(null)} className="text-sm font-semibold text-brand hover:underline">
              {fr.common.edit}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-line">
            <label className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-ink-soft" aria-hidden />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.categoryPlaceholder} className="w-full py-2.5 outline-none" />
            </label>
            <div className="max-h-72 overflow-y-auto p-2">
              {GROUPS.map((g) => {
                const cats = filtered.filter((c) => c.group === g.slug);
                if (!cats.length) return null;
                return (
                  <div key={g.slug} className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold text-ink-soft">{g.label}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {cats.map((c) => (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => {
                            setCategory(c.slug);
                            setModes(c.modes);
                          }}
                          className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-brand-softer"
                        >
                          <CategoryIcon name={c.icon} className="size-4 text-brand" /> {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {cat && (
        <>
          <div>
            <label className="label" htmlFor="name">{t.name}</label>
            <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={defaults.name} className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="email">{t.email}</label>
              <input id="email" name="email" type="email" required defaultValue={defaults.email} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">{t.phone}</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="label" htmlFor="address">{t.address}</label>
              <input id="address" name="address" required minLength={5} autoComplete="street-address" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="city">{t.city}</label>
              <input id="city" name="city" required defaultValue={defaults.city} className="input" />
            </div>
          </div>
          <fieldset>
            <legend className="label">{t.modes}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["on_site", "at_home", "online"] as const).map((m) => {
                const on = modes.includes(m);
                return (
                  <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${on ? "border-brand bg-brand-softer text-brand" : "border-line"}`}>
                    <input
                      type="checkbox"
                      name="modes"
                      value={m}
                      checked={on}
                      onChange={() => setModes((prev) => (on ? prev.filter((x) => x !== m) : [...prev, m]))}
                      className="sr-only"
                    />
                    <span className={`grid size-4 place-items-center rounded border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>{on && <Check className="size-3" aria-hidden />}</span>
                    {fr.modes[m]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="rounded-lg bg-canvas p-3 text-sm text-ink-soft">
            Nous créons pour vous : {cat.seed.map((s) => s[0]).join(", ")}
            {cat.variantLabel ? ` — tarifs selon « ${cat.variantLabel.toLowerCase()} »` : ""}.
          </p>
          {state.error && <p className="text-sm text-danger">{state.error === "geocode" ? t.geocodeFailed : fr.common.error}</p>}
          <SubmitButton className="btn-primary w-full py-3">{t.submit}</SubmitButton>
        </>
      )}
    </form>
  );
}
