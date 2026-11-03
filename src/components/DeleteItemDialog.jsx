import { useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export default function DeleteItemDialog({ item, onClose, onDeleted }) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deleteItem = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.rpc("delete_item", { p_item_id: item.id });
      if (invokeError) throw invokeError;
      if (data?.error || data?.ok !== true) throw new Error(data?.error || "Could not delete the item.");
      if (data.removed_items !== 1) throw new Error("This item has an order or is no longer available, so it was kept.");
      onDeleted();
    } catch (e) {
      setError(e.message || "Could not delete the item. Please try again.");
      locked.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next && !locked.current) onClose(); }}>
      <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
      <Dialog.Content
        onEscapeKeyDown={event => { if (locked.current) event.preventDefault(); }}
        onPointerDownOutside={event => { if (locked.current) event.preventDefault(); }}
        className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border-[3px] border-border bg-background p-6 shadow-lg sm:rounded-lg">
        <Dialog.Close asChild>
          <button type="button" aria-label="Close" disabled={busy}
            className="absolute right-3 top-3 p-2 text-muted-foreground hover:text-foreground disabled:opacity-60">
            <X className="h-5 w-5" />
          </button>
        </Dialog.Close>
        <div className="flex flex-col space-y-2 text-center sm:text-left">
          <Dialog.Title className="pr-10 font-display uppercase">Delete this item?</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            “{item.title}” will be removed from your profile, feed and saved lists. This cannot be undone.
          </Dialog.Description>
        </div>
        {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
        <div className="flex justify-center">
          <button onClick={deleteItem} disabled={busy} className="acid-btn bg-brand-red text-white disabled:opacity-60">
            {busy ? "Deleting…" : "Delete item"}
          </button>
        </div>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
