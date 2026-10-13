import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET_NAME = "revex-product-embeddings";
const INDEX_NAME = "revex-products-openai-small";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function productText(item: Record<string, unknown>) {
  return [
    item.title, item.brand, item.description, item.gender, item.category, item.subcategory,
    item.condition, item.size, ...(Array.isArray(item.styles) ? item.styles : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].filter(Boolean).join(" | ").slice(0, 6000);
}

async function embed(text: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for product semantics.");
  const result = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text, dimensions: EMBEDDING_DIMENSION }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload?.error?.message || `Embedding service returned ${result.status}.`);
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSION) throw new Error("Embedding service returned an invalid vector.");
  return vector as number[];
}

async function getProductIndex(admin: ReturnType<typeof createClient>) {
  const vectors = admin.storage.vectors;
  const { data: bucketList, error: bucketListError } = await vectors.listBuckets({ prefix: BUCKET_NAME, maxResults: 100 });
  if (bucketListError) throw bucketListError;
  const bucketExists = bucketList?.vectorBuckets?.some((entry) => entry.vectorBucketName === BUCKET_NAME);
  if (!bucketExists) {
    const { error } = await vectors.createBucket(BUCKET_NAME);
    if (error) {
      const { data: verify } = await vectors.listBuckets({ prefix: BUCKET_NAME, maxResults: 100 });
      if (!verify?.vectorBuckets?.some((entry) => entry.vectorBucketName === BUCKET_NAME)) throw error;
    }
  }

  const bucket = vectors.from(BUCKET_NAME);
  const { data: indexes, error: indexListError } = await bucket.listIndexes();
  if (indexListError) throw indexListError;
  const indexExists = indexes?.indexes?.some((entry) => entry.indexName === INDEX_NAME);
  if (!indexExists) {
    const { error } = await bucket.createIndex({
      indexName: INDEX_NAME,
      dataType: "float32",
      dimension: EMBEDDING_DIMENSION,
      distanceMetric: "cosine",
    });
    if (error) {
      const { data: verify } = await bucket.listIndexes();
      if (!verify?.indexes?.some((entry) => entry.indexName === INDEX_NAME)) throw error;
    }
  }
  return bucket.index(INDEX_NAME);
}

async function getPreferences(client: ReturnType<typeof createClient>, userId: string) {
  const { data } = await client.from("profiles").select("style_preferences,favorite_brands").eq("id", userId).maybeSingle();
  return [
    ...(Array.isArray(data?.style_preferences) ? data.style_preferences : []),
    ...(Array.isArray(data?.favorite_brands) ? data.favorite_brands : []),
  ].map(String).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anonKey || !serviceKey || !authorization) return response({ error: "Sign in is required." }, 401);

    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return response({ error: "Sign in is required." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode;
    if (!Deno.env.get("OPENAI_API_KEY")) return response({ error: "OPENAI_API_KEY is not configured for product semantics." }, 503);
    const index = await getProductIndex(admin);

    if (mode === "upsert") {
      const itemId = String(body.itemId || "");
      if (!itemId) return response({ error: "A product ID is required." }, 400);
      const { data: owned } = await client.from("items").select("id").eq("id", itemId).eq("created_by_id", user.id).maybeSingle();
      if (!owned) return response({ error: "Product not found." }, 404);
      const { data: item, error } = await admin.from("items").select("*").eq("id", itemId).maybeSingle();
      if (error || !item) return response({ error: "Product not found." }, 404);
      const embedding = await embed(productText(item));
      const { error: storeError } = await index.putVectors({ vectors: [{
        key: item.id,
        data: { float32: embedding },
        metadata: {
          item_id: item.id, owner_id: item.created_by_id, status: item.status,
          gender: item.gender || "unisex", category: item.category || "",
          subcategory: item.subcategory || "", brand: item.brand || "",
          styles: item.styles || item.tags || [],
        },
      }] });
      if (storeError) throw storeError;
      return response({ ok: true });
    }

    let queryText = "";
    if (mode === "search") {
      queryText = String(body.query || "").trim().slice(0, 500);
      if (queryText.length < 3) return response({ itemIds: [] });
    } else if (mode === "recommend") {
      const preferences = await getPreferences(client, user.id);
      if (!preferences.length) return response({ itemIds: [] });
      queryText = `Clothing and fashion products in these styles and brands: ${preferences.join(", ")}`;
    } else if (mode === "similar") {
      const itemId = String(body.itemId || "");
      if (!itemId) return response({ error: "A product ID is required." }, 400);
      const { data: product } = await admin.from("items").select("*").eq("id", itemId).maybeSingle();
      if (!product) return response({ error: "Product not found." }, 404);
      const preferences = await getPreferences(client, user.id);
      queryText = `${productText(product)}${preferences.length ? ` | Viewer preferences: ${preferences.join(", ")}` : ""}`;
    } else {
      return response({ error: "Unsupported operation." }, 400);
    }

    const queryVector = await embed(queryText);
    const { data, error } = await index.queryVectors({
      queryVector: { float32: queryVector },
      topK: mode === "search" ? 50 : 30,
      filter: { status: "available" },
      returnMetadata: true,
      returnDistance: true,
    });
    if (error) throw error;
    const itemIds = (data?.vectors || []).map((match) => String(match.metadata?.item_id || match.key))
      .filter((id) => id && (mode !== "similar" || id !== String(body.itemId || "")));
    return response({ itemIds });
  } catch (error) {
    console.error("Product semantics failed", error);
    const message = error instanceof Error ? error.message : "Product semantics failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return response({ error: message }, status);
  }
});
