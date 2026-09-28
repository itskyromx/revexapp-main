import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Pencil, Rocket, Trash2 } from "lucide-react";

/** Options a creator has on their own post: edit it, boost it, or delete it. */
export default function PostOwnerMenu({ open, onEdit, onBoost, onDelete, onClose }) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl border-t-[3px] border-border bg-card p-0 pb-3 [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Post options</SheetTitle>
        <SheetDescription className="sr-only">Edit, boost or delete your post.</SheetDescription>
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        <div className="px-2 pt-3">
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-3 px-3 py-3.5 font-heading font-bold uppercase text-sm text-foreground active:bg-muted"
          >
            <Pencil className="w-5 h-5" />
            Edit post
          </button>
          <button
            onClick={onBoost}
            className="w-full flex items-center gap-3 px-3 py-3.5 font-heading font-bold uppercase text-sm text-foreground active:bg-muted"
          >
            <Rocket className="w-5 h-5" />
            Boost post
          </button>
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-3 py-3.5 font-heading font-bold uppercase text-sm text-brand-red active:bg-muted"
          >
            <Trash2 className="w-5 h-5" />
            Delete post
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}