import { useState } from "react";
import { X, Tag } from "lucide-react";
import { formatPrice } from "@/lib/revex";

/** Sends an offer. Used by buyers bidding on an item and sellers countering one. */
export default function OfferSheet({ item, title = "Make an Offer", recipient, defaultAmount, onClose, onSubmitted }) {
  const [amount, setAmount] = useState(
    defaultAmount != null ? String(defaultAmount) : item?.price ? Math.round(item.price * 0.9) : ""
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    await onSubmitted({ amount: Number(amount), message });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md acid-card bg-muted p-5 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-2xl uppercase">{title}</h3>
          <button onClick={onClose} className="sticker bg-card w-9 h-9 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        {item && (
          <div className="flex items-center gap-3 mb-4 acid-card-sm bg-card p-2">
            {item.image_url && <img src={item.image_url} className="w-14 h-14 object-cover border-2 border-border" alt="" />}
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {recipient ? `To ${recipient}` : ""} {recipient ? "· " : ""}Listed {formatPrice(item.price)}
              </p>
            </div>
          </div>
        )}
        <label className="acid-label">Offer amount (€)</label>
        <div className="relative mt-1 mb-3">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="acid-input pl-10 text-xl font-display"
            min={1}
          />
        </div>
        <label className="acid-label">Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Love this! Would you take..."
          className="acid-input mt-1 mb-4 resize-none"
        />
        <button
          onClick={submit}
          disabled={busy || !amount}
          className="acid-btn bg-brand-red text-white w-full disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send Offer"}
        </button>
      </div>
    </div>
  );
}