import { useRef, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

export default function DeleteItemDialog({ item, onClose, onDeleted }) {
  const locked = useRef(false);
  const confirmButton = useRef(null);
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
    <AlertDialog.Root open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
      <AlertDialog.Content onOpenAutoFocus={event => { event.preventDefault(); confirmButton.current?.focus(); }}
        className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border-[3px] border-border bg-background p-6 shadow-lg sm:rounded-lg">
        <div className="flex flex-col space-y-2 text-center sm:text-left">
          <AlertDialog.Title className="font-display uppercase">Delete this item?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            “{item.title}” will be removed from your profile, feed and saved lists. This cannot be undone.
          </AlertDialog.Description>
        </div>
        {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
        <div className="flex justify-end">
          <button ref={confirmButton} onClick={deleteItem} disabled={busy} className="acid-btn bg-brand-red text-white disabled:opacity-60">
            {busy ? "Deleting…" : "Delete item"}
          </button>
        </div>
      </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
