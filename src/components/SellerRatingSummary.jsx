import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";
import { timeAgo } from "@/lib/revex";

/** Public trust summary on a seller's profile: average, count and latest reviews. */
export default function SellerRatingSummary({ userId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setLoading(true);
    supabase.from('reviews').select('*').eq('seller_id', userId)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (alive) setReviews(data || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  if (loading) return null;

  const count = reviews.length;
  const avg = count ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / count : 0;

  return (
    <div className="acid-card p-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display uppercase text-lg">Seller rating</h2>
        {count > 0 && <span className="acid-chip bg-brand-red text-white">{avg.toFixed(1)} ★</span>}
      </div>

      {count === 0 ? (
        <p className="text-sm text-muted-foreground mt-1">No ratings yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-1">
            <StarRating value={avg} size={18} />
            <span className="text-xs text-muted-foreground">
              {count} rating{count === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3">
            {reviews.slice(0, 5).map((r) => (
              <div key={r.id} className="border-t-2 border-border/20 pt-2 mt-2 first:border-0 first:mt-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <Avatar name={r.buyer_name} src={r.buyer_avatar} size={28} />
                  <span className="font-heading font-bold text-xs truncate">{r.buyer_name || "Buyer"}</span>
                  <StarRating value={r.rating} size={12} className="ml-auto shrink-0" />
                </div>
                {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                {r.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.tags.map((t) => (
                      <span key={t} className="acid-chip bg-muted text-[10px]">{t}</span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(r.created_at)} ago</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}