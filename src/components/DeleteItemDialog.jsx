import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DeleteItemDialog({ item, post, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deleteItem = async () => {
    setBusy(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("deletePost", {
        body: { postId: post.id, removeItems: true },
      });
      if (invokeError) throw invokeError;
      if (data?.error || data?.ok !== true) throw new Error(data?.error || "Could not delete the item.");
      if (data.removed_items !== 1) throw new Error("This item has an order or is no longer available, so it was kept.");
      onDeleted();
    } catch (e) {
      setError(e.message || "Could not delete the item. Please try again.");
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <AlertDialogContent className="border-[3px] border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase">Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            “{item.title}” and its feed post will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <button onClick={deleteItem} disabled={busy} className="acid-btn bg-brand-red text-white disabled:opacity-60">
            {busy ? "Deleting…" : "Delete item"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
