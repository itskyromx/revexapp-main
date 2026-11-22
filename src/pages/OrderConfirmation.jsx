import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { formatMoney } from "@/lib/payments";
import BottomNav from "@/components/BottomNav";

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let timer;
    let attempts = 0;
    const confirm = async () => {
      if (!orderId) {
        setState("error");
        return;
      }
      const { data, error } = await supabase.functions.invoke("confirmCheckout", { body: { orderId } });
      if (cancelled) return;
      if (error || data?.error) {
        setState("error");
        return;
      }
      if (data?.order) setOrder(data.order);
      if (data?.order?.status === "paid") setState("paid");
      else if (attempts++ < 5) {
        setState("pending");
        timer = window.setTimeout(confirm, 2000);
      } else setState("pending");
    };
    confirm();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [orderId]);

  return <main className="min-h-screen px-4 pb-24 pt-10">
    <div className="mx-auto max-w-lg">
      {state === "loading" || state === "pending" ? <section className="acid-card bg-card p-6 text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-brand-red" />
        <h1 className="font-display text-2xl uppercase">{state === "loading" ? "Confirming payment" : "Payment processing"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your order will appear here as soon as Stripe confirms the payment.</p>
      </section> : state === "paid" ? <section className="acid-card bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-brand-red" />
        <h1 className="font-display text-3xl uppercase">Order confirmed</h1>
        <p className="mt-2 text-sm">Your payment was successful. The seller has been notified to prepare your order.</p>
        {order && <div className="acid-card-sm mt-5 flex items-center gap-3 bg-muted p-3 text-left">
          {order.item_image && <img src={order.item_image} alt="" className="h-16 w-16 border-2 border-border object-cover" />}
          <div className="min-w-0 flex-1"><p className="truncate font-heading font-bold">{order.item_title}</p><p className="text-sm text-muted-foreground">Order total · {formatMoney(order.total)}</p></div>
          <PackageCheck className="h-5 w-5 shrink-0" />
        </div>}
        <Link to="/orders" className="acid-btn mt-5 inline-flex bg-brand-red text-white">View my orders</Link>
      </section> : <section className="acid-card bg-card p-6 text-center">
        <h1 className="font-display text-2xl uppercase">Payment not confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">We could not verify a successful payment. Check your orders before trying again.</p>
        <Link to="/orders" className="acid-btn mt-5 inline-flex bg-brand-red text-white">View my orders</Link>
      </section>}
    </div>
    <BottomNav />
  </main>;
}
