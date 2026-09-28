import { Trash2, Video as VideoIcon } from "lucide-react";
import { timeAgo } from "@/lib/styld";

export default function DraftCard({ draft, onOpen, onDelete }) {
  const media = draft.media || [];
  const cover = media[0];
  const filled = (draft.items || []).filter(
    (it) => (it.title || "").trim() || it.price || it.image_url
  );
  const title = (draft.haul_title || "").trim();

  return (
    <div className="acid-card-sm bg-card p-2 flex items-center gap-3">
      <button
        onClick={() => onOpen(draft.id)}
        className="w-16 h-20 shrink-0 border-2 border-border overflow-hidden bg-black relative"
      >
        {cover?.type === "video" ? (
          <video src={cover.url} className="w-full h-full object-cover" muted playsInline />
        ) : cover?.url ? (
          <img src={cover.url} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full grid-bg bg-muted" />
        )}
        {cover?.type === "video" && (
          <VideoIcon className="w-3.5 h-3.5 text-white absolute bottom-1 right-1 drop-shadow" />
        )}
      </button>

      <button onClick={() => onOpen(draft.id)} className="min-w-0 flex-1 text-left">
        <p className="font-heading font-bold text-sm truncate">{title || "Untitled post"}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {filled.length} {filled.length === 1 ? "item" : "items"} · edited {timeAgo(draft.updated_date)} ago
        </p>
        <span className="acid-chip bg-muted mt-1.5">Draft</span>
      </button>

      <button
        onClick={() => onDelete(draft)}
        aria-label="Delete draft"
        className="sticker bg-brand-red text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}