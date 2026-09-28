import { Zap } from "lucide-react";
import { boostActive, boostTimeLeft } from "@/lib/boost";

/** Small marker shown on a post while its paid boost is still running. */
export default function BoostBadge({ post, className = "" }) {
  if (!boostActive(post)) return null;
  return (
    <span
      className={`sticker bg-brand-red text-white border-white/40 text-[9px] px-1.5 py-0.5 uppercase inline-flex items-center gap-1 ${className}`}
    >
      <Zap className="w-3 h-3" />
      Boosted{boostTimeLeft(post.boost_expires_at) ? ` · ${boostTimeLeft(post.boost_expires_at)}` : ""}
    </span>
  );
}