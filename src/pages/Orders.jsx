import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ArrowLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import OrderCard from "@/components/OrderCard";
import DropOffCard from "@/components/DropOffCard";
import { InlinePaymentForm } from "@/components/CheckoutSheet";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState("buying");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [reviews, setReviews] = useState({});
  const [paymentClientSecret, setPaymentClientSecret] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState("");

  const load = async () => {
    if (!user) return;
    try {
      const [ordersRes, reviewsRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('reviews').select('*').eq('buyer_id', user.id),
      ]);
      const seenPending = new Set();
      const all = (ordersRes.data || []).filter((order) => {
        if (order.status === "cancelled") return false;
        if (order.status !== "awaiting_payment") return true;
        const key = `${order.buyer_id}:${order.item_id}`;
        if (seenPending.has(key)) return false;
        seenPending.add(key);
        return true;
      });
      const revs = reviewsRes.data || [];
      setOrders(all);
      setReviews(Object.fromEntries(revs.map((r) => [r.order_id, r])));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  // Coming back from Stripe — confirm the payment actually went through.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    const state = params.get("checkout");
    if (!orderId || !state) return;
    if (state === "success") {
      supabase.functions
        .invoke("confirmCheckout", { body: { orderId } })
        .then(() => setNotice("Payment received — the seller has been told to ship."))
        .catch(() => setNotice("We couldn't confirm that payment. Pull to refresh in a moment."))
        .finally(load);
    } else {
      // They walked away from Stripe — close the unpaid order and free the item.
      supabase.functions
        .invoke("cancelOrder", { body: { orderId } })
        .then(() => setNotice("Checkout cancelled — the item is available again."))
        .catch(() => setNotice("Checkout cancelled — nothing was charged."))
        .finally(load);
    }
    window.history.replaceState({}, "", "/orders");
  }, []);

  const pay = async (order) => {
    if (!stripePromise) {
      setNotice("Stripe is not configured in this app yet.");
      return;
    }
    setBusyId(order.id);
    try {
      const res = await supabase.functions.invoke("createCheckout", { body: {
        orderId: order.id,
      }});
      if (res.error) throw res.error;
      if (res.data?.clientSecret) {
        setPaymentClientSecret(res.data.clientSecret);
        setPaymentOrderId(order.id);
      } else setNotice(res.data?.error || "Could not start payment.");
    } catch (e) {
      setNotice(e.message || "Could not open checkout.");
    }
    setBusyId("");
  };

  const confirmReceipt = async (order) => {
    setBusyId(order.id);
    try {
      await supabase.functions.invoke("releasePayout", { body: { orderId: order.id } });
      setNotice("Thanks! The seller has been paid.");
      await load();
    } catch (e) {
      setNotice(e.message || "Could not release the payment.");
    }
    setBusyId("");
  };

  const buying = orders.filter((o) => o.buyer_id === user?.id);
  const selling = orders.filter((o) => o.seller_id === user?.id && o.status !== "awaiting_payment");
  const list = tab === "buying" ? buying : selling;

  return (
    <div className="min-h-screen pb-16 bg-background">
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-display text-xl uppercase">Orders</span>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        <div className="flex border-[3px] border-border bg-card">
          <button
            onClick={() => setTab("buying")}
            className={`flex-1 py-2 font-heading font-bold uppercase text-xs ${tab === "buying" ? "bg-brand-red text-white" : "text-foreground"}`}
          >
            Buying ({buying.length})
          </button>
          <button
            onClick={() => setTab("selling")}
            className={`flex-1 py-2 font-heading font-bold uppercase text-xs border-l-2 border-border ${tab === "selling" ? "bg-brand-red text-white" : "text-foreground"}`}
          >
            Selling ({selling.length})
          </button>
        </div>

        {notice && <div className="acid-card-sm bg-muted p-3 mt-3 text-xs">{notice}</div>}

        {loading ? (
          <div className="h-40 grid place-items-center">
            <div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="font-display text-lg uppercase">No orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "buying" ? "Items you buy will show up here." : "Items you sell will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                role={tab === "buying" ? "buyer" : "seller"}
                busy={busyId === o.id}
                onPay={() => pay(o)}
                onConfirm={() => confirmReceipt(o)}
                review={reviews[o.id]}
                onRated={(r) => setReviews((m) => ({ ...m, [r.order_id]: r }))}
              >
                {tab === "selling" && o.status === "paid" && (
                  <div className="mt-3">
                    <DropOffCard
                      order={o}
                      onUpdated={(next) => setOrders((arr) => arr.map((x) => (x.id === next.id ? next : x)))}
                    />
                  </div>
                )}
              </OrderCard>
            ))}
          </div>
        )}
      </div>
      {paymentClientSecret && stripePromise && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
        <div className="acid-card max-h-[90vh] w-full max-w-md overflow-y-auto bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl uppercase">Complete payment</h2>
            <button type="button" onClick={() => { setPaymentClientSecret(""); setPaymentOrderId(""); }} className="text-sm underline">Close</button>
          </div>
          <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret, appearance: { theme: "stripe" } }}>
            <InlinePaymentForm orderId={paymentOrderId} onError={setNotice} onBusy={(busy) => setBusyId(busy ? paymentOrderId : "")} />
          </Elements>
        </div>
      </div>}
      <BottomNav />
    </div>
  );
}
