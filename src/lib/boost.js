// Mirrors base44/shared/boost.ts. The server owns the real price and duration —
// this copy only drives what the seller sees before paying.
export const BOOST_PACKAGES = [
  { id: "day", label: "24 hours", hours: 24, price: 1.49 },
  { id: "three_days", label: "3 days", hours: 72, price: 3.99 },
  { id: "week", label: "7 days", hours: 168, price: 7.99 },
];

export function formatEuro(n) {
  return "€" + Number(n).toFixed(2);
}

export function perDay(pkg) {
  return formatEuro(pkg.price / (pkg.hours / 24)) + "/day";
}

export function boostActive(post) {
  const at = post?.boost_expires_at ? new Date(post.boost_expires_at).getTime() : 0;
  return Boolean(at) && !isNaN(at) && at > Date.now();
}

/** "23h left" / "2d left" — the time a boost still has to run. */
export function boostTimeLeft(expiresAt) {
  const at = expiresAt ? new Date(expiresAt).getTime() : 0;
  if (!at || isNaN(at)) return "";
  const ms = at - Date.now();
  if (ms <= 0) return "";
  const hours = Math.floor(ms / 36e5);
  if (hours >= 48) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}