import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeRequest } from '../_shared/stripe.ts';

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
    const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)['default'];
    const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'];
    const authorization = req.headers.get('Authorization');
    if (!authorization || !Deno.env.get('STRIPE_SECRET_KEY')) return reply({ error: 'Stripe checkout is not configured.' }, 503);
    const supabase = createClient(url, publishable, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return reply({ error: 'Unauthorized.' }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    const choice = ['card', 'mb_way', 'apple_pay'].includes(body.paymentMethod) ? body.paymentMethod : 'card';
    if (!orderId) return reply({ error: 'Order is required.' }, 400);

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return reply({ error: 'Order not found.' }, 404);
    if (order.buyer_id !== user.id) return reply({ error: 'This is not your order.' }, 403);
    if (order.status !== 'awaiting_payment') return reply({ error: 'This order is not awaiting payment.' }, 409);

    const { data: item, error: itemError } = await admin.from('items').select('price,title,created_by_id,status').eq('id', order.item_id).single();
    if (itemError || !item) return reply({ error: 'The item for this order could not be found.' }, 404);
    if (item.created_by_id === user.id || item.status !== 'available') return reply({ error: 'This item is no longer available.' }, 409);
    let itemPrice = Number(item.price);
    if (order.offer_id) {
      const { data: offer, error: offerError } = await admin.from('offers').select('amount,status,buyer_id,item_id').eq('id', order.offer_id).single();
      if (offerError || !offer || offer.buyer_id !== user.id || offer.item_id !== item.id || offer.status !== 'accepted') {
        return reply({ error: 'This offer is no longer valid.' }, 409);
      }
      itemPrice = Number(offer.amount);
    }
    let shippingPrice = 0;
    let shippingName = 'Shipping';
    if (order.shipping_option_id) {
      const { data: shippingOption } = await admin.from('shipping_options').select('name,price,active').eq('id', order.shipping_option_id).single();
      if (!shippingOption?.active) return reply({ error: 'The selected shipping option is no longer available.' }, 409);
      shippingPrice = Number(shippingOption.price);
      shippingName = shippingOption.name;
    }
    if (!Number.isFinite(itemPrice) || itemPrice <= 0 || !Number.isFinite(shippingPrice) || shippingPrice < 0) return reply({ error: 'Invalid order total.' }, 400);
    const fee = Math.round((itemPrice * 0.04 + 0.6) * 100) / 100;
    const total = Math.round((itemPrice + shippingPrice + fee) * 100) / 100;
    const { error: orderUpdateError } = await admin.from('orders').update({
      item_title: item.title,
      item_price: itemPrice,
      shipping_price: shippingPrice,
      shipping_option_name: shippingName,
      buyer_protection_fee: fee,
      total,
    }).eq('id', order.id).eq('status', 'awaiting_payment');
    if (orderUpdateError) throw orderUpdateError;

    if (order.stripe_payment_intent_id) {
      const previous = await stripeRequest(`payment_intents/${order.stripe_payment_intent_id}`, undefined, 'GET').catch(() => null);
      if (previous?.status === 'requires_payment_method' && previous?.metadata?.payment_method_choice === choice && previous?.amount === Math.round(total * 100)) {
        return reply({ clientSecret: previous.client_secret });
      }
      if (previous?.status === 'requires_payment_method') await stripeRequest(`payment_intents/${order.stripe_payment_intent_id}/cancel`).catch(() => null);
      else if (previous?.status && previous.status !== 'canceled') return reply({ error: 'This payment is already being processed.' }, 409);
    }

    const customerId = await getOrCreateCustomer(admin, user);
    const params: Record<string, string> = {
      amount: String(Math.round(total * 100)),
      currency: 'eur',
      customer: customerId,
      'metadata[order_id]': order.id,
      'metadata[payment_method_choice]': choice,
      transfer_group: order.id,
    };
    // Keep the Payment Element limited to the customer's explicit choice.
    // Apple Pay is a wallet for the card payment method; automatic methods
    // would also expose financing options such as Klarna.
    params['payment_method_types[0]'] = choice === 'mb_way' ? 'mb_way' : 'card';
    const paymentIntent = await stripeRequest('payment_intents', params);
    const { error: updateError } = await admin.from('orders').update({ stripe_payment_intent_id: paymentIntent.id, buyer_protection_fee: fee, total }).eq('id', order.id);
    if (updateError) throw updateError;
    return reply({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('createCheckout failed:', error);
    return reply({ error: error instanceof Error ? error.message : 'Could not start checkout.' }, 500);
  }
});
