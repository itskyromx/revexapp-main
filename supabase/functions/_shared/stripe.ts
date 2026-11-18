const STRIPE_API = 'https://api.stripe.com/v1';

export function stripeKey() {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured for this app yet.');
  return key;
}

export async function stripeRequest(path, params, method = 'POST') {
  const query = method === 'GET' && params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${STRIPE_API}/${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      'Stripe-Version': '2025-10-29.clover',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(params || {}) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Stripe request failed (${res.status})`);
  return data;
}

export function safeOrigin(value) {
  return typeof value === 'string' && /^https?:\/\/[^\s]+$/.test(value) ? value.replace(/\/$/, '') : '';
}
