import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Copy, Trash2 } from "lucide-react";

/**
 * Mini sheet shown after holding a chat message. Delete is offered only on your
 * own messages — nobody can remove someone else's words.
 */
export default function MessageActionSheet({ message, mine, onCopy, onDelete, onClose }) {
  return (
    <Sheet open={!!message} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl border-t-[3px] border-border bg-card p-0 pb-3 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Message options</SheetTitle>
        <SheetDescription className="sr-only">Copy or delete this message.</SheetDescription>
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        <div className="px-2 pt-3">
          <button
            onClick={onCopy}
            className="w-full flex items-center gap-3 px-3 py-3.5 font-heading font-bold uppercase text-sm text-foreground active:bg-muted"
          >
            <Copy className="w-5 h-5" />
            Copy
          </button>
          {mine && (
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-3 px-3 py-3.5 font-heading font-bold uppercase text-sm text-brand-red active:bg-muted"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}