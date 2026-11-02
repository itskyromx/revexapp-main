import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase, uploadPublicFile } from "@/api/supabaseClient";
import * as Dialog from "@radix-ui/react-dialog";
import TagChips from "@/components/TagChips";
import { CONDITION_LABELS, PRODUCT_BRANDS, PRODUCT_CATEGORIES, PRODUCT_GENDERS, PRODUCT_GENDER_LABELS, normalizeTags } from "@/lib/revex";

export default function EditItemSheet({ item, userId, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    title: item.title || "", description: item.description || "", brand: item.brand || "",
    size: item.size || "", condition: item.condition || "good", price: String(item.price ?? ""),
    shipping_price: String(item.shipping_price ?? 0), category: item.category || "shirts",
    subcategory: item.subcategory || "", gender: item.gender || "unisex",
    tags: item.tags || [], styles: item.styles || [], accepts_offers: Boolean(item.accepts_offers),
  }));
  const [photos, setPhotos] = useState(() => item.image_urls?.length ? [...item.image_urls] : item.image_url ? [item.image_url] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const upload = async (files) => {
    if (!files.length || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("Please choose image files only.");
        const { file_url } = await uploadPublicFile(file, "items");
        setPhotos((current) => [...current, file_url]);
      }
    } catch (err) {
      setError(err.message || "Could not upload photos. Please try again.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const movePhoto = (index, direction) => setPhotos((current) => {
    const next = [...current];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    return next;
  });

  const save = async (event) => {
    event.preventDefault();
    if (locked.current || userId !== item.created_by_id) return;
    if (!draft.title.trim() || !draft.description.trim() || !photos.length ||
      !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0 ||
      !Number.isFinite(Number(draft.shipping_price)) || Number(draft.shipping_price) < 0) {
      setError("Add a name, description, at least one photo, a positive price and valid shipping cost.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...draft, title: draft.title.trim(), description: draft.description.trim(),
        brand: draft.brand.trim(), size: draft.size.trim(), price: Number(draft.price),
        shipping_price: Number(draft.shipping_price), tags: normalizeTags(draft.tags),
        styles: normalizeTags(draft.styles), image_url: photos[0], image_urls: photos,
      };
      const { data: updated, error: itemError } = await supabase.from("items").update(payload)
        .eq("id", item.id).eq("created_by_id", userId).select().single();
      if (itemError) throw itemError;
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Could not save changes. Please try again.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !locked.current) onClose(); }}>
      <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg max-h-[92dvh] overflow-y-auto border-[3px] border-border bg-background p-5 animate-in slide-in-from-bottom">
        <div className="pr-8">
          <Dialog.Title className="font-display text-2xl uppercase">Edit item</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">Update your listing. The first photo is the cover.</Dialog.Description>
        </div>
        <Dialog.Close disabled={busy} aria-label="Close editor" className="absolute top-4 right-4 p-1"><X className="w-5 h-5" /></Dialog.Close>
        <form onSubmit={save} className="mt-4 space-y-4">
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <div className="space-y-2">
              <label className="acid-label" htmlFor="edit-photos">Photos</label>
              <input id="edit-photos" type="file" accept="image/*" multiple className="acid-input" onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                void upload(files);
              }} />
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, index) => <div key={`${url}-${index}`} className="relative border-2 border-border">
                  <img src={url} alt={`Photo ${index + 1}`} className="aspect-square w-full object-cover" />
                  <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 bg-brand-red text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                  <div className="flex justify-between bg-card">
                    <button type="button" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => movePhoto(index, -1)} className="p-1 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs self-center">{index === 0 ? "Cover" : index + 1}</span>
                    <button type="button" aria-label={`Move photo ${index + 1} later`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)} className="p-1 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>)}
              </div>
            </div>
            <label className="block space-y-1"><span className="acid-label">Name</span><input required maxLength={100} className="acid-input" value={draft.title} onChange={(e) => update("title", e.target.value)} /></label>
            <label className="block space-y-1"><span className="acid-label">Description</span><textarea required maxLength={1500} rows={4} className="acid-input" value={draft.description} onChange={(e) => update("description", e.target.value)} /></label>
            <label className="block space-y-1"><span className="acid-label">Brand</span><input list="edit-brands" className="acid-input" value={draft.brand} onChange={(e) => update("brand", e.target.value)} /><datalist id="edit-brands">{PRODUCT_BRANDS.map((brand) => <option key={brand} value={brand} />)}</datalist></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className="acid-label">Price (€)</span><input required type="number" min="0.01" step="0.01" className="acid-input" value={draft.price} onChange={(e) => update("price", e.target.value)} /></label>
              <label className="space-y-1"><span className="acid-label">Size</span><input maxLength={24} className="acid-input" value={draft.size} onChange={(e) => update("size", e.target.value)} /></label>
              <label className="space-y-1"><span className="acid-label">Condition</span><select className="acid-input" value={draft.condition} onChange={(e) => update("condition", e.target.value)}>{Object.entries(CONDITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="acid-label">Shop for</span><select className="acid-input" value={draft.gender} onChange={(e) => update("gender", e.target.value)}>{PRODUCT_GENDERS.map((gender) => <option key={gender} value={gender}>{PRODUCT_GENDER_LABELS[gender]}</option>)}</select></label>
            <label className="block space-y-1"><span className="acid-label">Category</span><select className="acid-input" value={draft.category} onChange={(e) => {
              update("category", e.target.value);
              update("subcategory", PRODUCT_CATEGORIES[e.target.value].subcategories[0]);
            }}>{!PRODUCT_CATEGORIES[draft.category] && <option value={draft.category}>{draft.category}</option>}{Object.entries(PRODUCT_CATEGORIES).map(([key, category]) => <option key={key} value={key}>{category.label}</option>)}</select></label>
            <label className="block space-y-1"><span className="acid-label">Subcategory</span><input list="edit-subcategories" className="acid-input" value={draft.subcategory} onChange={(e) => update("subcategory", e.target.value)} /><datalist id="edit-subcategories">{(PRODUCT_CATEGORIES[draft.category]?.subcategories || []).map((value) => <option key={value} value={value} />)}</datalist></label>
            <div className="space-y-1"><span className="acid-label">Tags</span><TagChips value={draft.tags} onChange={(tags) => update("tags", tags)} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.accepts_offers} onChange={(e) => update("accepts_offers", e.target.checked)} /><span className="acid-label">Accept offers</span></label>
          </fieldset>
          {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="acid-btn bg-muted flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="acid-btn bg-brand-red text-white flex-1 disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
