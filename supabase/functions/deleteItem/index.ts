import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

export async function handleDeleteItem(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  // postId is accepted solely for clients opened before the item migration.
  const id = body.itemId || body.postId;
  if (!id) return Response.json({ error: 'Missing item' }, { status: 400, headers: corsHeaders });
  const { data, error } = await client.rpc('delete_item', { p_item_id: id });
  return Response.json(error ? { error: error.message } : data, { status: error ? 400 : 200, headers: corsHeaders });
}
Deno.serve(handleDeleteItem);
