import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ArrowLeft, Tag, MessageCircle, ShieldCheck, Pencil, X, Upload, Loader2, ShoppingBag, Bookmark } from "lucide-react";
import Avatar from "@/components/Avatar";
import OfferSheet from "@/components/OfferSheet";
import CheckoutSheet from "@/components/CheckoutSheet";
import TryOnVideo from "@/components/TryOnVideo";
import TagChips from "@/components/TagChips";
import { formatPrice, CONDITION_LABELS, normalizeTags } from "@/lib/revex";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import BottomNav from "@/components/BottomNav";

export default function ItemDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { isSaved } = useSaved(user?.id);
  const [item, setItem] = useState(null);
  const [post, setPost] = useState(null);
  const [offers, setOffers] = useState([]);
  const [showOffer, setShowOffer] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [counterFor, setCounterFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState([]);
  const [editVideo, setEditVideo] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyVideo, setBusyVideo] = useState(false);
  const [cancelNotice, setCancelNotice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: it } = await supabase.from('items').select('*').eq('id', itemId).single();
        setItem(it);
        if (it.post_id) {
          const { data: p } = await supabase.from('posts').select('*').eq('id', it.post_id).single();
          setPost(p);
        }
        if (it.created_by_id) {
          const { data: of } = await supabase.from('offers').select('*').eq('item_id', itemId);
          setOffers(of);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [itemId]);

  useEffect(() => {
    if (item) {
      setEditTags(item.tags || []);
      setEditVideo(item.try_on_video_url || "");
    }
  }, [item]);

  // They came back from Stripe without paying: close the unpaid order, free the
  // item, and clear the marker so nothing can bounce them back to Stripe.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    if (params.get("checkout") !== "cancel" || !orderId) return;
    setCancelNotice("Checkout cancelled — nothing was charged and the item is available again.");
    supabase.functions.invoke("cancelOrder", { body: { orderId } }).catch(() => {});
    window.history.replaceState({}, "", `/item/${itemId}`);
  }, [itemId]);

  const isOwner = user && item && user.id === item.created_by_id;

  const onPickEditVideo = async (file) => {
    if (!file) return;
    setBusyVideo(true);
    try {
      const path = `try-on/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from('media').upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
      setEditVideo(pub.publicUrl);
    } catch (e) { console.error(e); }
    setBusyVideo(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const tags = normalizeTags(editTags);
      await supabase.from('items').update({ tags, try_on_video_url: editVideo }).eq('id', item.id);
      setItem((it) => ({ ...it, tags, try_on_video_url: editVideo }));
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const submitOffer = async ({ amount, message }) => {
    const { data: o, error } = await supabase.from('offers').insert({
      item_id: item.id,
      item_title: item.title,
      item_image: item.image_url,
      item_price: item.price,
      seller_id: item.created_by_id,
      buyer_id: user.id,
      buyer_name: user.full_name || user.email,
      amount,
      message,
      status: "pending"
    }).select().single();
    if (error) throw error;
    setOffers((arr) => [...arr, o]);
    setShowOffer(false);
    navigate(`/chat/${item.created_by_id}?itemId=${item.id}`);
    supabase.functions.invoke('sendNotification', { body: {
      recipientId: item.created_by_id,
      title: 'New offer',
      content: `${user.full_name || user.email} offered ${formatPrice(amount)} on ${item.title}`,
      actionUrl: `/item/${item.id}`,
      type: 'offer',
      targetType: 'item',
      targetId: item.id,
      thumbnail: item.image_url || '',
    }}).catch(() => {});
  };

  const respond = async (offerId, status) => {
    await supabase.from('offers').update({ status }).eq('id', offerId);
    setOffers((arr) => arr.map((o) => o.id === offerId ? { ...o, status } : o));
    if (status === "accepted") {
      await supabase.from('items').update({ status: "reserved" }).eq('id', item.id);
      setItem((it) => ({ ...it, status: "reserved" }));
    }
  };

  const submitCounter = async ({ amount, message }) => {
    const { data: o, error } = await supabase.from('offers').insert({
      item_id: item.id,
      item_title: item.title,
      item_image: item.image_url,
      item_price: item.price,
      seller_id: item.created_by_id,
      buyer_id: counterFor.buyer_id,
      buyer_name: counterFor.buyer_name,
      initiator: "seller",
      amount,
      message,
      status: "pending"
    }).select().single();
    if (error) throw error;
    setOffers((arr) => [...arr, o]);
    setCounterFor(null);
    supabase.functions.invoke('sendNotification', { body: {
      recipientId: counterFor.buyer_id,
      title: 'Counter-offer',
      content: `${item.seller_name || "The seller"} offered you ${formatPrice(amount)} on ${item.title}`,
      actionUrl: '/inbox',
      type: 'offer',
      targetType: 'item',
      targetId: item.id,
      thumbnail: item.image_url || '',
    }}).catch(() => {});
  };

  const canBuy = item?.status === "available" && !isOwner;

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" /></div>;
  if (!item) return <div className="min-h-screen bg-background grid place-items-center p-6"><div className="acid-card p-6">Item not found.</div></div>;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b-[4px] border-border bg-background">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-display text-lg uppercase truncate">Item</span>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        {cancelNotice && <div className="acid-card-sm bg-muted p-3 mb-3 text-xs">{cancelNotice}</div>}
        {item.try_on_video_url && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="sticker bg-brand-red text-white px-2 py-0.5 text-xs">Try-On</span>
              <span className="acid-label">Watch it worn</span>
            </div>
            <TryOnVideo src={item.try_on_video_url} className="aspect-[3/4]" />
          </div>
        )}
        <div className="acid-card overflow-hidden">
          <div className="aspect-[4/5] bg-muted border-b-[3px] border-border relative">
            {item.image_url ?
              <img src={item.image_url} className="w-full h-full object-cover" alt={item.title} /> :
              <div className="w-full h-full grid-bg" />}
            {item.status !== "available" &&
              <span className="absolute top-3 left-3 sticker bg-black text-white px-3 py-1 uppercase">{item.status}</span>
            }
            <button
              onClick={() => toggleBookmark(user?.id, "item", item)}
              aria-label={isSaved("item", item.id) ? "Remove from saved" : "Save for later"}
              className="absolute top-3 right-3 sticker bg-black/70 border-white/30 w-10 h-10 rounded-full flex items-center justify-center"
            >
              <Bookmark className={`w-5 h-5 ${isSaved("item", item.id) ? "fill-brand-yellow text-brand-yellow" : "text-white"}`} />
            </button>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-heading font-bold text-sm text-muted-foreground uppercase">{item.brand || "Brand"}</p>
                <h1 className="font-display text-2xl uppercase leading-tight">{item.title}</h1>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-3xl">{formatPrice(item.price)}</p>
                <p className="text-xs text-muted-foreground">+ {formatPrice(item.shipping_price)} ship</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="acid-chip bg-muted">Size {item.size || "—"}</span>
              <span className="acid-chip bg-card">{CONDITION_LABELS[item.condition]}</span>
              {item.accepts_offers && <span className="acid-chip bg-brand-red text-white">Takes offers</span>}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.tags.map((t) => <span key={t} className="acid-chip bg-muted">#{t}</span>)}
              </div>
            )}
            {item.created_by_id && (
              <button onClick={() => navigate(`/profile/${item.created_by_id}`)} className="flex items-center gap-2 mt-4 w-full acid-card-sm bg-muted p-2">
                <Avatar name={item.seller_name} src={item.seller_avatar} size={36} />
                <div className="text-left">
                  <p className="font-heading font-bold text-sm">{item.seller_name}</p>
                  <p className="text-[10px] text-muted-foreground">View shop</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="mt-4 acid-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display uppercase text-lg">Edit Item</h3>
              <button onClick={() => setEditing((v) => !v)} className="acid-btn bg-muted text-foreground px-3 py-1 text-xs">
                {editing ? "Close" : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>
            {editing && (
              <>
                <div>
                  <span className="acid-label">Try-on video</span>
                  {editVideo ? (
                    <div className="relative mt-1">
                      <video src={editVideo} className="w-full aspect-[3/4] object-cover border-2 border-border bg-black" controls playsInline muted />
                      <button onClick={() => setEditVideo("")} className="absolute top-1 right-1 sticker bg-brand-red text-white w-7 h-7 rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <label className="acid-card-sm bg-muted p-3 flex flex-col items-center gap-1 cursor-pointer mt-1">
                      {busyVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      <span className="text-xs font-heading uppercase">Upload try-on clip</span>
                      <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files && onPickEditVideo(e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div>
                  <span className="acid-label">Tags</span>
                  <div className="mt-1"><TagChips value={editTags} onChange={setEditTags} /></div>
                </div>
                <button disabled={saving} onClick={saveEdit} className="acid-btn bg-brand-red text-white w-full">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Owner actions */}
        {isOwner ? (
          <div className="mt-4 acid-card p-4">
            <h3 className="font-display uppercase text-lg mb-2">Offers ({offers.length})</h3>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers yet — sit tight.</p>
            ) : (
              <div className="space-y-2">
                {offers.map((o) => (
                  <div key={o.id} className="acid-card-sm bg-muted p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm truncate">{o.buyer_name}</p>
                      <p className="text-xs text-muted-foreground">Offered {formatPrice(o.amount)}</p>
                      {o.message && <p className="text-xs italic truncate">"{o.message}"</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {o.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => respond(o.id, "accepted")} className="acid-btn bg-brand-red text-white px-3 py-1 text-xs">Accept</button>
                          <button onClick={() => respond(o.id, "rejected")} className="acid-btn bg-card text-foreground px-3 py-1 text-xs">Decline</button>
                        </div>
                      ) : (
                        <span className="acid-chip bg-card uppercase">{o.status}</span>
                      )}
                      {o.initiator !== "seller" && o.status === "pending" && (
                        <button onClick={() => setCounterFor(o)} className="acid-btn bg-muted text-foreground px-3 py-1 text-xs">Counter</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {canBuy && (
              <button onClick={() => setShowCheckout(true)} className="acid-btn bg-brand-red text-white w-full">
                <ShoppingBag className="w-4 h-4" /> Buy now
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {item.accepts_offers && (
                <button onClick={() => setShowOffer(true)} className="acid-btn bg-muted text-foreground"><Tag className="w-4 h-4" /> Make Offer</button>
              )}
              <button onClick={() => item.created_by_id && navigate(`/chat/${item.created_by_id}?itemId=${item.id}`)}
                className={`acid-btn bg-foreground text-background ${item.accepts_offers ? "" : "col-span-2"}`}>
                <MessageCircle className="w-4 h-4" /> Message Seller
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 acid-card-sm bg-card p-3 flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <p className="text-xs text-muted-foreground">Buyer Protection: your money is held until you confirm the item arrived as described. A 4% + €0.60 fee applies at checkout.</p>
        </div>
      </div>

      {showOffer && <OfferSheet item={item} onClose={() => setShowOffer(false)} onSubmitted={submitOffer} />}
      {counterFor && (
        <OfferSheet
          item={item}
          title="Counter Offer"
          recipient={counterFor.buyer_name}
          defaultAmount={Math.round((Number(counterFor.amount) + Number(item.price)) / 2)}
          onClose={() => setCounterFor(null)}
          onSubmitted={submitCounter}
        />
      )}
      {showCheckout && <CheckoutSheet item={item} onClose={() => setShowCheckout(false)} />}
      <BottomNav />
    </div>
  );
}