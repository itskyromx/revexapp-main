import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Deleting a post asks what happens to the items listed inside it — anything
 * already sold or in a live order is always kept for order history.
 */
export default function DeletePostDialog({ post, onClose, onDeleted }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (removeItems) => {
    setBusy(removeItems ? "items" : "keep");
    setError("");
    try {
      const res = await supabase.functions.invoke("deletePost", { body: { postId: post.id, removeItems } });
      if (res.data?.error) {
        setError(res.data.error);
        setBusy("");
        return;
      }
      onDeleted();
    } catch (e) {
      setError(e.message || "Could not delete the item.");
      setBusy("");
    }
  };

  return (
    <AlertDialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <AlertDialogContent className="border-[3px] border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase">Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            "{post.haul_title}" disappears from feeds, your profile and anyone's saved list.
            Sold items and live orders are always kept.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <button
            onClick={() => run(true)}
            disabled={!!busy}
            className="acid-btn bg-brand-red text-white w-full disabled:opacity-60"
          >
            {busy === "items" ? "Deleting…" : "Delete item"}
          </button>
        </div>

        {error && <p className="text-xs text-brand-red">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}