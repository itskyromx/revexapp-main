import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeRequest, safeOrigin } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)['default'],
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const admin = createClient(Deno.env.get('SUPABASE_URL'), JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default']);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'refresh' ? 'refresh' : 'onboard';
    const origin = safeOrigin(body?.origin);
    if (!origin) return new Response(JSON.stringify({ error: 'Missing return origin' }), { status: 400, headers: corsHeaders });

    const { data: profile } = await supabase.from('profiles').select('stripe_account_id, email').eq('id', user.id).single();
    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      const account = await stripeRequest('accounts', {
        type: 'express',
        email: profile?.email || user.email || '',
        'capabilities[transfers][requested]': 'true',
        'metadata[app_user_id]': user.id,
      });
      accountId = account.id;
      await admin.from('profiles').update({ stripe_account_id: accountId, payouts_enabled: false }).eq('id', user.id);
    }

    if (action === 'refresh') {
      const account = await stripeRequest(`accounts/${accountId}`, undefined, 'GET');
      const enabled = Boolean(account?.payouts_enabled);
      await admin.from('profiles').update({ payouts_enabled: enabled }).eq('id', user.id);
      return new Response(JSON.stringify({ payoutsEnabled: enabled, accountId }), { headers: corsHeaders });
    }

    const link = await stripeRequest('account_links', {
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/profile?payouts=refresh`,
      return_url: `${origin}/profile?payouts=done`,
    });

    return new Response(JSON.stringify({ url: link.url, accountId }), { headers: corsHeaders });
  } catch (error) {
    console.error('stripeConnect failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Could not start payout setup.' }), { status: 500, headers: corsHeaders });
  }
});
