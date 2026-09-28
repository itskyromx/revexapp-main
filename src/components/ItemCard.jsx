import { Bookmark } from "lucide-react";
import { CONDITION_LABELS } from "@/lib/styld";
import { formatPrice } from "@/lib/styld";

export default function ItemCard({ item, onClick, saved = false, onToggleSave }) {
  return (
    <div className="relative w-full">
      <button
        onClick={onClick}
        className="acid-card-sm w-full text-left overflow-hidden flex flex-col active:translate-x-[2px] active:translate-y-[2px] transition-transform"
      >
        <div className="aspect-square bg-muted border-b-2 border-border overflow-hidden relative">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground font-display text-3xl">STYLD</div>
          )}
          {item.status !== "available" && (
            <span className="absolute top-1.5 left-1.5 sticker bg-black text-white text-[9px] px-2 py-0.5 uppercase">
              {item.status}
            </span>
          )}
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between gap-1">
            <span className="font-heading font-bold text-sm truncate">{item.brand || "Brand"}</span>
            <span className="acid-chip bg-muted">{item.size || "—"}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.title}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="font-display text-base">{formatPrice(item.price)}</span>
            <span className="text-[9px] font-heading uppercase text-muted-foreground">{CONDITION_LABELS[item.condition]}</span>
          </div>
        </div>
      </button>

      {onToggleSave && (
        <button
          onClick={onToggleSave}
          aria-label={saved ? "Remove from saved" : "Save for later"}
          className="absolute top-1.5 right-1.5 z-10 sticker bg-black/70 border-white/30 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <Bookmark className={`w-4 h-4 ${saved ? "fill-brand-yellow text-brand-yellow" : "text-white"}`} />
        </button>
      )}
    </div>
  );
}