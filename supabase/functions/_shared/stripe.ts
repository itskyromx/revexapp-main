const STRIPE_API = 'https://api.stripe.com/v1';

export function safeOrigin(value: unknown) {
  return typeof value === 'string' && /^https?:\/\/[^\s]+$/.test(value)
    ? value.replace(/\/$/, '')
    : '';
}

export async function stripeRequest(path: string, params?: Record<string, string>, method: 'GET' | 'POST' = 'POST') {
  const query = method === 'GET' && params ? `?${new URLSearchParams(params)}` : '';
  const response = await fetch(`${STRIPE_API}/${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY') || ''}`,
      'Stripe-Version': '2025-10-29.clover',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(params || {}) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}
