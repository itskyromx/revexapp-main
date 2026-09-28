/** A labelled on/off row used by the privacy controls. */
export default function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="acid-card-sm w-full p-3 flex items-center gap-3 text-left disabled:opacity-50">
      <span className="min-w-0 flex-1">
        <span className="font-heading font-bold uppercase text-sm block">{label}</span>
        {description && <span className="text-[11px] text-muted-foreground block mt-0.5">{description}</span>}
      </span>
      <span
        className={`w-12 h-7 rounded-full border-2 border-border flex items-center transition-colors px-0.5 shrink-0 ${
          checked ? "bg-brand-red justify-end" : "bg-muted justify-start"
        }`}>
        <span className="w-5 h-5 rounded-full bg-card" />
      </span>
    </button>
  );
}