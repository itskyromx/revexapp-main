import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_WORD = "DELETE";

export default function DeleteAccountCard() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await supabase.functions.invoke("deleteAccount", { body: { confirm: CONFIRM_WORD } });
      if (res.data?.error) {
        setError(res.data.error);
        setBusy(false);
        return;
      }
      await logout(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="acid-card p-4 space-y-3">
      <span className="font-heading font-bold uppercase text-sm block">Delete account</span>
      <p className="text-xs text-muted-foreground">
        Permanently removes your profile, posts, listings, offers and messages. This can't be undone.
      </p>
      <button
        onClick={() => { setWord(""); setError(""); setOpen(true); }}
        className="acid-btn bg-brand-red text-white w-full">
        <Trash2 className="w-4 h-4" /> Delete my account
      </button>

      <AlertDialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your profile, posts, listings, offers and messages will be erased for good. Type {CONFIRM_WORD} to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            className="acid-input"
            placeholder={CONFIRM_WORD}
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
          {error && <p className="text-xs text-brand-red">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || word !== CONFIRM_WORD}
              onClick={(e) => { e.preventDefault(); remove(); }}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}