import { useState } from "react";
import { X } from "lucide-react";
import { CURATED_TAGS, normalizeTags } from "@/lib/revex";

// Hybrid tag picker: curated toggle chips + free-text custom tags.
export default function TagChips({ value = [], onChange }) {
  const [custom, setCustom] = useState("");

  const set = (arr) => onChange(normalizeTags(arr));
  const toggle = (tag) => {
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    set(exists ? value.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...value, tag]);
  };
  const addCustom = () => {
    if (!custom.trim()) return;
    set([...value, custom]);
    setCustom("");
  };

  const customTags = value.filter(
    (v) => !CURATED_TAGS.some((c) => c.toLowerCase() === v.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CURATED_TAGS.map((t) => {
          const active = value.some((v) => v.toLowerCase() === t.toLowerCase());
          return (
            <button key={t} type="button" onClick={() => toggle(t)}
              className={`acid-chip ${active ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
              {t}
            </button>
          );
        })}
      </div>
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customTags.map((t) => (
            <span key={t} className="acid-chip bg-muted text-foreground inline-flex items-center gap-1">
              {t}
              <button type="button" onClick={() => toggle(t)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input className="acid-input py-1.5 text-sm flex-1" placeholder="Add a tag + Enter"
          value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <button type="button" onClick={addCustom} className="acid-btn bg-foreground text-background px-3 py-1.5 text-xs">Add</button>
      </div>
    </div>
  );
}