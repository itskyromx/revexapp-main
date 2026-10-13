import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase, uploadPublicFile } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SiteHeader from "@/components/SiteHeader";
import BottomNav from "@/components/BottomNav";
import { Loader2, Upload, X } from "lucide-react";
import TagChips from "@/components/TagChips";
import { PRODUCT_BRANDS, PRODUCT_CATEGORIES, PRODUCT_GENDERS, PRODUCT_GENDER_LABELS, STYLE_TAGS, normalizeTags } from "@/lib/revex";
import { hasCookieConsent } from "@/lib/cookieConsent";

const blankProduct = () => ({
  title: "", brand: "", size: "", condition: "good", price: "", shipping_price: "",
  category: "shirts", subcategory: "T-shirt", gender: "unisex", description: "", styles: [],
});

export default function UploadPage() {
  const navigate = useNavigate();
  const { draftId: routeDraftId } = useParams();
  const { user } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState([]);
  const [product, setProduct] = useState(blankProduct);
  const [customBrand, setCustomBrand] = useState("");
  const [customBrandSelected, setCustomBrandSelected] = useState(false);
  const [draftId, setDraftId] = useState(routeDraftId || null);
  const [saveState, setSaveState] = useState("idle");
  const hydrated = useRef(false);
  const finished = useRef(false);
  const category = PRODUCT_CATEGORIES[product.category] || PRODUCT_CATEGORIES.shirts;

  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;
    (async () => {
      try {
        let draft = null;
        if (routeDraftId) {
          const { data } = await supabase.from("drafts").select("*").eq("id", routeDraftId).maybeSingle();
          draft = data;
        } else if (user?.id) {
          const { data } = await supabase.from("drafts").select("*").eq("created_by_id", user.id)
            .order("updated_at", { ascending: false }).limit(1);
          draft = data?.[0] || null;
        }
        if (cancelled || !draft) return;
        const oldProduct = Array.isArray(draft.items) ? draft.items[0] : null;
        const oldCategory = PRODUCT_CATEGORIES[draft.category] ? draft.category : "shirts";
        setDraftId(draft.id);
        setMedia((draft.media || []).filter((entry) => entry.type !== "video").map(({ url }) => ({ url, type: "image" })));
        setProduct({
          ...blankProduct(),
          ...oldProduct,
          title: oldProduct?.title || draft.haul_title || "",
          brand: oldProduct?.brand || "",
          price: oldProduct?.price?.toString?.() || "",
          shipping_price: oldProduct?.shipping_price?.toString?.() || "",
          description: oldProduct?.description || draft.caption || "",
          category: PRODUCT_CATEGORIES[oldProduct?.category] ? oldProduct.category : oldCategory,
          subcategory: oldProduct?.subcategory || PRODUCT_CATEGORIES[oldCategory].subcategories[0],
          gender: PRODUCT_GENDERS.includes(oldProduct?.gender) ? oldProduct.gender : "unisex",
          styles: normalizeTags(oldProduct?.styles || draft.tags || []),
        });
        if (oldProduct?.brand && !PRODUCT_BRANDS.includes(oldProduct.brand)) {
          setCustomBrand(oldProduct.brand);
          setCustomBrandSelected(true);
        }
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [routeDraftId, user?.id]);

  const hasContent = media.length > 0 || Boolean(product.title.trim() || product.description.trim() || product.price || product.brand.trim());

  const persist = async () => {
    if (finished.current || !user?.id) return;
    setSaveState("saving");
    const payload = {
      haul_title: product.title.trim(), caption: product.description.trim(), tags: normalizeTags(product.styles),
      category: product.category, media, items: [{ ...product, tags: normalizeTags(product.styles) }],
    };
    try {
      if (draftId) {
        const { error } = await supabase.from("drafts").update(payload).eq("id", draftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("drafts").insert({ ...payload, created_by_id: user.id }).select("id").single();
        if (error) throw error;
        setDraftId(data.id);
      }
      setSaveState("saved");
    } catch (error) {
      console.error("Could not save product draft", error);
      setSaveState("idle");
    }
  };

  useEffect(() => {
    if (!hydrated.current || finished.current || !hasContent) return undefined;
    const timer = setTimeout(persist, 900);
    return () => clearTimeout(timer);
  }, [media, product, hasContent]);

  useEffect(() => {
    if (saveState !== "saved") return undefined;
    const timer = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [saveState]);

  const update = (key, value) => setProduct((current) => ({ ...current, [key]: value }));

  const uploadPhotos = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const { file_url } = await uploadPublicFile(file, "items");
        uploaded.push({ url: file_url, type: "image" });
      }
      setMedia((current) => [...current, ...uploaded]);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not upload the selected photos.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (busy || !user?.id || media.length === 0 || !product.title.trim() || !product.description.trim() || !product.price) return;
    setBusy(true);
    try {
      const tags = normalizeTags(product.styles);
      const name = user.display_name || user.full_name || "Creator";
      const { data: post, error: postError } = await supabase.from("posts").insert({
        created_by_id: user.id, creator_name: name, creator_avatar: user.avatar || "",
        image_urls: media.map((entry) => entry.url), haul_title: product.title.trim(),
        caption: product.description.trim(), tags, category: product.category,
        like_count: 0, comment_count: 0, view_count: 0, share_count: 0, item_ids: [],
      }).select().single();
      if (postError) throw postError;

      const { data: item, error: itemError } = await supabase.from("items").insert({
        created_by_id: user.id, post_id: post.id, seller_name: name, seller_avatar: user.avatar || "",
        title: product.title.trim(), description: product.description.trim(), brand: product.brand.trim(),
        size: product.size.trim(), condition: product.condition, price: Number(product.price),
        shipping_price: Number(product.shipping_price || 0), image_url: media[0]?.url || "",
        tags, styles: tags, category: product.category, subcategory: product.subcategory,
        gender: product.gender, status: "available", accepts_offers: true,
      }).select().single();
      if (itemError) {
        await supabase.from("posts").delete().eq("id", post.id).eq("created_by_id", user.id);
        throw itemError;
      }
      const { error: linkError } = await supabase.from("posts").update({ item_ids: [item.id] }).eq("id", post.id);
      if (linkError) throw linkError;

      finished.current = true;
      if (draftId) await supabase.from("drafts").delete().eq("id", draftId);
      if (hasCookieConsent("personalization")) {
        void supabase.functions.invoke("productSemantics", { body: { mode: "upsert", itemId: item.id } })
          .then(({ error }) => { if (error) console.warn("Product vector will be retried later", error); });
      }
      navigate(`/item/${item.id}`, { replace: true });
    } catch (error) {
      console.error("Product publication failed", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <SiteHeader actions={<span className="text-[10px] font-heading font-bold uppercase text-muted-foreground">{saveState === "saving" ? "Saving draft…" : saveState === "saved" ? "Draft saved" : ""}</span>} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="font-display text-2xl uppercase">Create a listing</h1>
          <p className="text-sm text-muted-foreground">One upload creates the product listing and its feed post.</p>
        </div>

        <section className="acid-card p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="acid-label">Photos</span><span className="text-xs text-muted-foreground">Add multiple photos of this item</span></div>
          <label className="acid-card-sm p-5 flex flex-col items-center justify-center gap-2 cursor-pointer border-dashed">
            {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
            <span className="font-heading font-bold uppercase text-sm">Choose photos</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => uploadPhotos(event.target.files)} />
          </label>
          {media.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {media.map((entry, index) => <div key={`${entry.url}-${index}`} className="aspect-square border-2 border-border overflow-hidden relative">
              <img src={entry.url} className="w-full h-full object-cover" alt={`Product photo ${index + 1}`} />
              <button type="button" aria-label="Remove photo" onClick={() => setMedia((current) => current.filter((_, i) => i !== index))} className="absolute top-1 right-1 sticker bg-brand-red text-white w-7 h-7 rounded-full"><X className="w-4 h-4" /></button>
            </div>)}
          </div>}
        </section>

        <section className="acid-card p-4 space-y-3">
          <label className="acid-label" htmlFor="product-title">Article title</label>
          <input id="product-title" className="acid-input" maxLength={100} placeholder="Vintage leather jacket" value={product.title} onChange={(event) => update("title", event.target.value)} />
          <label className="acid-label" htmlFor="product-description">Description</label>
          <textarea id="product-description" className="acid-input resize-y" rows={4} maxLength={1500} placeholder="Describe the fit, material, details and condition…" value={product.description} onChange={(event) => update("description", event.target.value)} />
          <span className="text-[10px] text-muted-foreground text-right">{product.description.length}/1500</span>
        </section>

        <section className="acid-card p-4 space-y-3">
          <span className="acid-label">Shop for</span>
          <div className="grid grid-cols-3 gap-2">
            {PRODUCT_GENDERS.map((gender) => <button type="button" key={gender} onClick={() => update("gender", gender)} className={`acid-chip justify-center ${product.gender === gender ? "bg-brand-red text-white" : "bg-card"}`}>{PRODUCT_GENDER_LABELS[gender]}</button>)}
          </div>
          <label className="acid-label" htmlFor="product-category">Clothing type</label>
          <select id="product-category" className="acid-input" value={product.category} onChange={(event) => {
            const next = event.target.value;
            update("category", next);
            update("subcategory", PRODUCT_CATEGORIES[next].subcategories[0]);
          }}>{Object.entries(PRODUCT_CATEGORIES).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select>
          <label className="acid-label" htmlFor="product-subcategory">Style / subcategory</label>
          <select id="product-subcategory" className="acid-input" value={product.subcategory} onChange={(event) => update("subcategory", event.target.value)}>{category.subcategories.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}</select>
          <label className="acid-label" htmlFor="product-brand">Brand</label>
          <select id="product-brand" className="acid-input" value={PRODUCT_BRANDS.includes(product.brand) ? product.brand : customBrandSelected ? "Other" : ""} onChange={(event) => {
            const isOther = event.target.value === "Other";
            setCustomBrandSelected(isOther);
            if (isOther) { setCustomBrand(""); update("brand", ""); }
            else { setCustomBrand(""); update("brand", event.target.value); }
          }}><option value="">Select a brand</option>{PRODUCT_BRANDS.map((brand) => <option value={brand} key={brand}>{brand}</option>)}</select>
          {customBrandSelected && <input className="acid-input" placeholder="Enter brand name" value={customBrand} onChange={(event) => { setCustomBrand(event.target.value); update("brand", event.target.value); }} />}
        </section>

        <section className="acid-card p-4 space-y-3">
          <span className="acid-label">Styles</span>
          <div className="flex flex-wrap gap-2">{STYLE_TAGS.map((style) => <button type="button" key={style} onClick={() => update("styles", product.styles.includes(style) ? product.styles.filter((entry) => entry !== style) : [...product.styles, style])} className={`acid-chip ${product.styles.includes(style) ? "bg-brand-red text-white" : "bg-card"}`}>{style}</button>)}</div>
          <div><span className="acid-label">More styles</span><div className="mt-1"><TagChips value={product.styles} onChange={(styles) => update("styles", normalizeTags(styles))} /></div></div>
        </section>

        <section className="acid-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1"><span className="acid-label">Price (€)</span><input className="acid-input" type="number" min="0.01" step="0.01" value={product.price} onChange={(event) => update("price", event.target.value)} /></label>
            <label className="space-y-1"><span className="acid-label">Shipping (€)</span><input className="acid-input" type="number" min="0" step="0.01" value={product.shipping_price} onChange={(event) => update("shipping_price", event.target.value)} /></label>
            <label className="space-y-1"><span className="acid-label">Size</span><input className="acid-input" maxLength={24} placeholder="M, 38, One size" value={product.size} onChange={(event) => update("size", event.target.value)} /></label>
            <label className="space-y-1"><span className="acid-label">Condition</span><select className="acid-input" value={product.condition} onChange={(event) => update("condition", event.target.value)}><option value="new_with_tags">New with tags</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>
          </div>
        </section>

        <button disabled={busy || media.length === 0 || !product.title.trim() || !product.description.trim() || !product.price} onClick={publish} className="acid-btn bg-brand-red text-white w-full disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{busy ? "Publishing…" : "Publish article and post"}
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
