import { useState } from "react";
import { QRCodeCard } from "@/components/QrCode";
import { supabase } from "@/api/supabaseClient";
import { MapPin, Check, Loader2 } from "lucide-react";

/** Seller's drop-off pass: the code the pickup point scans, plus where to go. */
export default function DropOffCard({ order, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState(order.tracking_carrier || "");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");

  const markDroppedOff = async () => {
    setBusy(true);
    try {
      const { data: updated } = await supabase.from('orders').update({
        status: "in_transit",
        dropped_off_date: new Date().toISOString(),
        tracking_carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
      }).eq('id', order.id).select().single();
      onUpdated?.({
        ...order,
        ...updated,
        status: "in_transit",
        tracking_carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
      });
      supabase.functions
        .invoke("sendNotification", { body: {
          recipientId: order.buyer_id,
          title: "Your order is on its way",
          content: `${order.item_title} has been dropped off and is in transit.`,
          actionUrl: "/orders",
          type: "order",
          targetType: "order",
          targetId: order.id,
          thumbnail: order.item_image || "",
        }})
        .catch(() => {});
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  const code = order.drop_off_code || "—";

  return (
    <div className="acid-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="sticker bg-brand-red text-white px-2 py-0.5 text-xs">Drop-off</span>
        <span className="acid-label">Show this code at the counter</span>
      </div>

      <QRCodeCard value={code} />

      <p className="text-center font-display text-2xl mt-2 tracking-widest">{code}</p>

      <div className="acid-card-sm bg-muted p-3 mt-3 flex items-start gap-2">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-heading font-bold text-sm">{order.drop_off_point || "Drop-off point"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {order.drop_off_instructions || "Hand the parcel over and let them scan your code."}
          </p>
        </div>
      </div>

      {order.status === "paid" ? (
        <>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <span className="acid-label">Carrier</span>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="DHL, CTT, UPS…"
              className="acid-input mt-1 text-sm"
            />
          </div>
          <div>
            <span className="acid-label">Tracking no.</span>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="ABC123456"
              className="acid-input mt-1 text-sm"
            />
          </div>
        </div>
        <button
          onClick={markDroppedOff}
          disabled={busy}
          className="acid-btn bg-brand-red text-white w-full mt-3 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mark as dropped off
        </button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground text-center mt-3">Dropped off — waiting for the buyer to confirm.</p>
      )}
    </div>
  );
}