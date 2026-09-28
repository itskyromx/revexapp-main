import { useState } from "react";
import { Star } from "lucide-react";
import StarRating from "@/components/StarRating";
import RatingSheet from "@/components/RatingSheet";

/** Buyer's rating of a completed order — prompt when missing, summary when left. */
export default function OrderRatingBlock({ order, review, onRated }) {
  const [open, setOpen] = useState(false);

  if (review) {
    return (
      <div className="acid-card-sm bg-muted p-3 mt-3">
        <div className="flex items-center justify-between">
          <span className="acid-label">Your rating</span>
          <StarRating value={review.rating} size={14} />
        </div>
        {review.comment && <p className="text-xs mt-1">{review.comment}</p>}
        {review.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {review.tags.map((t) => (
              <span key={t} className="acid-chip bg-card text-[10px]">{t}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="acid-btn bg-brand-red text-white w-full mt-3 text-xs"
      >
        <Star className="w-4 h-4" /> Rate seller
      </button>
      {open && (
        <RatingSheet
          order={order}
          onClose={() => setOpen(false)}
          onSubmitted={(r) => onRated?.(r)}
        />
      )}
    </>
  );
}