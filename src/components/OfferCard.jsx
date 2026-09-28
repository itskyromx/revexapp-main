import { Tag, Check, X, Loader2, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/styld";

/** An offer rendered inside a conversation — item, amount, status and the
 *  action the current viewer is allowed to take on it. */
export default function OfferCard({ offer, me, paid, busy, onRespond, onPay, onOpenItem }) {
  const isSeller = offer.seller_id === me?.id;
  const isBuyer = offer.buyer_id === me?.id;
  const status = paid && offer.status === "accepted" ? "paid" : offer.status;
  const statusClass =
    status === "pending"
      ? "bg-muted text-foreground"
      : status === "accepted"
      ? "bg-brand-red text-white"
      : status === "paid"
      ? "bg-foreground text-background"
      : "bg-card text-muted-foreground";

  return (
    <div className="acid-card-sm bg-card p-2.5 w-[85%]">
      <button onClick={onOpenItem} className="flex items-center gap-2 w-full text-left">
        {offer.item_image && (
          <img src={offer.item_image} className="w-12 h-12 object-cover border-2 border-border shrink-0" alt="" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-xs truncate">{offer.item_title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {isSeller ? `From ${offer.buyer_name || "buyer"}` : "Your offer"} · listed {formatPrice(offer.item_price)}
          </p>
        </div>
        <span className={`acid-chip shrink-0 uppercase ${statusClass}`}>{status}</span>
      </button>

      <div className="flex items-center gap-1.5 mt-2">
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-display text-lg">{formatPrice(offer.amount)}</span>
        {offer.message && (
          <span className="text-[11px] italic text-muted-foreground truncate">"{offer.message}"</span>
        )}
      </div>

      {isSeller && offer.status === "pending" && (
        <div className="flex gap-2 mt-2">
          <button
            disabled={busy}
            onClick={() => onRespond(offer, "accepted")}
            className="acid-btn bg-brand-red text-white px-3 py-1 text-xs disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
          </button>
          <button
            disabled={busy}
            onClick={() => onRespond(offer, "rejected")}
            className="acid-btn bg-card text-foreground px-3 py-1 text-xs disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" /> Decline
          </button>
        </div>
      )}

      {isBuyer && offer.status === "accepted" && !paid && (
        <button
          disabled={busy}
          onClick={() => onPay(offer)}
          className="acid-btn bg-brand-red text-white w-full mt-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Pay{" "}
          {formatPrice(offer.amount)}
        </button>
      )}

      {paid && <p className="text-[11px] text-muted-foreground mt-2">Paid — check your orders for delivery.</p>}
      {!paid && offer.status === "accepted" && isSeller && (
        <p className="text-[11px] text-muted-foreground mt-2">Accepted — waiting for the buyer to pay.</p>
      )}
    </div>
  );
}