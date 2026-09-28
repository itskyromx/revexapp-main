import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { ExternalLink, Loader2 } from "lucide-react";
import TrackingTimeline from "@/components/TrackingTimeline";

/** Buyer's view of where the parcel is. Falls back to the order timeline when
 *  the seller hasn't added a tracking number yet (or tracking isn't configured). */
export default function OrderTracking({ order }) {
  const [events, setEvents] = useState([]);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(order.tracking_number));

  useEffect(() => {
    if (!order.tracking_number) {
      setEvents([]);
      setTrackingUrl("");
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    supabase.functions
      .invoke("trackOrder", { body: { orderId: order.id } })
      .then((res) => {
        if (!alive) return;
        setEvents(res.data?.events || []);
        setTrackingUrl(res.data?.trackingUrl || "");
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [order.id, order.tracking_number, order.status]);

  return (
    <div className="acid-card-sm bg-muted p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="acid-label">Tracking</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </div>

      <TrackingTimeline status={order.status} events={events} />

      {order.tracking_number && (
        <p className="text-[11px] text-muted-foreground mt-2">
          {[order.tracking_carrier, order.tracking_number].filter(Boolean).join(" · ")}
        </p>
      )}

      {trackingUrl && (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-heading uppercase mt-1 underline"
        >
          Track on carrier site <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}