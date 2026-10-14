import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Check, CreditCard, Loader2, Plus, Trash2 } from "lucide-react";

export default function SavedPaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const run = useCallback(async (action, extra = {}) => {
    const { data, error: invokeError } = await supabase.functions.invoke("managePaymentMethods", { body: { action, ...extra } });
    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await run("list");
      setMethods(data.paymentMethods || []);
      setDefaultId(data.defaultPaymentMethod || "");
    } catch (e) {
      setError(e.message || "Could not load saved payment methods.");
    }
  }, [run]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupSession = params.get("payment_session");
    if (setupSession) {
      setBusy(true);
      run("finish_setup", { sessionId: setupSession })
        .then(() => { setNotice("Payment method saved."); return load(); })
        .catch((e) => setError(e.message || "Could not verify the saved card."))
        .finally(() => {
          setBusy(false);
          params.delete("payment_session");
          const remainingQuery = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}`);
        });
    } else {
      load();
    }
  }, [load, run]);

  const addCard = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await run("create_setup", { origin: window.location.origin });
      if (!data.url) throw new Error("Stripe did not return a card setup link.");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || "Could not open secure card setup.");
      setBusy(false);
    }
  };

  const chooseDefault = async (paymentMethodId) => {
    setBusy(true); setError(""); setNotice("");
    try { await run("set_default", { paymentMethodId }); setDefaultId(paymentMethodId); setNotice("Default card updated."); }
    catch (e) { setError(e.message || "Could not update the default card."); }
    finally { setBusy(false); }
  };

  const remove = async (paymentMethodId) => {
    setBusy(true); setError(""); setNotice("");
    try { await run("remove", { paymentMethodId }); await load(); setNotice("Card removed."); }
    catch (e) { setError(e.message || "Could not remove the card."); }
    finally { setBusy(false); }
  };

  return (
    <section className="border-2 border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><CreditCard className="w-5 h-5" /><span className="font-heading font-bold uppercase text-sm">Payment methods</span></span>
        <button type="button" onClick={addCard} disabled={busy} className="acid-btn bg-brand-red text-white text-xs disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add card
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Add a card securely through Stripe. Revex never receives or stores your full card number.</p>
      {methods.length === 0 ? <p className="text-sm text-muted-foreground">No saved cards yet.</p> : <div className="space-y-2">
        {methods.map((method) => <div key={method.id} className="acid-card-sm bg-card p-2.5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 shrink-0" />
          <span className="min-w-0 flex-1 text-sm font-heading font-bold uppercase">{method.brand} ···· {method.last4}<span className="block text-[10px] font-normal text-muted-foreground">Expires {method.expMonth}/{method.expYear}</span></span>
          {defaultId === method.id ? <span className="acid-chip bg-brand-red text-white text-[10px]"><Check className="w-3 h-3" /> Default</span> : <button type="button" disabled={busy} onClick={() => chooseDefault(method.id)} className="text-[10px] underline disabled:opacity-50">Set default</button>}
          <button type="button" aria-label="Remove card" disabled={busy} onClick={() => remove(method.id)} className="p-1 text-muted-foreground hover:text-brand-red disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
        </div>)}
      </div>}
      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {error && <p className="text-xs text-brand-red">{error}</p>}
    </section>
  );
}
