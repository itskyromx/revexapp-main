import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { X, ShieldCheck, Loader2, Truck } from "lucide-react";
import { orderTotals, formatMoney, isEmbedded } from "@/lib/payments";

/**
 * Checkout for a single item — either at the listed price or at an accepted
 * offer amount. Creates the order, then hands off to Stripe.
 */
export default function CheckoutSheet({ item, offer, onClose }) {
  const { user } = useCurrentUser();
  const [options, setOptions] = useState([]);
  const [optionId, setOptionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");

  const price = offer ? Number(offer.amount) : Number(item?.price);
  const option = options.find((o) => o.id === optionId);
  const totals = orderTotals(price, option ? option.price : 0);

  useEffect(() => {
    (async () => {
      try {
        const { data: opts } = await supabase.from('shipping_options').select('*').eq('active', true).order('price');
        setOptions(opts || []);
        if (opts?.[0]) setOptionId(opts[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Delivery address saved on the profile, prefilled here.
  useEffect(() => {
    setAddress(user?.shipping_address || "");
  }, [user]);

  const pay = async () => {
    if (!option || !user) return;
    if (isEmbedded()) {
      setError("Checkout only works from the published app — open it in a new tab to pay.");
      return;
    }
    if (item.status === "sold") {
      setError("This item has already been sold.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: existing } = await supabase.from('orders').select('*').eq('item_id', item.id);
      if ((existing || []).some((o) => ["paid", "in_transit", "completed"].includes(o.status))) {
        setError("This item has already been bought.");
        setBusy(false);
        return;
      }
      if (address.trim() && address.trim() !== (user.shipping_address || "")) {
        await supabase.from('profiles').update({ shipping_address: address.trim() }).eq('id', user.id).then(() => {});
      }
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        item_id: item.id,
        item_title: item.title,
        item_image: item.image_url || "",
        post_id: item.post_id || "",
        buyer_id: user.id,
        buyer_name: user.display_name || user.full_name || user.email,
        seller_id: item.created_by_id,
        seller_name: item.seller_name || "",
        offer_id: offer?.id || null,
        item_price: price,
        shipping_price: Number(option.price) || 0,
        buyer_protection_fee: totals.fee,
        total: totals.total,
        shipping_option_id: option.id,
        shipping_option_name: option.name,
        shipping_address: address.trim(),
        drop_off_point: option.drop_off_point || "",
        drop_off_instructions: option.drop_off_instructions || "",
        status: "awaiting_payment",
      }).select().single();
      if (orderError) throw orderError;
      const res = await supabase.functions.invoke("createCheckout", { body: {
        orderId: order.id,
        origin: window.location.origin,
      }});
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res.data?.error || "Could not start checkout.");
    } catch (e) {
      setError(e.message || "Could not start checkout.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md acid-card bg-card p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-2xl uppercase">Checkout</h3>
          <button onClick={onClose} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {item && (
          <div className="flex items-center gap-3 mb-4 acid-card-sm bg-muted p-2">
            {item.image_url && (
              <img src={item.image_url} className="w-14 h-14 object-cover border-2 border-border" alt="" />
            )}
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.seller_name}</p>
            </div>
          </div>
        )}

        <div className="acid-card-sm bg-muted p-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>{offer ? "Agreed price" : "Item price"}</span>
            <span className="font-heading font-bold">{formatMoney(totals.price)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Buyer Protection
            </span>
            <span className="font-heading font-bold">{formatMoney(totals.fee)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> Shipping
            </span>
            <span className="font-heading font-bold">{formatMoney(totals.shipping)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t-2 border-border">
            <span className="font-display uppercase">Total</span>
            <span className="font-display text-xl">{formatMoney(totals.total)}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-2">
          Buyer Protection keeps your money safe — the seller is only paid once you confirm the item
          arrived as described.
        </p>

        <div className="mt-4">
          <span className="acid-label">Deliver to</span>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, postcode"
            className="acid-input mt-1 resize-none text-sm"
          />
        </div>

        <div className="mt-4">
          <span className="acid-label">Choose shipping</span>
          {loading ? (
            <div className="h-16 grid place-items-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">No shipping options available right now.</p>
          ) : (
            <div className="space-y-2 mt-1">
              {options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOptionId(o.id)}
                  className={`w-full text-left acid-card-sm p-2.5 flex items-center justify-between gap-2 ${
                    optionId === o.id ? "bg-brand-red text-white" : "bg-card text-foreground"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-heading font-bold text-sm block truncate">{o.name}</span>
                    <span className={`text-[11px] ${optionId === o.id ? "text-white/80" : "text-muted-foreground"}`}>
                      {o.carrier ? `${o.carrier} · ` : ""}
                      {o.eta_days || "2–4 days"}
                    </span>
                  </span>
                  <span className="font-display shrink-0">{formatMoney(o.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-brand-red mt-3">{error}</p>}

        <button
          onClick={pay}
          disabled={busy || !option || loading}
          className="acid-btn bg-brand-red text-white w-full mt-4 disabled:opacity-50"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening secure payment…</> : `Pay ${formatMoney(totals.total)}`}
        </button>
      </div>
    </div>
  );
}