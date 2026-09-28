import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { X, Flag, Check } from "lucide-react";

const REASONS = [
  { key: "harassment", label: "Harassment" },
  { key: "spam", label: "Spam" },
  { key: "inappropriate", label: "Inappropriate" },
  { key: "misleading", label: "Misleading" },
  { key: "other", label: "Other" },
];

export default function ReportUserSheet({ targetId, name, me, onClose }) {
  const [reason, setReason] = useState("harassment");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const displayName = name || "this user";

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const { error } = await supabase.from('reports').insert({
        target_type: "user",
        reported_user_id: targetId,
        reported_user_name: name || "User",
        reporter_id: me.id,
        reporter_name: me.full_name || me.email,
        reason,
        note: note.trim(),
        status: "open",
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't send the report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md acid-card bg-card p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-brand-red" />
          <p className="font-display uppercase text-base">Report user</p>
          <button onClick={onClose} aria-label="Close" className="ml-auto sticker bg-card w-8 h-8 rounded-full flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-5 text-center">
            <Check className="w-8 h-8 mx-auto text-brand-red" />
            <p className="font-heading font-bold uppercase text-sm mt-2">Report sent</p>
            <p className="text-xs text-muted-foreground mt-1">
              Thanks — our team will review {displayName}'s account.
            </p>
            <button onClick={onClose} className="acid-btn bg-foreground text-background mt-4">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-1.5">
              Tell us what's wrong with {displayName}. Reports go to our moderation team.
            </p>

            <div className="mt-4">
              <span className="acid-label">Reason</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setReason(r.key)}
                    className={`acid-chip ${reason === r.key ? "bg-brand-red text-white" : "bg-card text-foreground"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <span className="acid-label">What happened? (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add any details that would help us review."
                className="acid-input mt-1.5 resize-none"
              />
            </div>

            {error && <p className="text-xs text-brand-red mt-2">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="acid-btn w-full mt-4 bg-brand-red text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}