import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BUCKET_NAME = "revex-product-embeddings";
const INDEX_NAME = "revex-products-bge-m3";
const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const EMBEDDING_DIMENSION = 1024;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function productText(item: Record<string, unknown>) {
  const title = String(item.title || "none").replaceAll("|", " ").trim() || "none";
  const content = [
    item.brand, item.description, item.gender, item.category, item.subcategory,
    item.condition, item.size, ...(Array.isArray(item.styles) ? item.styles : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].filter(Boolean).join(" | ").slice(0, 6000);
  return `title: ${title} | text: ${content}`;
}

async function embed(text: string) {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim();
  const apiToken = Deno.env.get("CLOUDFLARE_AI_API_TOKEN")?.trim();
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Workers AI is not configured for product semantics.");
  }

  const result = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${EMBEDDING_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text] }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await result.json().catch(() => ({}));
  if (!result.ok || payload?.success === false) {
    const details = Array.isArray(payload?.errors)
      ? payload.errors.map((entry: { code?: number; message?: string }) => [entry.code, entry.message].filter(Boolean).join(": ")).filter(Boolean).join("; ")
      : "";
    throw new Error(`Cloudflare Workers AI request failed (${result.status})${details ? `: ${details}` : "."}`);
  }
  const vector = payload?.result?.data?.[0];
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSION) {
    throw new Error("Cloudflare Workers AI returned an invalid BGE-M3 vector.");
  }
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
    const publish = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const secret = Deno.env.get("SUPABASE_SECRET_KEYS");
    const authorization = req.headers.get("Authorization");
    if (!url || !publish || !secret || !authorization) return response({ error: "Sign in is required." }, 401);

    const client = createClient(url, publish, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return response({ error: "Sign in is required." }, 401);

    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode;
    if (!Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || !Deno.env.get("CLOUDFLARE_AI_API_TOKEN")) {
      return response({ error: "Cloudflare Workers AI is not configured for product semantics." }, 503);
    }
    const index = await getProductIndex(admin);

    if (mode === "upsert") {
      const itemId = String(body.itemId || "");
      if (!itemId) return response({ error: "A product ID is required." }, 400);
      const { data: owned } = await client.from("items").select("id").eq("id", itemId).eq("created_by_id", user.id).eq("is_archived", false).maybeSingle();
      if (!owned) return response({ error: "Product not found." }, 404);
      const { data: item, error } = await client.from("items").select("*").eq("id", itemId).eq("is_archived", false).maybeSingle();
      if (error || !item) return response({ error: "Product not found." }, 404);
      const embedding = await embed(productText(item));
      const styles = (
        Array.isArray(item.styles) && item.styles.length
          ? item.styles
          : Array.isArray(item.tags) ? item.tags : []
      ).map(String).filter(Boolean);
      const { error: storeError } = await index.putVectors({ vectors: [{
        key: item.id,
        data: { float32: embedding },
        metadata: {
          item_id: item.id, owner_id: item.created_by_id, status: item.status,
          gender: item.gender || "unisex", category: item.category || "",
          subcategory: item.subcategory || "", brand: item.brand || "",
          ...(styles.length ? { styles } : {}),
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
      const { data: product } = await client.from("items").select("*").eq("id", itemId).eq("is_archived", false).maybeSingle();
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
    if (!itemIds.length) return response({ itemIds: [] });
    // Vector metadata may predate an archive action. Recheck live visibility
    // through the caller's RLS permissions before returning any identifiers.
    const { data: visibleItems, error: visibilityError } = await client.from("items").select("id")
      .in("id", itemIds).eq("status", "available").eq("is_archived", false);
    if (visibilityError) throw visibilityError;
    const visibleIds = new Set((visibleItems || []).map(item => item.id));
    return response({ itemIds: itemIds.filter(id => visibleIds.has(id)) });
  } catch (error) {
    console.error("Product semantics failed", error);
    const message = error instanceof Error ? error.message : "Product semantics failed.";
    const status = message.includes("not configured for product semantics") ? 503
      : message.includes("Cloudflare Workers AI") ? 502 : 500;
    return response({ error: message }, status);
  }
});