import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { safeOrigin, stripeRequest } from '../_shared/stripe.ts';

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function customerFor(admin: ReturnType<typeof createClient>, user: { id: string; email?: string }) {
  const { data: profile, error } = await admin.from('profiles').select('stripe_customer_id,email').eq('id', user.id).single();
  if (error) throw error;
  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string;
  const customer = await stripeRequest('customers', { email: profile?.email || user.email || '', 'metadata[app_user_id]': user.id });
  const { error: updateError } = await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
  if (updateError) throw updateError;
  return customer.id as string;
}

async function methodsFor(customerId: string) {
  const result = await stripeRequest('payment_methods', { customer: customerId, type: 'card', limit: '100' }, 'GET');
  return result?.data || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  try {
    if (!Deno.env.get('STRIPE_SECRET_KEY')) return reply({ error: 'Stripe is not configured.' }, 503);
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = req.headers.get('Authorization');
    if (!authorization) return reply({ error: 'Sign in is required.' }, 401);
    const supabase = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return reply({ error: 'Sign in is required.' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');
    const customerId = await customerFor(admin, user);

    if (action === 'create_setup') {
      const origin = safeOrigin(body.origin);
      if (!origin) return reply({ error: 'A return origin is required.' }, 400);
      const session = await stripeRequest('checkout/sessions', {
        mode: 'setup', customer: customerId, 'payment_method_types[0]': 'card',
        'metadata[app_user_id]': user.id,
        success_url: `${origin}/settings?payment_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings?payment_setup=cancelled`,
      });
      return reply({ url: session.url });
    }

    if (action === 'finish_setup') {
      const sessionId = String(body.sessionId || '');
      if (!sessionId) return reply({ error: 'Setup session is missing.' }, 400);
      const session = await stripeRequest(`checkout/sessions/${sessionId}`, undefined, 'GET');
      const sessionCustomer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (session.mode !== 'setup' || sessionCustomer !== customerId || session.metadata?.app_user_id !== user.id) return reply({ error: 'This card setup does not belong to your account.' }, 403);
      const setupIntentId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
      if (!setupIntentId) return reply({ error: 'Card setup has not completed.' }, 409);
      const setupIntent = await stripeRequest(`setup_intents/${setupIntentId}`, undefined, 'GET');
      if (setupIntent.status !== 'succeeded') return reply({ error: 'Card setup has not completed.' }, 409);
      const customer = await stripeRequest(`customers/${customerId}`, undefined, 'GET');
      const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
      if (paymentMethodId && !customer.invoice_settings?.default_payment_method) {
        await stripeRequest(`customers/${customerId}`, { 'invoice_settings[default_payment_method]': paymentMethodId });
      }
      return reply({ ok: true });
    }

    if (action === 'set_default' || action === 'remove') {
      const paymentMethodId = String(body.paymentMethodId || '');
      if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) return reply({ error: 'A valid saved card is required.' }, 400);
      const paymentMethod = await stripeRequest(`payment_methods/${paymentMethodId}`, undefined, 'GET');
      const ownerId = typeof paymentMethod.customer === 'string' ? paymentMethod.customer : paymentMethod.customer?.id;
      if (ownerId !== customerId || paymentMethod.type !== 'card') return reply({ error: 'This card does not belong to your account.' }, 403);
      if (action === 'set_default') {
        await stripeRequest(`customers/${customerId}`, { 'invoice_settings[default_payment_method]': paymentMethodId });
        return reply({ ok: true });
      }
      const customer = await stripeRequest(`customers/${customerId}`, undefined, 'GET');
      await stripeRequest(`payment_methods/${paymentMethodId}/detach`);
      if (customer.invoice_settings?.default_payment_method === paymentMethodId) {
        const remaining = await methodsFor(customerId);
        await stripeRequest(`customers/${customerId}`, { 'invoice_settings[default_payment_method]': remaining[0]?.id || '' });
      }
      return reply({ ok: true });
    }

    if (action !== 'list') return reply({ error: 'Unsupported payment method action.' }, 400);
    const [methods, customer] = await Promise.all([
      methodsFor(customerId),
      stripeRequest(`customers/${customerId}`, undefined, 'GET'),
    ]);
    return reply({
      paymentMethods: methods.map((method: any) => ({
        id: method.id,
        brand: method.card?.display_brand || method.card?.brand || 'Card',
        last4: method.card?.last4 || '••••',
        expMonth: method.card?.exp_month,
        expYear: method.card?.exp_year,
      })),
      defaultPaymentMethod: typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id || '',
    });
  } catch (error) {
    console.error('managePaymentMethods failed:', error);
    return reply({ error: error instanceof Error ? error.message : 'Could not manage payment methods.' }, 500);
  }
});
