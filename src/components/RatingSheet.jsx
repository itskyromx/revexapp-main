import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Loader2, Star } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { StarPicker } from "@/components/StarRating";

const QUICK_TAGS = ["As described", "Fast shipping", "Great communication", "Well packaged"];

/** Buyer rates the seller of a completed order. */
export default function RatingSheet({ order, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (t) =>
    setTags((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));

  const submit = async () => {
    if (!rating) {
      setError("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await supabase.functions.invoke("submitReview", { body: {
        orderId: order.id,
        rating,
        comment: comment.trim(),
        tags,
      }});
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        onSubmitted?.(res.data?.review);
        onClose?.();
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not save your rating.");
    }
    setBusy(false);
  };

  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl border-t-[3px] border-border bg-card p-5 pb-6 max-h-[90vh] overflow-y-auto"
      >
        <SheetTitle className="font-display text-xl uppercase flex items-center gap-2">
          <Star className="w-5 h-5" /> Rate seller
        </SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">
          How was {order?.seller_name || "the seller"} on {order?.item_title || "this order"}?
        </SheetDescription>

        <div className="mt-4">
          <StarPicker value={rating} onChange={setRating} />
          <p className="text-center text-xs text-muted-foreground mt-1">
            {rating ? `${rating} of 5` : "Tap to rate"}
          </p>
        </div>

        <div className="mt-4">
          <span className="acid-label">What went well</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {QUICK_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`acid-chip ${tags.includes(t) ? "bg-brand-red text-white" : "bg-muted text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="acid-label">Review (optional)</span>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell other shoppers how it went"
            className="acid-input mt-1 resize-none text-sm"
          />
        </div>

        {error && <p className="text-xs text-brand-red mt-3">{error}</p>}

        <button onClick={submit} disabled={busy} className="acid-btn bg-brand-red text-white w-full mt-4 disabled:opacity-50">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Submit rating"}
        </button>
        <button onClick={onClose} disabled={busy} className="acid-btn bg-muted text-foreground w-full mt-2">
          Not now
        </button>
      </SheetContent>
    </Sheet>
  );
}