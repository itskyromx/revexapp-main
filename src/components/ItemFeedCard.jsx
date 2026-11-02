import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Share2, MessageCircle, Bookmark, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import Avatar from "@/components/Avatar";
import ShareSheet from "@/components/ShareSheet";
import { timeAgo } from "@/lib/revex";
import { useAuth } from "@/lib/useAuth";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import { refreshItemCounters, recordItemView, toggleItemLike } from "@/lib/itemStats";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import BoostBadge from "@/components/BoostBadge";
import ItemOwnerActions from "@/components/ItemOwnerActions";

function ActionButton({ icon: Icon, count, onClick, active = false, disabled = false, activeClass = "fill-brand-red text-brand-red" }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-50">
      <Icon
        className={`w-9 h-9 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)] ${active ? activeClass : "text-white"}`}
        strokeWidth={2.2}
      />
      {count !== null && <span className="text-white text-xs font-display drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{count}</span>}
    </button>
  );
}

export default function ItemFeedCard({ item, onOpenProfile, chromeVisible = true, onToggleChrome = undefined, onChanged = undefined, onDeleted = undefined }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSaved } = useSaved(user?.id);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [likeState, setLikeState] = useState(null);
  const viewer = useRef({ userId: user?.id, itemId: item.id });
  viewer.current = { userId: user?.id, itemId: item.id };
  const liked = Boolean(user?.id && likeState?.userId === user.id && likeState?.itemId === item.id && likeState.liked);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const [saveCount, setSaveCount] = useState(item.bookmark_count || 0);
  const [shareCount, setShareCount] = useState(item.share_count || 0);
  const [busyAction, setBusyAction] = useState(null);
  const [caption, setCaption] = useState(item.description || "");
  const [tags, setTags] = useState(item.tags || []);
  const [boostExpiresAt, setBoostExpiresAt] = useState(item.boost_expires_at || "");
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [burst, setBurst] = useState(false);

  const saved = isSaved("item", item.id);
  const isOwner = Boolean(user && item.created_by_id === user.id);

  useEffect(() => {
    recordItemView(item.id).catch(error => console.error(error));
  }, [item.id]);

  const requireLogin = () => {
    if (user?.id) return false;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    toast({
      title: "Login required",
      description: "Log in first to like, save, message, or share items.",
      action: <ToastAction altText="Log in" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}>Log in</ToastAction>,
    });
    return true;
  };

  const media = (item.image_urls?.length ? item.image_urls : item.image_url ? [item.image_url] : []).map((url) => ({ type: "image", url }));
  const current = media[mediaIndex];

  const captionLong = caption.length > 100;

  const lastTapRef = useRef(0);
  const burstTimer = useRef(null);
  const touchStartRef = useRef(null);
  const ignoreTapUntilRef = useRef(0);
  const [slideDirection, setSlideDirection] = useState(1);

  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  useEffect(() => {
    if (!user?.id || !item.id) return;
    let active = true;
    Promise.resolve(supabase.from("item_likes").select("item_id").eq("item_id", item.id).eq("user_id", user.id).maybeSingle())
      .then(({ data, error }) => {
        if (!error && active) setLikeState({ userId: user.id, itemId: item.id, liked: Boolean(data) });
      })
      .catch((error) => console.error(error));
    return () => { active = false; };
  }, [item.id, user?.id]);

  useEffect(() => {
    setLikeCount(item.like_count || 0);
    setSaveCount(item.bookmark_count || 0);
    setShareCount(item.share_count || 0);
  }, [item.id, item.like_count, item.bookmark_count, item.share_count]);

  useEffect(() => {
    setMediaIndex(0);
    setCaption(item.description || "");
    setTags(item.tags || []);
  }, [item.id, item.description, item.tags, item.image_urls]);

  const reconcileItem = async (updated) => {
    if (!updated) return;
    if (updated.like_count != null) setLikeCount(updated.like_count);
    if (updated.bookmark_count != null) setSaveCount(updated.bookmark_count);
    if (updated.share_count != null) setShareCount(updated.share_count);
    onChanged?.(updated);
  };

  // The single like path — used by the heart button and by a double tap.
  const applyLike = async (next) => {
    if (requireLogin()) return;
    if (busyAction || next === liked) return;
    setBusyAction("like");
    const actingUserId = user.id;
    try {
      const result = await toggleItemLike(item.id);
      if (!result) throw new Error("Like update did not return a result");
      if (viewer.current.userId !== actingUserId || viewer.current.itemId !== item.id) return;
      setLikeState({ userId: actingUserId, itemId: item.id, liked: result.liked });
      setLikeCount(result.like_count || 0);
      onChanged?.({ id: item.id, like_count: result.like_count });
      if (result.liked && item.created_by_id) {
        supabase.functions.invoke("sendNotification", { body: {
          recipientId: item.created_by_id,
          content: `liked your item "${item.title}"`,
          type: "like",
          targetType: "item",
          targetId: item.id,
          thumbnail: item.image_urls?.[0] || "",
          inAppOnly: true,
        }}).catch(() => {});
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleLike = () => applyLike(!liked);

  const showBurst = () => {
    setBurst(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 800);
  };

  // Double tap likes and flashes a heart; a single tap does nothing.
  const handleMediaTap = () => {
    if (Date.now() < ignoreTapUntilRef.current) return;
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      lastTapRef.current = 0;
      showBurst();
      if (!liked) applyLike(true);
    } else {
      lastTapRef.current = now;
    }
  };

  const toggleSave = async () => {
    if (requireLogin()) return;
    if (busyAction) return;
    setBusyAction("save");
    try {
      if (!user?.id) return;
      const wasSaved = saved;
      const next = await toggleBookmark(user.id, "item", item);
      if (next === wasSaved) return;
      const updated = (await refreshItemCounters([item.id]))[item.id];
      if (!updated) throw new Error("Bookmark update did not return a item");
      await reconcileItem(updated);
    } catch (error) {
      console.error(error);
    } finally {
      setBusyAction(null);
    }
  };

  const openChat = () => {
    if (requireLogin()) return;
    const itemId = item.id;
    navigate(`/chat/${item.created_by_id}${itemId ? `?itemId=${itemId}` : ""}`);
  };

  const share = () => {
    if (requireLogin()) return;
    setShareOpen(true);
  };

  const go = (delta) => {
    setSlideDirection(delta);
    setMediaIndex((i) => (i + delta + media.length) % media.length);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!touchStartRef.current || media.length < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      ignoreTapUntilRef.current = Date.now() + 500;
      go(dx < 0 ? 1 : -1);
    }
  };

  const handleToggleChrome = () => {
    setShareOpen(false);
    onToggleChrome?.();
  };

  return (
    <div className="relative w-full h-full snap-start overflow-hidden bg-black noise-overlay">
      {/* Media */}
      <div className="absolute inset-0">
        {current?.url ? (
          <img key={`${mediaIndex}:${current.url}`} src={current.url} alt={item.title} className="w-full h-full object-cover animate-item-slide" style={{ "--slide-from": `${slideDirection * 22}px` }} />
        ) : (
          <div className="w-full h-full grid-bg bg-muted" />
        )}
      </div>

      {/* Media tap layer — double tap to like, a single tap does nothing */}
      <button className="absolute inset-0 z-[5] touch-pan-y" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={handleMediaTap} aria-label="Double tap to like" />

      {/* Double-tap heart */}
      {burst && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <Heart className="w-24 h-24 fill-white text-white animate-heart-burst drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" />
        </div>
      )}

      {/* Carousel controls */}
      {chromeVisible && media.length > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-0 top-0 bottom-0 w-1/4 z-10 flex items-start justify-start pt-4">
            <ChevronLeft className="w-7 h-7 text-white/80 drop-shadow" />
          </button>
          <button onClick={() => go(1)} className="absolute right-0 top-0 bottom-0 w-1/3 z-10 flex items-start justify-end pt-4">
            <ChevronRight className="w-7 h-7 text-white/80 drop-shadow" />
          </button>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {media.map((_, i) => (
              <span key={i} className={`h-2 rounded-full border border-black ${i === mediaIndex ? "w-5 bg-brand-red" : "w-2 bg-white"}`} />
            ))}
          </div>
        </>
      )}

      {/* Gradient scrim */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

      {/* With the content hidden, this is the way back to the options sheet */}
      {!chromeVisible && onToggleChrome && (
        <button
          onClick={share}
          aria-label="More options"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/40 border-2 border-white/30 flex items-center justify-center"
        >
          <MoreHorizontal className="w-5 h-5 text-white" />
        </button>
      )}

      {chromeVisible && (
        <>
          {/* Creator row */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <button onClick={() => onOpenProfile?.(item.created_by_id)} className="flex items-center gap-2">
              <Avatar name={item.seller_name} src={item.seller_avatar} size={36} ring />
            </button>
            <div className="flex flex-col">
              <button onClick={() => onOpenProfile?.(item.created_by_id)} className="font-display text-sm text-white drop-shadow leading-none">
                @{item.seller_name?.split(" ")[0]?.toLowerCase() || "revexuser"}
              </button>
              <span className="text-[10px] text-white/70 font-heading">{timeAgo(item.created_at)}</span>
            </div>
          </div>

          {/* Boost marker + the creator's own controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            <BoostBadge item={{ ...item, boost_expires_at: boostExpiresAt }} />
            {isOwner && (
              <ItemOwnerActions
                item={{ ...item, description: caption, tags, boost_expires_at: boostExpiresAt }}
                onChanged={(updated) => {
                  setCaption(updated.description || "");
                  setTags(updated.tags || []);
                  setBoostExpiresAt(updated.boost_expires_at || "");
                  onChanged?.(updated);
                }}
                onDeleted={onDeleted}
              />
            )}
          </div>

          {/* Right action rail — borderless, TikTok-style */}
          <div className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-5">
            <ActionButton icon={Heart} count={likeCount} onClick={toggleLike} active={liked} disabled={busyAction === "like"} />
            {!isOwner && <ActionButton icon={MessageCircle} count={null} onClick={openChat} />}
            <ActionButton
              icon={Bookmark}
              count={saveCount}
              onClick={toggleSave}
              active={saved}
              activeClass="fill-brand-yellow text-brand-yellow"
              disabled={busyAction === "save"}
            />
            <ActionButton icon={Share2} count={shareCount} onClick={share} />
          </div>

          {/* Bottom info — caption + tags only, raised above bottom nav */}
          <div className="absolute bottom-20 left-3 right-20 z-20">
            {item && <button onClick={() => navigate(`/item/${item.id}`)} className="mb-2 inline-flex max-w-full items-center gap-2 border-2 border-white bg-black/60 px-2.5 py-1 text-left text-[11px] text-white">
              <span className="font-heading font-bold uppercase truncate">{item.brand || item.title}</span>
              <span className="shrink-0">{item.price ? `€${Number(item.price).toFixed(2)}` : "View item"}</span>
            </button>}
            {caption && (
              <p className={`text-sm text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${expanded ? "" : "line-clamp-2"}`}>
                {caption}
                {captionLong && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                    className="ml-1 text-white/70 font-heading">
                    {expanded ? "less" : "more"}
                  </button>
                )}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
                {tags.slice(0, 4).map((t) => (
                  <span key={t} className="text-white text-xs font-heading drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">#{t}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {shareOpen && (
        <ShareSheet
          item={item}
          chromeVisible={chromeVisible}
          onToggleChrome={onToggleChrome ? handleToggleChrome : undefined}
          onShared={(updated) => reconcileItem(updated)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
