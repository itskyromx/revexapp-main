import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Share2, MessageCircle, Bookmark, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import Avatar from "@/components/Avatar";
import ShareSheet from "@/components/ShareSheet";
import { timeAgo, loadLiked, saveLiked } from "@/lib/revex";
import { useAuth } from "@/lib/AuthContext";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import BoostBadge from "@/components/BoostBadge";
import PostOwnerActions from "@/components/PostOwnerActions";

function ActionButton({ icon: Icon, count, onClick, active, activeClass = "fill-brand-red text-brand-red" }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <Icon
        className={`w-9 h-9 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)] ${active ? activeClass : "text-white"}`}
        strokeWidth={2.2}
      />
      {count !== null && <span className="text-white text-xs font-display drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{count}</span>}
    </button>
  );
}

export default function HaulCard({ post, onOpenProfile, chromeVisible = true, onToggleChrome, onChanged, onDeleted }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSaved } = useSaved(user?.id);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [liked, setLiked] = useState(() => loadLiked().has(post.id));
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [saveCount, setSaveCount] = useState(post.bookmark_count || 0);
  const [caption, setCaption] = useState(post.caption || "");
  const [tags, setTags] = useState(post.tags || []);
  const [boostExpiresAt, setBoostExpiresAt] = useState(post.boost_expires_at || "");
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [burst, setBurst] = useState(false);

  const saved = isSaved("post", post.id);
  const isOwner = Boolean(user && post.created_by_id === user.id);

  const media = post.video_url
    ? [{ type: "video", url: post.video_url }]
    : (post.image_urls || []).map((u) => ({ type: "image", url: u }));
  const current = media[mediaIndex];

  const captionLong = caption.length > 100;

  const lastTapRef = useRef(0);
  const burstTimer = useRef(null);

  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  // The single like path — used by the heart button and by a double tap.
  const applyLike = async (next) => {
    const likedSet = loadLiked();
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) likedSet.add(post.id); else likedSet.delete(post.id);
    saveLiked(likedSet);
    try {
      await supabase.from('posts').update({ like_count: Math.max(0, likeCount + (next ? 1 : -1)) }).eq('id', post.id);
    } catch {}
    if (next && post.created_by_id) {
      supabase.functions.invoke("sendNotification", { body: {
        recipientId: post.created_by_id,
        content: `liked your post "${post.haul_title}"`,
        type: "like",
        targetType: "post",
        targetId: post.id,
        thumbnail: post.image_urls?.[0] || "",
        inAppOnly: true,
      }}).catch(() => {});
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
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      showBurst();
      if (!liked) applyLike(true);
    } else {
      lastTapRef.current = now;
    }
  };

  const toggleSave = async () => {
    const next = await toggleBookmark(user?.id, "post", post);
    setSaveCount((c) => Math.max(0, c + (next ? 1 : -1)));
  };

  const openChat = () => {
    const itemId = post.item_ids?.[0];
    navigate(`/chat/${post.created_by_id}${itemId ? `?itemId=${itemId}` : ""}`);
  };

  const share = () => setShareOpen(true);

  const go = (delta) => setMediaIndex((i) => (i + delta + media.length) % media.length);

  const handleToggleChrome = () => {
    setShareOpen(false);
    onToggleChrome?.();
  };

  return (
    <div className="relative w-full h-full snap-start overflow-hidden bg-black noise-overlay">
      {/* Media */}
      <div className="absolute inset-0">
        {current?.type === "video" ? (
          <video src={current.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />
        ) : current?.url ? (
          <img src={current.url} alt={post.haul_title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid-bg bg-muted" />
        )}
      </div>

      {/* Media tap layer — double tap to like, a single tap does nothing */}
      <button className="absolute inset-0 z-[5]" onClick={handleMediaTap} aria-label="Double tap to like" />

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
            <button onClick={() => onOpenProfile?.(post.created_by_id)} className="flex items-center gap-2">
              <Avatar name={post.creator_name} src={post.creator_avatar} size={36} ring />
            </button>
            <div className="flex flex-col">
              <button onClick={() => onOpenProfile?.(post.created_by_id)} className="font-display text-sm text-white drop-shadow leading-none">
                @{post.creator_name?.split(" ")[0]?.toLowerCase() || "revexuser"}
              </button>
              <span className="text-[10px] text-white/70 font-heading">{timeAgo(post.created_at)} ago</span>
            </div>
          </div>

          {/* Boost marker + the creator's own controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            <BoostBadge post={{ ...post, boost_expires_at: boostExpiresAt }} />
            {isOwner && (
              <PostOwnerActions
                post={{ ...post, caption, tags, boost_expires_at: boostExpiresAt }}
                onChanged={(updated) => {
                  setCaption(updated.caption || "");
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
            <ActionButton icon={Heart} count={likeCount} onClick={toggleLike} active={liked} />
            <ActionButton icon={MessageCircle} count={null} onClick={openChat} />
            <ActionButton
              icon={Bookmark}
              count={saveCount}
              onClick={toggleSave}
              active={saved}
              activeClass="fill-brand-yellow text-brand-yellow"
            />
            <ActionButton icon={Share2} count={(post.share_count || 0) + 1} onClick={share} />
          </div>

          {/* Bottom info — caption + tags only, raised above bottom nav */}
          <div className="absolute bottom-20 left-3 right-20 z-20">
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
          post={post}
          chromeVisible={chromeVisible}
          onToggleChrome={onToggleChrome ? handleToggleChrome : undefined}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}