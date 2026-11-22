import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { X, ShieldCheck, Loader2, Truck, ChevronDown, CreditCard, MapPin, House, PackageCheck } from "lucide-react";
import { orderTotals, formatMoney } from "@/lib/payments";
import PickupPointMap from "@/components/PickupPointMap";
import mbWayLogo from "@/assets/mbway.jpg";
import applePayLogo from "@/assets/apple_pay.png";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export function InlinePaymentForm({ orderId, paymentMethod = "card", onError, onBusy }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const submitPayment = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    onBusy(true);
    onError("");
    try {
      const returnUrl = `${window.location.origin}/order-confirmation?order=${encodeURIComponent(orderId)}`;
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
      if (paymentError) throw paymentError;
      if (paymentIntent?.status === "succeeded") navigate(`/order-confirmation?order=${encodeURIComponent(orderId)}`);
    } catch (paymentError) {
      onError(paymentError.message || "Payment could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  };
  return <form onSubmit={submitPayment} className="mt-4 space-y-4">
    <PaymentElement options={{
      layout: "tabs",
      ...(paymentMethod === "mb_way" ? { fields: { billingDetails: { phone: "always" } } } : {}),
    }} />
    <button type="submit" disabled={!stripe || submitting} className="acid-btn w-full bg-brand-red text-white disabled:opacity-50">
      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing payment…</> : "Pay securely"}
    </button>
  </form>;
}

function PaymentIcon({ method }) {
  if (method === "mb_way") return <img src={mbWayLogo} alt="" className="h-6 w-10 rounded object-contain" />;
  if (method === "apple_pay") return <img src={applePayLogo} alt="" className="h-6 w-10 rounded object-contain" />;
  return <CreditCard className="h-5 w-5" />;
}

/** Checkout for one item. The seller-configured shipping option supplies the
 * available service and price; Stripe hosts the payment form. */
export default function CheckoutSheet({ item, offer, onClose }) {
  const { user } = useCurrentUser();
  const [options, setOptions] = useState([]);
  const [optionId, setOptionId] = useState("");
  const [previewServiceId, setPreviewServiceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryCountry, setDeliveryCountry] = useState("Portugal");
  const [deliveryType, setDeliveryType] = useState("home");
  const [pickupLocation, setPickupLocation] = useState({ name: "", address: "", lat: null, lng: null });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [activeOrderId, setActiveOrderId] = useState("");

  const price = offer ? Number(offer.amount) : Number(item?.price);
  const deliveryOptions = useMemo(
    () => options.filter((shippingOption) =>
      (shippingOption.delivery_type || "home") === deliveryType
      && (!shippingOption.supported_countries?.length || shippingOption.supported_countries.includes(deliveryCountry))),
    [options, deliveryType, deliveryCountry],
  );
  const option = deliveryOptions.find((shippingOption) => shippingOption.id === optionId);
  // Until shipping rates are configured, allow checkout with zero shipping so
  // the payment flow can be tested independently of carrier integrations.
  const testShippingOption = deliveryOptions.length === 0
    ? { id: null, price: 0, name: "Shipping (test — no carrier rate)" }
    : null;
  const checkoutOption = option || testShippingOption;
  const totals = orderTotals(price, checkoutOption ? checkoutOption.price : 0);
  const previewServices = deliveryType === "home"
    ? [{ id: "ctt-home", carrier: "CTT", name: "Home delivery" }, { id: "dhl-home", carrier: "DHL", name: "Home delivery" }]
    : [{ id: "ctt-pickup", carrier: "CTT", name: "Collection point" }, { id: "inpost-locker", carrier: "InPost", name: "Parcel locker" }, { id: "dhl-point", carrier: "DHL", name: "ServicePoint" }];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: opts, error: optionsError } = await supabase.from("shipping_options").select("*").eq("active", true).order("price");
        if (optionsError) throw optionsError;
        if (!cancelled) {
          setOptions(opts || []);
          const homeOption = (opts || []).find((shippingOption) => (shippingOption.delivery_type || "home") === "home");
          setOptionId(homeOption?.id || "");
        }
      } catch (loadError) {
        console.error("Could not load shipping options:", loadError);
        if (!cancelled) setError("Could not load shipping options. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setAddress(user?.shipping_address || "");
    setDeliveryCountry(/,\s*Spain\s*$/i.test(user?.shipping_address || "") ? "Spain" : "Portugal");
  }, [user]);

  useEffect(() => {
    setOptionId(deliveryOptions[0]?.id || "");
  }, [deliveryType, deliveryOptions]);

  const pay = async () => {
    if (!checkoutOption || !user || busy) return;
    if (!stripePromise) {
      setError("Stripe is not configured in this app yet.");
      return;
    }
    if (deliveryType === "home" && !address.trim()) {
      setError("Enter the delivery address.");
      return;
    }
    if (deliveryType === "pickup" && (!pickupLocation.name.trim() || !pickupLocation.address.trim() || pickupLocation.lat == null || pickupLocation.lng == null)) {
      setError("Select a point on the map and enter its name and address.");
      return;
    }
    if (item.status === "sold") {
      setError("This item has already been sold.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data: existing } = await supabase.from("orders").select("id,status").eq("item_id", item.id);
      if ((existing || []).some((order) => ["paid", "in_transit", "completed"].includes(order.status))) {
        setError("This item has already been bought.");
        setBusy(false);
        return;
      }
      const addressWithoutSavedCountry = address.trim().replace(/,\s*(Portugal|Spain)\s*$/i, "");
      const shippingAddress = deliveryType === "home" ? `${addressWithoutSavedCountry}, ${deliveryCountry}` : "";
      if (shippingAddress && shippingAddress !== (user.shipping_address || "")) {
        await supabase.from("profiles").update({ shipping_address: shippingAddress }).eq("id", user.id);
      }
      const orderValues = {
        item_id: item.id,
        item_title: item.title,
        item_image: item.image_url || "",
        buyer_id: user.id,
        buyer_name: user.display_name || user.full_name || user.email,
        seller_id: item.created_by_id,
        seller_name: item.seller_name || "",
        offer_id: offer?.id || null,
        item_price: price,
        shipping_price: Number(checkoutOption.price) || 0,
        buyer_protection_fee: totals.fee,
        total: totals.total,
        shipping_option_id: checkoutOption.id,
        shipping_option_name: checkoutOption.name,
        shipping_address: shippingAddress,
        delivery_type: deliveryType,
        delivery_country: deliveryCountry,
        pickup_location: deliveryType === "pickup" ? { ...pickupLocation, country: deliveryCountry } : null,
        drop_off_point: deliveryType === "pickup" ? `${pickupLocation.name.trim()} — ${pickupLocation.address.trim()}, ${deliveryCountry}` : checkoutOption.drop_off_point || "",
        drop_off_instructions: checkoutOption.drop_off_instructions || "",
        status: "awaiting_payment",
      };
      const { data: previousOrders, error: previousOrdersError } = await supabase.from("orders")
        .select("id")
        .eq("item_id", item.id)
        .eq("buyer_id", user.id)
        .eq("status", "awaiting_payment")
        .order("created_at", { ascending: false })
        .limit(1);
      if (previousOrdersError) throw previousOrdersError;
      const previousOrderId = previousOrders?.[0]?.id;
      const orderResult = previousOrderId
        ? await supabase.from("orders").update(orderValues).eq("id", previousOrderId).select().single()
        : await supabase.from("orders").insert(orderValues).select().single();
      const { data: order, error: orderError } = orderResult;
      if (orderError) throw orderError;
      setActiveOrderId(order.id);

      const res = await supabase.functions.invoke("createCheckout", { body: {
        orderId: order.id,
        paymentMethod,
        origin: window.location.origin,
      }});
      if (res.error) throw res.error;
      if (res.data?.clientSecret) {
        setPaymentClientSecret(res.data.clientSecret);
        setPaymentOrderId(order.id);
      } else setError(res.data?.error || "Could not start checkout.");
    } catch (checkoutError) {
      setError(checkoutError.message || "Could not start checkout.");
    }
    setBusy(false);
  };

  const closeCheckout = async () => {
    if (activeOrderId) {
      await supabase.functions.invoke("cancelOrder", { body: { orderId: activeOrderId } }).catch(() => {});
      setActiveOrderId("");
    }
    onClose();
  };

  const changeDeliveryType = (type) => {
    setDeliveryType(type);
    setPreviewServiceId("");
    setError("");
  };

  const selectedPayment = paymentMethod === "mb_way" ? "MB WAY" : paymentMethod === "apple_pay" ? "Apple Pay" : "Credit / debit card";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={closeCheckout} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto acid-card bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-2xl uppercase">Checkout</h3>
          <button onClick={closeCheckout} aria-label="Close checkout" className="sticker flex h-9 w-9 items-center justify-center rounded-full bg-card">
            <X className="h-5 w-5" />
          </button>
        </div>

        {item && <div className="acid-card-sm mb-4 flex items-center gap-3 bg-muted p-2">
          {item.image_url && <img src={item.image_url} className="h-14 w-14 border-2 border-border object-cover" alt="" />}
          <div className="min-w-0"><p className="truncate font-heading text-sm font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{item.seller_name}</p></div>
        </div>}

        <div className="acid-card-sm space-y-1.5 bg-muted p-3">
          <div className="flex items-center justify-between text-sm"><span>{offer ? "Agreed price" : "Item price"}</span><span className="font-heading font-bold">{formatMoney(totals.price)}</span></div>
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Buyer Protection</span><span className="font-heading font-bold">{formatMoney(totals.fee)}</span></div>
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Shipping</span><span className="font-heading font-bold">{formatMoney(totals.shipping)}</span></div>
          <div className="flex items-center justify-between border-t-2 border-border pt-1.5"><span className="font-display uppercase">Total</span><span className="font-display text-xl">{formatMoney(totals.total)}</span></div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Buyer Protection keeps your money safe — the seller is only paid once you confirm the item arrived as described.</p>

        <section className="mt-4">
          <span className="acid-label">Delivery method</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={deliveryType === "home"} onClick={() => changeDeliveryType("home")} className={`acid-card-sm flex items-center justify-center gap-2 p-2.5 text-sm font-heading font-bold ${deliveryType === "home" ? "bg-brand-red text-white" : "bg-card"}`}><House className="h-4 w-4" /> Home delivery</button>
            <button type="button" aria-pressed={deliveryType === "pickup"} onClick={() => changeDeliveryType("pickup")} className={`acid-card-sm flex items-center justify-center gap-2 p-2.5 text-sm font-heading font-bold ${deliveryType === "pickup" ? "bg-brand-red text-white" : "bg-card"}`}><PackageCheck className="h-4 w-4" /> Collection point</button>
          </div>
        </section>

        <div className="mt-3">
          <label htmlFor="delivery-country" className="acid-label">Delivery country</label>
          <select id="delivery-country" value={deliveryCountry} onChange={(event) => setDeliveryCountry(event.target.value)} className="acid-input mt-1 text-sm">
            <option value="Portugal">Portugal</option>
            <option value="Spain">Spain</option>
          </select>
        </div>

        {deliveryType === "home" ? <div className="mt-3">
          <label htmlFor="delivery-address" className="acid-label">Delivery address</label>
          <textarea id="delivery-address" rows={3} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street and number, postcode, city" className="acid-input mt-1 resize-none text-sm" />
        </div> : <div className="mt-3 space-y-2">
          <label className="acid-label" htmlFor="pickup-name">Collection point</label>
          <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input id="pickup-name" value={pickupLocation.name} onChange={(event) => setPickupLocation((current) => ({ ...current, name: event.target.value }))} placeholder="Point name (e.g. parcel shop)" className="acid-input pl-9 text-sm" /></div>
          <input aria-label="Collection point address" value={pickupLocation.address} onChange={(event) => setPickupLocation((current) => ({ ...current, address: event.target.value }))} placeholder="Full address and postcode" className="acid-input text-sm" />
          <PickupPointMap value={pickupLocation} country={deliveryCountry} onChange={(position) => setPickupLocation((current) => ({ ...current, ...position }))} />
        </div>}

        {!paymentClientSecret && <section className="mt-4">
          <span className="acid-label">Payment method</span>
          <div className="relative mt-1">
            <button type="button" aria-expanded={paymentMenuOpen} onClick={() => setPaymentMenuOpen((open) => !open)} className="acid-card-sm flex w-full items-center justify-between gap-3 bg-card p-3 text-left">
              <span className="flex items-center gap-2 font-heading text-sm font-bold uppercase"><PaymentIcon method={paymentMethod} />{selectedPayment}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${paymentMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {paymentMenuOpen && <div className="absolute inset-x-0 top-full z-20 mt-1 border-2 border-border bg-card shadow-lg">
              {[["card", "Credit / debit card"], ["mb_way", "MB WAY"], ["apple_pay", "Apple Pay"]].map(([value, label]) => {
                const unavailable = value === "mb_way" && (totals.total < 0.5 || totals.total > 5000);
                return <button type="button" key={value} disabled={unavailable} onClick={() => { setPaymentMethod(value); setPaymentMenuOpen(false); }} className={`flex w-full items-center gap-2 p-3 text-left font-heading text-sm font-bold uppercase hover:bg-muted disabled:opacity-40 ${paymentMethod === value ? "text-brand-red" : ""}`}>
                  <PaymentIcon method={value} />{label}{paymentMethod === value && <span className="ml-auto text-[10px]">Selected</span>}
                </button>;
              })}
            </div>}
          </div>
        </section>}

        <section className="mt-4">
          <span className="acid-label">{deliveryType === "home" ? "Home delivery service" : "Collection point service"}</span>
          {loading ? <div className="grid h-16 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : deliveryOptions.length === 0 ? <>
            <div className="mt-1 space-y-2">
              {previewServices.map((service) => <button key={service.id} type="button" aria-pressed={previewServiceId === service.id} onClick={() => setPreviewServiceId(service.id)} className={`acid-card-sm flex w-full items-center justify-between gap-2 p-2.5 text-left ${previewServiceId === service.id ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
                <span><span className="block font-heading text-sm font-bold">{service.carrier} · {service.name}</span><span className={`text-[11px] ${previewServiceId === service.id ? "text-white/80" : "text-muted-foreground"}`}>Portugal / Spain</span></span>
                <span className="shrink-0 text-right font-heading text-xs font-bold">Price after<br />connection</span>
              </button>)}
            </div>
          </> : <div className="mt-1 space-y-2">
            {deliveryOptions.map((shippingOption) => <button key={shippingOption.id} type="button" aria-pressed={optionId === shippingOption.id} onClick={() => setOptionId(shippingOption.id)} className={`acid-card-sm flex w-full items-center justify-between gap-2 p-2.5 text-left ${optionId === shippingOption.id ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
              <span className="min-w-0"><span className="block truncate font-heading text-sm font-bold">{shippingOption.name}</span><span className={`text-[11px] ${optionId === shippingOption.id ? "text-white/80" : "text-muted-foreground"}`}>{shippingOption.carrier ? `${shippingOption.carrier} · ` : ""}{shippingOption.eta_days || "2–4 days"}</span></span>
              <span className="shrink-0 font-display">{formatMoney(shippingOption.price)}</span>
            </button>)}
          </div>}
        </section>

        {error && <p role="alert" className="mt-3 text-xs text-brand-red">{error}</p>}
        {!paymentClientSecret ? <button onClick={pay} disabled={busy || !checkoutOption || loading} className="acid-btn mt-4 w-full bg-brand-red text-white disabled:opacity-50">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing secure payment…</> : `Continue to payment · ${formatMoney(totals.total)}`}
        </button> : stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret, appearance: { theme: "stripe" } }}>
          <InlinePaymentForm orderId={paymentOrderId} paymentMethod={paymentMethod} onError={setError} onBusy={setBusy} />
        </Elements> : <p role="alert" className="mt-3 text-xs text-brand-red">Stripe is not configured in this app yet.</p>}
      </div>
    </div>
  );
}
