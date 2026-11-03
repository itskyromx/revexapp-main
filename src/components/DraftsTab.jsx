import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import DraftCard from "@/components/DraftCard";
import { Loader2, Plus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DraftsTab() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: list } = await supabase.from('drafts').select('*')
          .eq('created_by_id', user.id).order('updated_at', { ascending: false }).limit(20);
        if (!cancelled) setDrafts(list || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await supabase.from('drafts').delete().eq('id', pending.id);
      setDrafts((ds) => ds.filter((d) => d.id !== pending.id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
      setPending(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 grid place-items-center py-10">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="acid-card p-6 mt-4 text-center">
        <p className="font-heading font-bold uppercase text-sm">No unfinished posts</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a post and it saves itself as you go.
        </p>
        <button onClick={() => navigate("/upload")} className="acid-btn bg-brand-red text-white mt-4">
          <Plus className="w-4 h-4" /> Start a post
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 mt-4">
        {drafts.map((d) => (
          <DraftCard
            key={d.id}
            draft={d}
            onOpen={(id) => navigate(`/upload/${id}`)}
            onDelete={(dr) => setPending(dr)}
          />
        ))}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.haul_title?.trim() ? `"${pending.haul_title.trim()}"` : "This draft"} and
              everything in it — media, details and items — will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}