import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Image } from "@/components/ui/image";
import BottomNav from "@/components/BottomNav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, ShieldAlert, Check, XCircle, Trash2, User as UserIcon } from "lucide-react";

const REASON_LABELS = {
  spam: "Spam",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  misleading: "Misleading",
  other: "Other",
};

const RULES = [
  "Community guidelines",
  "Spam",
  "Nudity",
  "Harassment",
  "Counterfeit",
  "Other",
];

const STATUS_STYLES = {
  open: "bg-brand-red text-white",
  reviewed: "bg-muted text-foreground",
  dismissed: "bg-muted text-muted-foreground",
  actioned: "bg-foreground text-background",
};

export default function Reports() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useCurrentUser();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [rule, setRule] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (userLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: list } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
        if (!cancelled) setReports(list || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, userLoading]);

  const setStatus = async (report, status) => {
    setBusy(true);
    try {
      await supabase.from('reports').update({ status }).eq('id', report.id);
      setReports((rs) => rs.map((r) => (r.id === report.id ? { ...r, status } : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const openRemove = (report) => {
    setRule("");
    setPending(report);
  };

  const removeHaul = async () => {
    if (!pending || !rule) return;
    const report = pending;
    setBusy(true);
    try {
      const { data: items } = await supabase.from('items').select('*').eq('post_id', report.post_id);
      for (const it of (items || [])) {
        await supabase.from('items').delete().eq('id', it.id).then(() => {});
      }
      await supabase.from('posts').delete().eq('id', report.post_id).then(() => {});
      await supabase.from('reports').update({ status: "actioned", removal_rule: rule }).eq('id', report.id);

      if (report.creator_id) {
        // In-app notice on the creator's profile
        await supabase.from('warnings').insert({
          user_id: report.creator_id,
          post_id: report.post_id,
          haul_title: report.haul_title || "",
          rule,
          dismissed: false,
        }).then(() => {});

        // Email + push, naming the haul and the rule
        await supabase.functions.invoke("sendNotification", { body: {
          recipientId: report.creator_id,
          title: "Your haul was removed",
          content:
            `Hi ${report.creator_name || "there"},\n\n` +
            `Your haul "${report.haul_title || "Untitled haul"}" has been removed from Styld after a review by our team. ` +
            `It was found to break our rules — ${rule}.\n\n` +
            `Repeated violations can lead to your account being restricted, so please review our community guidelines before posting again.\n\n` +
            `— The Styld team`,
        }}).catch(() => {});
      }

      setReports((rs) => rs.map((r) => (r.id === report.id ? { ...r, status: "actioned" } : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const openCount = reports.filter((r) => r.status === "open").length;
  const sorted = [...reports].sort(
    (a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1)
  );

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-6">
        <div className="acid-card p-6 text-center max-w-sm">
          <ShieldAlert className="w-8 h-8 mx-auto" />
          <p className="font-display uppercase text-lg mt-2">Admins only</p>
          <p className="text-sm text-muted-foreground mt-1">
            This page is only available to app admins.
          </p>
          <button onClick={() => navigate("/")} className="acid-btn bg-foreground text-background mt-4">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} aria-label="Back"
            className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-display text-lg uppercase">Reports</span>
          {openCount > 0 && (
            <span className="ml-auto acid-chip bg-brand-red text-white">{openCount} open</span>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="acid-card p-6 text-center mt-4">
            <ShieldAlert className="w-7 h-7 mx-auto text-muted-foreground" />
            <p className="font-heading font-bold uppercase text-sm mt-2">Nothing flagged</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reported posts and users will show up here for review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r) => (
              <div key={r.id} className="acid-card p-3">
                <div className="flex gap-3">
                  {r.target_type === "user" ? (
                    <div className="w-16 h-20 shrink-0 border-2 border-border bg-muted flex items-center justify-center">
                      <UserIcon className="w-7 h-7 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="w-16 h-20 shrink-0 border-2 border-border overflow-hidden bg-muted">
                      <Image src={r.haul_thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display uppercase text-sm truncate">
                      {r.target_type === "user"
                        ? r.reported_user_name || "Unknown user"
                        : r.haul_title || "Untitled haul"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.target_type === "user" ? "Reported user" : `by ${r.creator_name || "Unknown"}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="acid-chip bg-brand-red text-white">{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className={`acid-chip ${STATUS_STYLES[r.status] || "bg-muted text-foreground"}`}>{r.status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                      Reported by {r.reporter_name || "someone"}
                    </p>
                    {r.note && (
                      <p className="text-xs mt-1.5 border-l-2 border-border pl-2 italic">{r.note}</p>
                    )}
                  </div>
                </div>

                {r.status === "open" && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setStatus(r, "reviewed")} disabled={busy}
                      className="acid-btn bg-muted text-foreground flex-1 py-1.5 px-2 text-[10px]">
                      <Check className="w-4 h-4" /> Reviewed
                    </button>
                    <button onClick={() => setStatus(r, "dismissed")} disabled={busy}
                      className="acid-btn bg-muted text-foreground flex-1 py-1.5 px-2 text-[10px]">
                      <XCircle className="w-4 h-4" /> Dismiss
                    </button>
                    {r.target_type !== "user" && (
                      <button onClick={() => openRemove(r)} disabled={busy}
                        className="acid-btn bg-brand-red text-white flex-1 py-1.5 px-2 text-[10px]">
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent className="border-[3px] border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">Remove this haul?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pending?.haul_title || "This haul"}" and its items will be deleted, and{" "}
              {pending?.creator_name || "the creator"} will be warned by email, push and an in-app
              notice explaining the rule they broke. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div>
            <span className="acid-label">Rule broken</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {RULES.map((r) => (
                <button key={r} onClick={() => setRule(r)}
                  className={`acid-chip ${rule === r ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeHaul} disabled={busy || !rule}
              className="bg-brand-red text-white border-[3px] border-border font-display uppercase">
              {busy ? "Removing…" : "Remove haul"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}