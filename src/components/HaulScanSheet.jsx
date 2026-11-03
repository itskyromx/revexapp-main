import { useState } from "react";
import { X, Loader2, Check, ChevronDown, Sparkles, Plus } from "lucide-react";
import { CATEGORY_LABELS, CONDITION_LABELS, formatPrice } from "@/lib/revex";
import TagChips from "@/components/TagChips";

const CATEGORIES = ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories", "other"];
const CONDITIONS = ["new_with_tags", "like_new", "good", "fair"];

export default function HaulScanSheet({ suggestions, loading, error, onEdit, onAdd, onAddAll, onClose }) {
  const [expanded, setExpanded] = useState(null);
  const remaining = suggestions.filter((s) => !s.added);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="border-b-[4px] border-border">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-red" />
            <span className="font-display text-lg uppercase">Detected Items</span>
          </div>
          <button onClick={onClose} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-brand-red" strokeWidth={3} />
          <p className="font-heading uppercase text-sm text-muted-foreground">Analyzing your haul…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-display uppercase text-lg">Scan failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-display uppercase text-lg">No items found</p>
          <p className="text-sm text-muted-foreground">We couldn't spot any garments in this clip — try filming the pieces closer up.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-heading uppercase">
              {suggestions.length} item{suggestions.length === 1 ? "" : "s"} found — review before adding
            </p>

            {remaining.length > 0 && (
              <button onClick={onAddAll} className="acid-btn bg-brand-red text-white w-full">
                <Plus className="w-4 h-4" /> Add all {remaining.length}
              </button>
            )}

            {suggestions.map((s) => (
              <div key={s.id} className={`acid-card p-3 ${s.added ? "opacity-60" : ""}`}>
                <button
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm truncate">{s.title || "Untitled item"}</p>
                    <p className="text-[11px] text-muted-foreground font-heading uppercase truncate">
                      {[s.brand, CATEGORY_LABELS[s.category]].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="font-display text-sm text-brand-red shrink-0">
                    {s.price ? formatPrice(s.price) : "—"}
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expanded === s.id ? "rotate-180" : ""}`} />
                </button>

                {expanded === s.id && !s.added && (
                  <div className="space-y-2 mt-3">
                    <input className="acid-input py-1.5 text-sm" placeholder="Title" value={s.title}
                      onChange={(e) => onEdit(s.id, "title", e.target.value)} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input className="acid-input py-1.5 text-sm" placeholder="Brand" value={s.brand}
                        onChange={(e) => onEdit(s.id, "brand", e.target.value)} />
                      <input className="acid-input py-1.5 text-sm" placeholder="Size" value={s.size}
                        onChange={(e) => onEdit(s.id, "size", e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => (
                        <button key={c} onClick={() => onEdit(s.id, "category", c)}
                          className={`acid-chip ${s.category === c ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
                          {CATEGORY_LABELS[c]}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select className="acid-input py-1.5 text-sm" value={s.condition}
                        onChange={(e) => onEdit(s.id, "condition", e.target.value)}>
                        {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                      </select>
                      <input className="acid-input py-1.5 text-sm" type="number" placeholder="€ Price" value={s.price}
                        onChange={(e) => onEdit(s.id, "price", e.target.value)} />
                    </div>
                    <div>
                      <span className="acid-label">Tags</span>
                      <div className="mt-1"><TagChips value={s.tags} onChange={(arr) => onEdit(s.id, "tags", arr)} /></div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onAdd(s.id)}
                  disabled={s.added}
                  className={`acid-btn w-full mt-3 py-1.5 ${s.added ? "bg-muted text-foreground" : "bg-foreground text-background"}`}
                >
                  {s.added ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add item</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t-[4px] border-border">
        <div className="max-w-md mx-auto p-4">
          <button onClick={onClose} className="acid-btn bg-muted text-foreground w-full">Done</button>
        </div>
      </div>
    </div>
  );
}