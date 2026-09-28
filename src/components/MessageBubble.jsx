import useLongPress from "@/hooks/useLongPress";

/**
 * One chat bubble. Holding it opens the copy/delete sheet; `status` renders the
 * small Delivered / Seen line under the sender's most recent message.
 */
export default function MessageBubble({ message, mine, status, onHold }) {
  const press = useLongPress(() => onHold(message));

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        {...press}
        className={`max-w-[75%] px-3 py-2 border-[3px] border-border msg-shadow select-none touch-pan-y ${
          mine ? "bg-brand-red text-white" : "bg-card text-foreground"
        }`}
      >
        <p className="text-sm">{message.text}</p>
      </div>
      {status && (
        <span className="mt-1 mr-1 text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
          {status}
        </span>
      )}
    </div>
  );
}