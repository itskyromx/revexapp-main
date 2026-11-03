import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeRequest, safeOrigin } from '../_shared/stripe.ts';
import { findBoostPackage } from '../_shared/boost.ts';

export async function handleBoostItem(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    const body = await req.json().catch(() => ({}));
    const inputId = body.itemId || body.postId;
    if (!inputId) throw new Error('Missing item');
    const { data: itemId, error: resolveError } = await client.rpc('resolve_item_id', { p_id: inputId });
    if (resolveError || !itemId) throw new Error('Item not found');
    const { data: item, error } = await client.from('items').select('*').eq('id', itemId).single();
    if (error || item.created_by_id !== user.id) return Response.json({ error: 'Not your item' }, { status: 403, headers: corsHeaders });
    if (body.action === 'confirm') {
      if (!body.sessionId) throw new Error('Missing payment');
      const session = await stripeRequest(`checkout/sessions/${encodeURIComponent(body.sessionId)}`, undefined, 'GET');
      if (session?.payment_status !== 'paid') throw new Error('Payment has not completed');
      const paidId = session.metadata?.item_id || session.metadata?.post_id;
      const { data: paidItemId } = paidId ? await admin.rpc('resolve_item_id', { p_id: paidId }) : { data: null };
      if (paidItemId !== itemId || session.metadata?.user_id !== user.id) throw new Error('Payment belongs to a different item or user');
      const pkg = findBoostPackage(session.metadata?.package_id);
      if (!pkg || session.amount_total !== Math.round(pkg.price * 100) || session.currency !== 'eur') throw new Error('Invalid boost payment');
      const { data: expiry, error } = await admin.rpc('apply_item_boost', { p_item_id: itemId, p_session_id: body.sessionId, p_hours: pkg.hours });
      if (error) throw error;
      return Response.json({ boost_expires_at: expiry }, { headers: corsHeaders });
    }
    if (item.is_archived) throw new Error('Unarchive this item before boosting it');
    if (item.status !== 'available') throw new Error('Only available items can be boosted');
    const origin = safeOrigin(body.origin);
    const requestOrigin = req.headers.get('Origin');
    if (!origin || (requestOrigin && origin !== requestOrigin)) throw new Error('Invalid return origin');
    const pkg = findBoostPackage(body.packageId);
    if (!pkg) throw new Error('Unknown boost package');
    const route = body.itemId ? `/item/${itemId}` : `/haul/${inputId}`;
    const session = await stripeRequest('checkout/sessions', {
      mode: 'payment', 'metadata[item_id]': itemId, 'metadata[user_id]': user.id, 'metadata[package_id]': pkg.id,
      'payment_intent_data[metadata][item_id]': itemId,
      success_url: `${origin}${route}?boost=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${route}?boost=cancel`,
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(Math.round(pkg.price * 100)),
      'line_items[0][price_data][product_data][name]': `Boost · ${pkg.label}`,
    });
    if (!session.url) throw new Error('Could not start boost');
    return Response.json({ url: session.url }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not boost item' }, { status: 400, headers: corsHeaders });
  }
}
Deno.serve(handleBoostItem);
