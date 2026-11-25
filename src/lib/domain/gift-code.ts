/** Code de carte cadeau normalisé : XXXX-XXXX-XXXX, majuscules, tolère espaces et tirets à la saisie. */
export function formatGiftCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return clean.match(/.{1,4}/g)?.join("-") ?? "";
}

export function isGiftCode(value: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}
