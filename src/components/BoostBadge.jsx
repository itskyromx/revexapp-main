import { Zap } from "lucide-react";
import { boostActive, boostTimeLeft } from "@/lib/boost";

/** Small marker shown on a item while its paid boost is still running. */
export default function BoostBadge({ item, className = "" }) {
  if (!boostActive(item)) return null;
  return (
    <span
      className={`sticker bg-brand-red text-white border-white/40 text-[9px] px-1.5 py-0.5 uppercase inline-flex items-center gap-1 ${className}`}
    >
      <Zap className="w-3 h-3" />
      Boosted{boostTimeLeft(item.boost_expires_at) ? ` · ${boostTimeLeft(item.boost_expires_at)}` : ""}
    </span>
  );
}