// Buyer protection pricing + order helpers (display side — the backend is the
// source of truth for every amount actually charged).

export const BUYER_PROTECTION_RATE = 0.04;
export const BUYER_PROTECTION_FIXED = 0.6;

export function buyerProtectionFee(price) {
  const p = Number(price) || 0;
  return Math.round((p * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED) * 100) / 100;
}

export function orderTotals(itemPrice, shippingPrice) {
  const price = Number(itemPrice) || 0;
  const shipping = Number(shippingPrice) || 0;
  const fee = buyerProtectionFee(price);
  return { price, shipping, fee, total: Math.round((price + shipping + fee) * 100) / 100 };
}

export function formatMoney(n) {
  if (n == null || isNaN(n)) return "—";
  return "€" + Number(n).toFixed(2);
}

// Checkout can't run inside an embedded frame — Stripe needs a top-level page.
export function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const ORDER_STATUS_LABELS = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid · ship it",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLES = {
  awaiting_payment: "bg-muted text-foreground",
  paid: "bg-brand-red text-white",
  in_transit: "bg-brand-red text-white",
  completed: "bg-card text-foreground",
  cancelled: "bg-card text-muted-foreground",
};