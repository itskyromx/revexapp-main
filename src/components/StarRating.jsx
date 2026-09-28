import { Star } from "lucide-react";

/** Read-only star row. */
export default function StarRating({ value = 0, size = 16, className = "" }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= filled ? "fill-brand-red text-brand-red" : "text-muted-foreground"}
        />
      ))}
    </span>
  );
}

/** Tappable star row used in the rating sheet. */
export function StarPicker({ value = 0, onChange, size = 38 }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            strokeWidth={2.2}
            className={n <= value ? "fill-brand-red text-brand-red" : "text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
}