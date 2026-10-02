import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase, uploadPublicFile } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SiteHeader from "@/components/SiteHeader";
import BottomNav from "@/components/BottomNav";
import { Loader2, Upload, X, Plus, Trash2, Image as ImageIcon, Sparkles, Video as VideoIcon } from "lucide-react";
import { POST_CATEGORIES, POST_CATEGORY_LABELS, normalizeTags } from "@/lib/revex";
import TagChips from "@/components/TagChips";
import CameraRecorder from "@/components/CameraRecorder";
import { detectHaulItems } from "@/lib/aiSuggest";
import HaulScanSheet from "@/components/HaulScanSheet";
import { useIsMobile } from "@/hooks/use-mobile";

const blankItem = () => ({
  title: "", brand: "", size: "", condition: "good", price: "", shipping_price: "3",
  image_url: "", category: "tops", try_on_video_url: "", tags: []
});

export default function UploadPage() {
  const navigate = useNavigate();
  const { draftId: routeDraftId } = useParams();
  const { user } = useCurrentUser();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [media, setMedia] = useState([]);
  const [haulTitle, setHaulTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("hauls");
  const [items, setItems] = useState([blankItem()]);
  const isMobile = useIsMobile();
  const [showCamera, setShowCamera] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [draftId, setDraftId] = useState(routeDraftId || null);
  const [saveState, setSaveState] = useState("idle");
  const hydrated = useRef(false);
  const finished = useRef(false);

  // Resume the in-progress haul: the one opened from the Drafts tab, or the creator's most recent draft
  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;
    (async () => {
      try {
        let draft = null;
        if (routeDraftId) {
          const { data } = await supabase.from('drafts').select('*').eq('id', routeDraftId).single();
          draft = data;
        } else if (user?.id) {
          const { data: mine } = await supabase.from('drafts').select('*')
            .eq('created_by_id', user.id).order('updated_at', { ascending: false }).limit(1);
          draft = mine?.[0] || null;
        }
        if (cancelled || !draft) return;
        const m = (draft.media || []).map((x) => ({ url: x.url, type: x.type }));
        const its = Array.isArray(draft.items) && draft.items.length ? draft.items : [blankItem()];
        setDraftId(draft.id);
        setMedia(m);
        setHaulTitle(draft.haul_title || "");
        setCaption(draft.caption || "");
        setTags((draft.tags || []).join(", "));
        setCategory(draft.category || "hauls");
        setItems(its);
        setStep(m.length === 0 ? 1 : its.some((it) => (it.title || "").trim() || it.price) ? 3 : 2);
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [routeDraftId, user?.id]);

  const hasContent =
    media.length > 0 || !!haulTitle.trim() || !!caption.trim() || !!tags.trim() ||
    items.some((it) => (it.title || "").trim() || it.price || it.image_url || (it.tags && it.tags.length));

  const persist = async () => {
    if (finished.current) return;
    setSaveState("saving");
    const payload = {
      haul_title: haulTitle.trim(),
      caption: caption.trim(),
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      category,
      media: media.map((m) => ({ url: m.url, type: m.type })),
      items: items.map((it) => ({ ...it, tags: normalizeTags(it.tags) })),
    };
    try {
      if (draftId) {
        await supabase.from('drafts').update(payload).eq('id', draftId);
      } else {
        const { data: rec, error } = await supabase.from('drafts').insert(payload).select().single();
        if (error) throw error;
        setDraftId(rec.id);
      }
      setSaveState("saved");
    } catch (e) {
      console.error(e);
      setSaveState("idle");
    }
  };

  // Debounced autosave
  useEffect(() => {
    if (!hydrated.current || finished.current || !hasContent) return;
    setSaveState("saving");
    const t = setTimeout(() => { persist(); }, 900);
    return () => clearTimeout(t);
  }, [media, haulTitle, caption, tags, category, items, hasContent]);

  // Fade the "Saved" cue back out
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  const onPickFiles = async (files, kind) => {
    const arr = Array.from(files);
    for (const file of arr) {
      setBusy(true);
      try {
        const { file_url } = await uploadPublicFile(file, "posts");
        const type = file.type.startsWith("video") ? "video" : "image";
        if (kind === "media") {
          setMedia((m) => [...m, { url: file_url, type }]);
        } else {
          setItems((its) => its.map((it, i) => i === kind ? { ...it, image_url: file_url } : it));
        }
      } catch (e) { console.error(e); }
      setBusy(false);
    }
  };

  const onPickItemVideo = async (i, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const { file_url } = await uploadPublicFile(file, "try-on");
      updateItem(i, "try_on_video_url", file_url);
    } catch (e) { console.error(e); }
    setBusy(false);
  };

  const updateItem = (i, field, val) => {
    setItems((its) => its.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  const onRecorded = async (file, localUrl) => {
    setBusy(true);
    try {
      const { file_url } = await uploadPublicFile(file, "posts");
      setMedia((m) => [...m, { url: file_url, type: "video", localUrl }]);
      setShowCamera(false);
    } catch (e) { console.error(e); }
    setBusy(false);
  };

  const itemKey = (t, b) => `${(t || "").trim().toLowerCase()}|${(b || "").trim().toLowerCase()}`;

  const scanHaul = async () => {
    const haulVideo = media.find((m) => m.type === "video");
    if (!haulVideo) return;
    const src = haulVideo.localUrl || haulVideo.url;
    setScanError("");
    setSuggestions([]);
    setScanOpen(true);
    setScanning(true);
    try {
      const found = await detectHaulItems(src);
      const existing = new Set(items.map((it) => itemKey(it.title, it.brand)));
      const fresh = found
        .filter((s) => s && s.title)
        .map((s, i) => ({
          id: `s-${Date.now()}-${i}`,
          title: s.title || "",
          brand: s.brand || "",
          size: s.size || "",
          category: s.category || "tops",
          condition: s.condition || "good",
          price: s.price != null ? String(s.price) : "",
          tags: normalizeTags(s.tags || []),
          added: false,
        }))
        .filter((s) => !existing.has(itemKey(s.title, s.brand)));
      setSuggestions(fresh);
    } catch (e) {
      console.error(e);
      setScanError("We couldn't analyze this clip — please try again.");
    } finally {
      setScanning(false);
    }
  };

  const editSuggestion = (id, field, val) =>
    setSuggestions((ss) => ss.map((s) => (s.id === id ? { ...s, [field]: val } : s)));

  const addSuggestions = (ids) => {
    const chosen = suggestions.filter((s) => ids.includes(s.id) && !s.added);
    if (!chosen.length) return;
    setItems((its) => {
      const isBlank = (it) => !it.title.trim() && !it.price && !it.image_url && !(it.tags && it.tags.length);
      return [
        ...its.filter((it) => !isBlank(it)),
        ...chosen.map((s) => ({
          title: s.title,
          brand: s.brand,
          size: s.size,
          condition: s.condition,
          price: s.price,
          shipping_price: "3",
          image_url: "",
          category: s.category,
          try_on_video_url: "",
          tags: s.tags,
        })),
      ];
    });
    setSuggestions((ss) => ss.map((s) => (ids.includes(s.id) ? { ...s, added: true } : s)));
  };

  const addAllSuggestions = () => addSuggestions(suggestions.filter((s) => !s.added).map((s) => s.id));
  const addItem = () => setItems((its) => [...its, blankItem()]);
  const removeItem = (i) => setItems((its) => its.filter((_, idx) => idx !== i));

  const publish = async () => {
    if (!haulTitle.trim() || media.length === 0) return;
    setBusy(true);
    try {
      const name = user?.display_name || user?.full_name || user?.email || "Creator";
      const video = media.find((m) => m.type === "video");
      const images = media.filter((m) => m.type === "image").map((m) => m.url);
      const { data: post, error: postError } = await supabase.from('posts').insert({
        creator_name: name,
        creator_avatar: "",
        video_url: video?.url || "",
        image_urls: images,
        haul_title: haulTitle.trim(),
        caption: caption.trim(),
        tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
        category,
        like_count: 0, comment_count: 0, view_count: 0, share_count: 0,
        item_ids: []
      }).select().single();
      if (postError) throw postError;

      const created = [];
      for (const it of items) {
        if (!it.title.trim() || !it.price) continue;
        const { data: rec, error: itemError } = await supabase.from('items').insert({
          post_id: post.id,
          seller_name: name,
          seller_avatar: "",
          title: it.title.trim(),
          brand: it.brand.trim(),
          size: it.size.trim(),
          condition: it.condition,
          price: Number(it.price),
          shipping_price: Number(it.shipping_price || 0),
          image_url: it.image_url,
          try_on_video_url: it.try_on_video_url || "",
          tags: normalizeTags(it.tags),
          category: it.category,
          status: "available",
          accepts_offers: true
        }).select().single();
        if (itemError) throw itemError;
        created.push(rec.id);
      }
      if (created.length) {
        await supabase.from('posts').update({ item_ids: created }).eq('id', post.id);
      }
      finished.current = true;
      if (draftId) {
        await supabase.from('drafts').delete().eq('id', draftId).then(() => {});
      }
      navigate(`/profile/${user.id}`);
    } catch (e) {
      finished.current = false;
      alert("Upload failed: " + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <SiteHeader
        actions={(
          <div className="flex items-center gap-3">
            {saveState !== "idle" && (
              <span className="text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
                {saveState === "saving" ? "Saving…" : "Saved"}
              </span>
            )}
          </div>
        )}
      />

      <div className="max-w-md mx-auto p-4">
        {/* Stepper */}
        <div className="flex gap-2 mb-5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-2 border-2 border-border ${step >= s ? "bg-brand-red" : "bg-card"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <label className="acid-label">1. Add photos / video of your haul</label>
            {isMobile && (
              <button onClick={() => setShowCamera(true)} className="acid-btn bg-brand-red text-white w-full">
                <VideoIcon className="w-5 h-5" /> Record video
              </button>
            )}
            <label className="acid-card p-6 flex flex-col items-center justify-center gap-2 cursor-pointer border-dashed">
              {busy ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
              <span className="font-heading font-bold uppercase text-sm">{isMobile ? "Or upload from device" : "Tap to upload"}</span>
              <span className="text-xs text-muted-foreground">Video or photos — show how it fits!</span>
              <input type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={(e) => e.target.files && onPickFiles(e.target.files, "media")} />
            </label>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={i} className="aspect-square border-2 border-border overflow-hidden relative bg-black">
                    {m.type === "video" ? <video src={m.url} className="w-full h-full object-cover" muted /> : <img src={m.url} className="w-full h-full object-cover" alt="" />}
                    <button onClick={() => setMedia((arr) => arr.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 sticker bg-brand-red text-white w-6 h-6 rounded-full flex items-center justify-center">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isMobile && media.some((m) => m.type === "video") && (
              <button onClick={scanHaul} disabled={scanning} className="acid-btn bg-foreground text-background w-full disabled:opacity-50">
                {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your haul…</> : <><Sparkles className="w-4 h-4" /> Scan with AI</>}
              </button>
            )}
            <button disabled={media.length === 0} onClick={() => setStep(2)} className="acid-btn bg-foreground text-background w-full disabled:opacity-40">
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="acid-label">2. Haul details</label>
            <div>
              <span className="acid-label">Title</span>
              <input className="acid-input mt-1" placeholder="Vintage Levi's Try-On Haul" value={haulTitle} onChange={(e) => setHaulTitle(e.target.value)} />
            </div>
            <div>
              <span className="acid-label">Caption</span>
              <textarea rows={3} className="acid-input mt-1 resize-none" placeholder="Tell the story..." value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div>
              <span className="acid-label">Tags (comma separated)</span>
              <input className="acid-input mt-1" placeholder="y2k, thrifting, vintage" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div>
              <span className="acid-label">Category</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {POST_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`acid-chip ${category === c ? "bg-brand-red text-white" : "bg-card text-foreground"}`}>
                    {POST_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="acid-btn bg-muted text-foreground flex-1">Back</button>
              <button disabled={!haulTitle.trim()} onClick={() => setStep(3)} className="acid-btn bg-foreground text-background flex-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="acid-label">3. List items for sale</label>
            {items.map((it, i) => (
              <div key={i} className="acid-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display uppercase">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="sticker bg-brand-red text-white w-7 h-7 rounded-full flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="w-20 h-20 border-2 border-border bg-muted flex items-center justify-center cursor-pointer shrink-0 overflow-hidden">
                    {it.image_url ? <img src={it.image_url} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && onPickFiles(e.target.files, i)} />
                  </label>
                  <div className="flex-1 space-y-1.5">
                    <input className="acid-input py-1.5 text-sm" placeholder="Title" value={it.title} onChange={(e) => updateItem(i, "title", e.target.value)} />
                    <input className="acid-input py-1.5 text-sm" placeholder="Brand" value={it.brand} onChange={(e) => updateItem(i, "brand", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <input className="acid-input py-1.5 text-sm" placeholder="Size" value={it.size} onChange={(e) => updateItem(i, "size", e.target.value)} />
                  <input className="acid-input py-1.5 text-sm" placeholder="€ Price" type="number" value={it.price} onChange={(e) => updateItem(i, "price", e.target.value)} />
                  <input className="acid-input py-1.5 text-sm" placeholder="€ Ship" type="number" value={it.shipping_price} onChange={(e) => updateItem(i, "shipping_price", e.target.value)} />
                </div>
                <select className="acid-input py-1.5 text-sm" value={it.condition} onChange={(e) => updateItem(i, "condition", e.target.value)}>
                  <option value="new_with_tags">New With Tags</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
                <div>
                  <span className="acid-label">Try-on video (optional)</span>
                  {it.try_on_video_url ? (
                    <div className="relative mt-1">
                      <video src={it.try_on_video_url} className="w-full aspect-[3/4] object-cover border-2 border-border bg-black" controls playsInline muted />
                      <button onClick={() => updateItem(i, "try_on_video_url", "")}
                        className="absolute top-1 right-1 sticker bg-brand-red text-white w-7 h-7 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="acid-card-sm bg-muted p-3 flex flex-col items-center gap-1 cursor-pointer mt-1">
                      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      <span className="text-xs font-heading uppercase">Upload try-on clip</span>
                      <span className="text-[10px] text-muted-foreground">Short clip, &lt; 25MB</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files && onPickItemVideo(i, e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div>
                  <span className="acid-label">Tags</span>
                  <div className="mt-1"><TagChips value={it.tags} onChange={(arr) => updateItem(i, "tags", arr)} /></div>
                </div>
              </div>
            ))}
            <button onClick={addItem} className="acid-btn bg-muted text-foreground w-full"><Plus className="w-4 h-4" /> Add Item</button>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="acid-btn bg-muted text-foreground flex-1">Back</button>
              <button disabled={busy} onClick={publish} className="acid-btn bg-brand-red text-white flex-1">
                {busy ? "Publishing..." : "Publish Post"}
              </button>
            </div>
          </div>
        )}
      </div>
      {showCamera && (
        <CameraRecorder onRecorded={onRecorded} onClose={() => setShowCamera(false)} />
      )}
      {scanOpen && (
        <HaulScanSheet
          suggestions={suggestions}
          loading={scanning}
          error={scanError}
          onEdit={editSuggestion}
          onAdd={(id) => addSuggestions([id])}
          onAddAll={addAllSuggestions}
          onClose={() => setScanOpen(false)}
        />
      )}
      <BottomNav />
    </div>
  );
}