import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { safeOrigin, stripeRequest } from '../_shared/stripe.ts';

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getOrCreateCustomer(admin: ReturnType<typeof createClient>, user: { id: string; email?: string }) {
  const { data: profile, error } = await admin.from('profiles').select('stripe_customer_id,email').eq('id', user.id).single();
  if (error) throw error;
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await stripeRequest('customers', {
    email: profile?.email || user.email || '',
    'metadata[app_user_id]': user.id,
  });
  const { error: updateError } = await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
  if (updateError) throw updateError;
  return customer.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization || !Deno.env.get('STRIPE_SECRET_KEY')) return reply({ error: 'Stripe checkout is not configured.' }, 503);
    const supabase = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return reply({ error: 'Unauthorized.' }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    const origin = safeOrigin(body.origin);
    const choice = ['card', 'mb_way', 'apple_pay'].includes(body.paymentMethod) ? body.paymentMethod : 'card';
    if (!orderId || !origin) return reply({ error: 'Order and return origin are required.' }, 400);

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return reply({ error: 'Order not found.' }, 404);
    if (order.buyer_id !== user.id) return reply({ error: 'This is not your order.' }, 403);
    if (order.status !== 'awaiting_payment') return reply({ error: 'This order is not awaiting payment.' }, 409);

    if (order.stripe_session_id) {
      const previous = await stripeRequest(`checkout/sessions/${order.stripe_session_id}`, undefined, 'GET').catch(() => null);
      if (previous?.status === 'open' && previous?.url && previous?.metadata?.payment_method_choice === choice) return reply({ url: previous.url });
      if (previous?.status === 'open') await stripeRequest(`checkout/sessions/${order.stripe_session_id}/expire`).catch(() => null);
    }

    const customerId = await getOrCreateCustomer(admin, user);
    const itemPrice = Number(order.item_price);
    const shippingPrice = Number(order.shipping_price || 0);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0 || !Number.isFinite(shippingPrice) || shippingPrice < 0) return reply({ error: 'Invalid order total.' }, 400);
    const fee = Math.round((itemPrice * 0.04 + 0.6) * 100) / 100;
    const total = Math.round((itemPrice + shippingPrice + fee) * 100) / 100;
    const params: Record<string, string> = {
      mode: 'payment',
      customer: customerId,
      'payment_method_types[0]': choice === 'mb_way' ? 'mb_way' : 'card',
      'metadata[order_id]': order.id,
      'metadata[payment_method_choice]': choice,
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[transfer_group]': order.id,
      success_url: `${origin}/orders?checkout=success&order=${order.id}`,
      cancel_url: `${origin}/item/${order.item_id}?checkout=cancel&order=${order.id}`,
    };
    const lines = [
      [order.item_title || 'Item', Math.round(Number(order.item_price) * 100)],
      ['Buyer Protection', Math.round(fee * 100)],
    ];
    if (Number(order.shipping_price) > 0) lines.push([order.shipping_option_name || 'Shipping', Math.round(Number(order.shipping_price) * 100)]);
    lines.forEach(([name, amount], i) => {
      params[`line_items[${i}][quantity]`] = '1';
      params[`line_items[${i}][price_data][currency]`] = 'eur';
      params[`line_items[${i}][price_data][unit_amount]`] = String(amount);
      params[`line_items[${i}][price_data][product_data][name]`] = String(name);
    });
    const session = await stripeRequest('checkout/sessions', params);
    const { error: updateError } = await admin.from('orders').update({ stripe_session_id: session.id, buyer_protection_fee: fee, total }).eq('id', order.id);
    if (updateError) throw updateError;
    return reply({ url: session.url });
  } catch (error) {
    console.error('createCheckout failed:', error);
    return reply({ error: error instanceof Error ? error.message : 'Could not start checkout.' }, 500);
  }
});
