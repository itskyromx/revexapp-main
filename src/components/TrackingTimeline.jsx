import { Check } from "lucide-react";

const STEPS = ["Paid", "Shipped", "In transit", "Delivered"];

// How many steps the order has passed. "Shipped" and "In transit" are reached
// together once the seller has dropped the parcel off.
function reachedCount(status) {
  if (status === "completed") return 4;
  if (status === "in_transit") return 3;
  if (status === "paid") return 1;
  return 0;
}

function formatStamp(time) {
  if (!time) return "";
  const d = new Date(time);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Vertical shipping progress plus the carrier's own scan events, when we have them. */
export default function TrackingTimeline({ status, events = [] }) {
  const reached = reachedCount(status);

  return (
    <div>
      <ol>
        {STEPS.map((label, i) => {
          const done = i < reached;
          const current = i === reached - 1;
          return (
            <li key={label} className="flex gap-2">
              <div className="flex flex-col items-center">
                <span
                  className={`w-5 h-5 rounded-full border-2 border-border grid place-items-center ${
                    done ? (current ? "bg-brand-red" : "bg-foreground") : "bg-card"
                  }`}
                >
                  {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={`w-0.5 min-h-[14px] flex-1 ${i < reached - 1 ? "bg-foreground" : "bg-border/40"}`} />
                )}
              </div>
              <span className={`text-xs pb-2 ${done ? "font-heading font-bold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {events.length > 0 && (
        <div className="mt-2 pt-2 border-t-2 border-border/30 space-y-1.5">
          {events.map((e, i) => (
            <div key={i} className="text-[11px]">
              <p className="font-heading font-bold">{e.label}</p>
              <p className="text-muted-foreground">
                {[formatStamp(e.time), e.location].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}