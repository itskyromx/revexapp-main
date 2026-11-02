import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_FRAMES = 8;

const PROMPT =
  'You are a fashion resale assistant analyzing frames taken from an item video. ' +
  'Detect each DISTINCT clothing or accessory item that appears in the footage — never list the same garment twice across frames. ' +
  'For each item provide: a short descriptive title (e.g. "Oversized denim jacket"), the brand if a logo or label is clearly visible (otherwise leave blank), ' +
  'the size if readable (otherwise leave blank), the category (one of tops, bottoms, dresses, outerwear, shoes, accessories, other), ' +
  'the condition (one of new_with_tags, like_new, good, fair), ' +
  'a fair resale price in EUR estimated from the brand, category and condition (no live market lookup), and 2-4 relevant aesthetic tags. ' +
  'Only include garments you can actually see. If no items are visible, return an empty items array. ' +
  'Respond ONLY with JSON: {"items":[{"title":"","brand":"","size":"","category":"","condition":"","price":0,"tags":[]}]}';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const frameUrls = Array.isArray(body?.frame_urls) ? body.frame_urls : [];

    if (frameUrls.length === 0 || frameUrls.length > MAX_FRAMES) {
      return new Response(JSON.stringify({ error: `Provide between 1 and ${MAX_FRAMES} frame URLs.` }), { status: 400, headers: corsHeaders });
    }
    const validUrls = frameUrls.every((u) => typeof u === 'string' && /^https?:\/\//.test(u));
    if (!validUrls) return new Response(JSON.stringify({ error: 'Invalid frame URL.' }), { status: 400, headers: corsHeaders });

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }), { status: 500, headers: corsHeaders });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            ...frameUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{"items":[]}');
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    return new Response(JSON.stringify({ items }), { headers: corsHeaders });
  } catch (error) {
    console.error('detectItems failed:', error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

