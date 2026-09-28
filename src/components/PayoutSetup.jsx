import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Loader2, Wallet, Check, RefreshCw } from "lucide-react";
import { isEmbedded } from "@/lib/payments";

/** Seller payout onboarding — Stripe Connect express account. */
export default function PayoutSetup({ user, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = Boolean(user?.payouts_enabled);

  const start = async () => {
    if (isEmbedded()) {
      setError("Payout setup only works from the published app — open it in a new tab.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await supabase.functions.invoke("stripeConnect", { body: {
        action: "onboard",
        origin: window.location.origin,
      }});
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res.data?.error || "Could not start payout setup.");
    } catch (e) {
      setError(e.message || "Could not start payout setup.");
    }
    setBusy(false);
  };

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await supabase.functions.invoke("stripeConnect", { body: {
        action: "refresh",
        origin: window.location.origin,
      }});
      onRefresh?.(Boolean(res.data?.payoutsEnabled));
    } catch (e) {
      setError(e.message || "Could not check your payout status.");
    }
    setBusy(false);
  };

  return (
    <div className="border-2 border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          <span className="font-heading font-bold uppercase text-sm">Seller payouts</span>
        </span>
        {enabled ? (
          <span className="acid-chip bg-brand-red text-white"><Check className="w-3.5 h-3.5" /> Active</span>
        ) : (
          <span className="acid-chip bg-muted text-muted-foreground">Not set up</span>
        )}
      </div>

      {!enabled && (
        <>
          <p className="text-xs text-muted-foreground mt-2">
            Connect a bank account so buyers can pay you. Money is released to you once the buyer
            confirms the item arrived as described.
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={start} disabled={busy} className="acid-btn bg-brand-red text-white flex-1 text-xs disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Set up payouts
            </button>
            <button onClick={refresh} disabled={busy} className="acid-btn bg-muted text-foreground text-xs disabled:opacity-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-brand-red mt-2">{error}</p>}
    </div>
  );
}