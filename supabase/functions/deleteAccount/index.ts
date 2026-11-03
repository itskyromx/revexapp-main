import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'Confirmation text did not match.' }), { status: 400, headers: corsHeaders });
    }

    const id = user.id;
    const step = async (label, fn) => { try { await fn(); } catch (e) { console.error('deleteAccount ' + label, e?.message || e); } };

    await step('items', () => admin.from('items').delete().eq('created_by_id', id));
    await step('drafts', () => admin.from('drafts').delete().eq('created_by_id', id));
    await step('messages', () => admin.from('chat_messages').delete().eq('sender_id', id));
    await step('chat_reads', () => admin.from('chat_reads').delete().or(`user_id.eq.${id},other_id.eq.${id}`));
    await step('chat_clears', () => admin.from('chat_clears').delete().eq('user_id', id));
    await step('saved', () => admin.from('saved').delete().eq('user_id', id));
    await step('offers bought', () => admin.from('offers').delete().eq('buyer_id', id));
    await step('offers sold', () => admin.from('offers').delete().eq('seller_id', id));
    await step('following', () => admin.from('follows').delete().eq('follower_id', id));
    await step('followers', () => admin.from('follows').delete().eq('followee_id', id));
    await step('blocks made', () => admin.from('blocks').delete().eq('blocker_id', id));
    await step('blocks received', () => admin.from('blocks').delete().eq('blocked_id', id));
    await step('warnings', () => admin.from('warnings').delete().eq('user_id', id));
    await step('reports made', () => admin.from('reports').delete().eq('reporter_id', id));
    await step('notifications', () => admin.from('notifications').delete().eq('recipient_id', id));

    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error) {
    console.error('deleteAccount failed:', error?.message || error);
    return new Response(JSON.stringify({ error: 'Could not delete the account.' }), { status: 500, headers: corsHeaders });
  }
});

