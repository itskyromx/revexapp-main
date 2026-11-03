import { useRef } from "react";
import useLongPress from "@/hooks/useLongPress";
import { Bookmark } from "lucide-react";
import { CONDITION_LABELS } from "@/lib/revex";
import { formatPrice } from "@/lib/revex";

export default function ItemCard({ item, onClick, saved = false, onToggleSave = undefined, onLongPress = undefined }) {
  const held = useRef(false);
  const press = useLongPress(() => { held.current = true; onLongPress?.(); }, { delay: 1700 });
  return (
    <div className="relative w-full">
      <button
        {...(onLongPress ? press : {})}
        onPointerDown={onLongPress ? event => { held.current = false; press.onPointerDown(event); } : undefined}
        onClick={event => { if (held.current) { held.current = false; event.preventDefault(); return; } onClick?.(event); }}
        style={onLongPress ? { WebkitTouchCallout: "none", userSelect: "none" } : undefined}
        onKeyDown={onLongPress ? event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); onLongPress(); } } : undefined}
        className="acid-card-sm w-full text-left overflow-hidden flex flex-col active:translate-x-[2px] active:translate-y-[2px] transition-transform"
      >
        <div className="aspect-square bg-muted border-b-2 border-border overflow-hidden relative">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} draggable={false} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground font-display text-3xl">REVEX</div>
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

      {item.is_archived ? (
        <span className="absolute top-1.5 right-1.5 z-10 sticker bg-black/80 text-white border-white/30 px-2 py-1 text-[10px] font-heading uppercase">
          archived
        </span>
      ) : onToggleSave && (
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
