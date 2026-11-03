import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Loader2, Rocket, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BOOST_PACKAGES, formatEuro, perDay } from "@/lib/boost";
import { isEmbedded } from "@/lib/payments";

/**
 * Boost packages for a post. Picking one hands off to Stripe — the post is
 * pinned to the top of the For You feed once the payment clears.
 */
export default function BoostSheet({ post, onClose }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const start = async (pkg) => {
    if (isEmbedded()) {
      setError("Boost only works from the published app — open it in a new tab to pay.");
      return;
    }
    setBusy(pkg.id);
    setError("");
    try {
      const res = await supabase.functions.invoke("boostPost", { body: {
        action: "start",
        postId: post.id,
        packageId: pkg.id,
        origin: window.location.origin,
      }});
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res.data?.error || "Could not start the boost.");
    } catch (e) {
      setError(e.message || "Could not start the boost.");
    }
    setBusy("");
  };

  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl border-t-[3px] border-border bg-card p-5 pb-6 max-h-[90vh] overflow-y-auto"
      >
        <SheetTitle className="font-display text-xl uppercase flex items-center gap-2">
          <Rocket className="w-5 h-5" /> Boost post
        </SheetTitle>
        <SheetDescription className="text-xs text-muted-foreground">
          Boosted posts sit at the top of the For You feed for as long as you pick.
        </SheetDescription>

        <div className="space-y-2 mt-4">
          {BOOST_PACKAGES.map((pkg, i) => {
            const cheapest = i === 0;
            return (
              <button
                key={pkg.id}
                onClick={() => start(pkg)}
                disabled={!!busy}
                className={`w-full acid-card-sm p-3 flex items-center justify-between gap-3 text-left disabled:opacity-60 ${
                  cheapest ? "bg-brand-red text-white border-white" : "bg-card text-foreground"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-display uppercase block">
                    {pkg.label}
                    {cheapest && <span className="ml-2 text-[9px] font-heading">Cheapest</span>}
                  </span>
                  <span className={`text-[11px] ${cheapest ? "text-white/80" : "text-muted-foreground"}`}>
                    {perDay(pkg)}
                  </span>
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <span className="font-display text-xl">{formatEuro(pkg.price)}</span>
                  {busy === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-brand-red mt-3">{error}</p>}

        <button onClick={onClose} disabled={!!busy} className="acid-btn bg-muted text-foreground w-full mt-4">
          Not now
        </button>
      </SheetContent>
    </Sheet>
  );
}