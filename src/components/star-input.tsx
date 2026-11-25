"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function StarInput({ name, defaultValue = 5 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex justify-center gap-1" onMouseLeave={() => setHover(null)}>
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => setValue(n)} onMouseEnter={() => setHover(n)} aria-label={`${n}/5`} aria-pressed={value === n}>
          <Star className={`size-9 ${n <= shown ? "fill-sun text-sun" : "text-line"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
