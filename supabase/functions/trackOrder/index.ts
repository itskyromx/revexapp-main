import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const AFTERSHIP_API = 'https://api.aftership.com/v4';

function courierSlug(carrier) {
  return (carrier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)['default'],
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    if (!orderId) return new Response(JSON.stringify({ error: 'Missing order' }), { status: 400, headers: corsHeaders });

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });

    const number = order.tracking_number || '';
    const carrier = order.tracking_carrier || '';
    const slug = courierSlug(carrier);
    if (!number) return new Response(JSON.stringify({ events: [], configured: false }), { headers: corsHeaders });

    const trackingUrl = slug ? `https://track.aftership.com/${slug}/${encodeURIComponent(number)}` : '';

    const key = Deno.env.get('AFTERSHIP_API_KEY') || '';
    if (!key) return new Response(JSON.stringify({ events: [], configured: false, trackingUrl }), { headers: corsHeaders });

    const headers = { 'aftership-api-key': key, 'Content-Type': 'application/json' };

    let tracking = null;
    try {
      const created = await fetch(`${AFTERSHIP_API}/trackings`, {
        method: 'POST', headers,
        body: JSON.stringify({ tracking: { tracking_number: number, ...(slug ? { slug } : {}) } }),
      });
      const data = await created.json().catch(() => null);
      if (created.ok) tracking = data?.data?.tracking || null;
      else console.error('trackOrder create:', created.status, data?.meta?.message || '');
    } catch (e) {
      console.error('trackOrder create failed:', e?.message || e);
    }

    if (!tracking) {
      const query = new URLSearchParams({ tracking_numbers: number });
      if (slug) query.set('slug', slug);
      const got = await fetch(`${AFTERSHIP_API}/trackings?${query.toString()}`, { headers });
      const data = await got.json().catch(() => null);
      if (!got.ok) console.error('trackOrder lookup:', got.status, data?.meta?.message || '');
      tracking = data?.data?.trackings?.[0] || null;
    }

    const checkpoints = Array.isArray(tracking?.checkpoints) ? tracking.checkpoints : [];
    const events = checkpoints
      .map((cp) => ({ time: cp?.checkpoint_time || '', label: cp?.message || cp?.tag || 'Update', location: cp?.location || '' }))
      .reverse();

    return new Response(JSON.stringify({ events, configured: true, trackingUrl }), { headers: corsHeaders });
  } catch (error) {
    console.error('trackOrder failed:', error?.message || error);
    return new Response(JSON.stringify({ events: [], configured: false }), { headers: corsHeaders });
  }
});
