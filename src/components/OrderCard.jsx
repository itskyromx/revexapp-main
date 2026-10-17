import { formatMoney, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/lib/payments";
import { ShieldCheck, Loader2 } from "lucide-react";
import OrderTracking from "@/components/OrderTracking";
import OrderRatingBlock from "@/components/OrderRatingBlock";

/** One order row. `role` is "buyer" or "seller" from the current user's side. */
export default function OrderCard({ order, role, busy, onPay, onConfirm, review, onRated, children }) {
  return (
    <div className="acid-card p-3">
      <div className="flex gap-3">
        {order.item_image && (
          <img src={order.item_image} className="w-16 h-16 object-cover border-2 border-border shrink-0" alt="" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading font-bold text-sm truncate">{order.item_title}</p>
            <span className={`acid-chip shrink-0 ${ORDER_STATUS_STYLES[order.status] || "bg-muted"}`}>
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {role === "buyer" ? `From ${order.seller_name || "seller"}` : `To ${order.buyer_name || "buyer"}`}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="font-display text-lg">{formatMoney(order.total)}</span>
            {order.shipping_option_name && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[50%]">
                {order.shipping_option_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {role === "seller" && order.delivery_type === "pickup" && order.pickup_location && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Collection point: {order.pickup_location.name} — {order.pickup_location.address}, {order.pickup_location.country || order.delivery_country}
          {order.pickup_location.lat != null && order.pickup_location.lng != null && (
            <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(order.pickup_location.lat)}&mlon=${encodeURIComponent(order.pickup_location.lng)}#map=16/${encodeURIComponent(order.pickup_location.lat)}/${encodeURIComponent(order.pickup_location.lng)}`}>View map</a></>
          )}
        </p>
      )}

      {role === "buyer" && ["paid", "in_transit", "completed"].includes(order.status) && (
        <div className="mt-3">
          <OrderTracking order={order} />
        </div>
      )}

      {children}

      {role === "buyer" && order.status === "awaiting_payment" && (
        <button onClick={onPay} disabled={busy} className="acid-btn bg-brand-red text-white w-full mt-3 text-xs disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Complete payment
        </button>
      )}

      {role === "buyer" && (order.status === "paid" || order.status === "in_transit") && (
        <button onClick={onConfirm} disabled={busy} className="acid-btn bg-brand-red text-white w-full mt-3 text-xs disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Everything's OK — release payment
        </button>
      )}

      {role === "buyer" && order.status === "completed" && (
        <OrderRatingBlock order={order} review={review} onRated={onRated} />
      )}
    </div>
  );
}