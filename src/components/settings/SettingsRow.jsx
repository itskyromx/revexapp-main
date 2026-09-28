import { ChevronRight } from "lucide-react";

/** One tappable row in the Settings list. */
export default function SettingsRow({ icon: Icon, label, hint, onClick }) {
  return (
    <button onClick={onClick} className="acid-card-sm w-full p-3 flex items-center gap-3 text-left">
      <span className="w-9 h-9 border-2 border-border flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-heading font-bold uppercase text-sm block">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground block truncate">{hint}</span>}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" />
    </button>
  );
}