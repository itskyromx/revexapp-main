import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ArrowLeft, UserPlus, UserCheck, Package, ShoppingBag, Settings as SettingsIcon, FileText, ShieldAlert, Truck, Ban, Lock, Bookmark } from "lucide-react";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";
import { displayName } from "@/lib/revex";
import Avatar from "@/components/Avatar";
import ItemCard from "@/components/ItemCard";
import SiteHeader from "@/components/SiteHeader";
import BottomNav from "@/components/BottomNav";
import CreatorStats from "@/components/CreatorStats";
import DraftsTab from "@/components/DraftsTab";
import SavedTab from "@/components/SavedTab";
import PostOwnerActions from "@/components/PostOwnerActions";
import BoostBadge from "@/components/BoostBadge";
import { useSaved } from "@/hooks/useSaved";
import { toggleBookmark } from "@/lib/bookmarks";
import FollowListSheet from "@/components/FollowListSheet";
import ProfileWarningBanner from "@/components/ProfileWarningBanner";
import SellerRatingSummary from "@/components/SellerRatingSummary";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useCurrentUser();
  const targetId = userId || me?.id;
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [items, setItems] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [followerFollows, setFollowerFollows] = useState([]);
  const [followingFollows, setFollowingFollows] = useState([]);
  const [listSheet, setListSheet] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tab, setTab] = useState("shop");
  const [loading, setLoading] = useState(true);
  const [followError, setFollowError] = useState("");
  const [blocked, setBlocked] = useState(null);
  const [blockedByThem, setBlockedByThem] = useState(null);
  const { isSaved } = useSaved(me?.id);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.from('profiles').select('*').eq('id', targetId).single();
        setProfile(u);
        const [psRes, itsRes, flsRes, fingRes, blksRes, blockedIds] = await Promise.all([
          supabase.from('posts').select('*').eq('created_by_id', targetId),
          supabase.from('items').select('*').eq('created_by_id', targetId),
          supabase.from('follows').select('*').eq('followee_id', targetId),
          supabase.from('follows').select('*').eq('follower_id', targetId),
          supabase.from('blocks').select('*').order('created_at', { ascending: false }).limit(200),
          getBlockedIds(me?.id)
        ]);
        const ps = psRes.data || [];
        const its = itsRes.data || [];
        const fls = flsRes.data || [];
        const fing = fingRes.data || [];
        const blks = blksRes.data || [];
        setPosts(hideBlocked(ps, blockedIds));
        setItems(hideBlocked(its, blockedIds));
        setBlocked(blks.find((b) => b.blocker_id === me?.id && b.blocked_id === targetId) || null);
        setBlockedByThem(blks.find((b) => b.blocker_id === targetId && b.blocked_id === me?.id) || null);
        setFollowers(fls.length);
        setFollowing(fing.length);
        setFollowerFollows(fls);
        setFollowingFollows(fing);
        if (me) setIsFollowing(fls.some((f) => f.follower_id === me.id));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [targetId, me?.id]);

  const reloadPosts = async () => {
    const { data: ps } = await supabase.from('posts').select('*').eq('created_by_id', targetId);
    setPosts(hideBlocked(ps || [], await getBlockedIds(me?.id)));
  };

  // Back from Stripe payout onboarding — refresh the connected account status.
  useEffect(() => {
    const payouts = new URLSearchParams(window.location.search).get("payouts");
    if (!payouts || !me?.id) return;
    supabase.functions
      .invoke("stripeConnect", { body: { action: "refresh", origin: window.location.origin } })
      .finally(() => {
        if (payouts === "done") window.location.replace("/profile");
      });
  }, [me?.id]);

  const toggleFollow = async () => {
    if (!me || !targetId) return;
    const next = !isFollowing;
    setFollowError("");
    setIsFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const res = await supabase.functions.invoke("followUser", { body: {
        targetId,
        action: next ? "follow" : "unfollow",
      }});
      if (res.data?.blocked) {
        setIsFollowing(false);
        setFollowers((n) => Math.max(0, n - 1));
        setFollowError("You can't follow this person.");
      }
    } catch (e) {
      console.error(e);
      setIsFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
      setFollowError("Couldn't update. Try again.");
    }
  };

  const unblock = async () => {
    if (!blocked) return;
    try {
      await supabase.from('blocks').delete().eq('id', blocked.id);
      setBlocked(null);
    } catch (e) {
      console.error(e);
    }
  };

  const openList = (kind) => {
    const src = kind === "fans" ? followerFollows : followingFollows;
    const ids = src
      .map((f) => (kind === "fans" ? f.follower_id : f.followee_id))
      .filter(Boolean);
    const names = Object.fromEntries(
      src
        .filter((f) => kind === "fans" && f.follower_name)
        .map((f) => [f.follower_id, f.follower_name])
    );
    setListSheet({
      title: kind === "fans" ? "Fans" : "Following",
      ids,
      names,
      emptyText: kind === "fans" ? "No fans yet" : "Not following anyone yet",
    });
  };

  const isSelf = me && targetId === me.id;
  const name = displayName(profile) || "Creator";
  const locked = Boolean(profile?.private_account) && !isSelf && !isFollowing;

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background pb-16">
      <SiteHeader
        actions={(
          <div className="flex items-center gap-2">
            {userId && (
              <button onClick={() => navigate(-1)} aria-label="Go back" className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
            )}
            {isSelf && (
              <>
                <button onClick={() => navigate("/orders")} aria-label="Orders"
                  className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </button>
                {me?.role === "admin" && (
                  <button onClick={() => navigate("/reports")} aria-label="Reports"
                    className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => navigate("/settings")} aria-label="Settings"
                  className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}
      />

      <div className="max-w-md mx-auto p-4">
        {isSelf && <ProfileWarningBanner userId={me?.id} />}
        {/* Header card */}
        <div className="acid-card p-4">
          <div className="flex items-center gap-3">
            <Avatar name={name} src={profile?.avatar} size={72} ring />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl uppercase truncate">{name}</h1>
              <div className="flex gap-4 mt-1">
                <div><span className="font-display text-lg">{posts.length}</span><span className="text-xs ml-1 uppercase">posts</span></div>
                <button type="button" onClick={() => openList("fans")} className="active:opacity-60">
                  <span className="font-display text-lg">{followers}</span><span className="text-xs ml-1 uppercase">fans</span>
                </button>
                <button type="button" onClick={() => openList("following")} className="active:opacity-60">
                  <span className="font-display text-lg">{following}</span><span className="text-xs ml-1 uppercase">following</span>
                </button>
              </div>
            </div>
          </div>
          {profile?.bio && (
            <p className="text-sm text-muted-foreground mt-3 leading-snug whitespace-pre-wrap">{profile.bio}</p>
          )}
          {!isSelf && me ?
            blocked ?
              <>
                <button onClick={unblock} className="acid-btn w-full mt-4 bg-muted text-foreground">
                  <Ban className="w-4 h-4" /> Unblock
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  You blocked this person — they can't message you and you won't see each other's posts.
                </p>
              </> :
            blockedByThem ?
              <>
                <button disabled className="acid-btn w-full mt-4 bg-muted text-foreground opacity-60">
                  <Ban className="w-4 h-4" /> Blocked
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  You can't follow or message this person right now.
                </p>
              </> :
              <>
                <button onClick={toggleFollow} className={`acid-btn w-full mt-4 ${isFollowing ? "bg-muted text-foreground" : "bg-brand-red text-white"}`}>
                  {isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                </button>
                {followError && <p className="text-xs text-brand-red mt-2">{followError}</p>}
              </> :
          isSelf ?
            <button onClick={() => navigate("/upload")} className="acid-btn w-full mt-4 bg-foreground text-background"><ShoppingBag className="w-4 h-4" /> Make a Post</button> :
          null}
        </div>

        <SellerRatingSummary userId={targetId} />

        {locked ? (
          <div className="acid-card p-6 mt-4 text-center">
            <Lock className="w-6 h-6 mx-auto mb-2" />
            <p className="font-display text-lg uppercase">This account is private</p>
            <p className="text-sm text-muted-foreground mt-1">
              Follow {name} to see their posts and shop.
            </p>
          </div>
        ) : (
        <>
        {/* Tabs */}
        <div className="flex border-[3px] border-border bg-card mt-4">
          <button onClick={() => setTab("shop")} className={`flex-1 py-2 font-heading font-bold uppercase text-xs flex items-center justify-center gap-1 ${tab === "shop" ? "bg-brand-red text-white" : "text-foreground"}`}><ShoppingBag className="w-4 h-4" /> Shop</button>
          <button onClick={() => setTab("hauls")} className={`flex-1 py-2 font-heading font-bold uppercase text-xs flex items-center justify-center gap-1 border-l-2 border-border ${tab === "hauls" ? "bg-brand-red text-white" : "text-foreground"}`}><Package className="w-4 h-4" /> Posts</button>
          {isSelf && (
            <button onClick={() => setTab("saved")} className={`flex-1 py-2 font-heading font-bold uppercase text-xs flex items-center justify-center gap-1 border-l-2 border-border ${tab === "saved" ? "bg-brand-red text-white" : "text-foreground"}`}><Bookmark className="w-4 h-4" /> Saved</button>
          )}
          {isSelf && (
            <button onClick={() => setTab("drafts")} className={`flex-1 py-2 font-heading font-bold uppercase text-xs flex items-center justify-center gap-1 border-l-2 border-border ${tab === "drafts" ? "bg-brand-red text-white" : "text-foreground"}`}><FileText className="w-4 h-4" /> Drafts</button>
          )}
        </div>

        {isSelf && posts.length > 0 && tab === "hauls" && <CreatorStats posts={posts} />}

        {tab === "drafts" ? (
          <DraftsTab />
        ) : tab === "saved" ? (
          <SavedTab />
        ) : tab === "shop" ?
          items.length === 0 ?
            <div className="acid-card p-6 mt-4 text-center text-sm text-muted-foreground">No items listed yet.</div> :
            <div className="grid grid-cols-2 gap-2 mt-4">
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  saved={isSaved("item", it.id)}
                  onToggleSave={() => toggleBookmark(me?.id, "item", it)}
                  onClick={() => navigate(`/item/${it.id}`)}
                />
              ))}
            </div> :
          posts.length === 0 ?
            <div className="acid-card p-6 mt-4 text-center text-sm text-muted-foreground">No posts yet.</div> :
            <div className="grid grid-cols-2 gap-2 mt-4">
              {posts.map((p) => (
                <div key={p.id} className="acid-card-sm overflow-hidden aspect-[3/4] relative">
                  <button onClick={() => navigate(`/haul/${p.id}`)} className="absolute inset-0 w-full h-full">
                    {p.image_urls?.[0] || p.video_url ?
                      p.video_url ?
                        <video src={p.video_url} className="w-full h-full object-cover" muted /> :
                        <img src={p.image_urls[0]} className="w-full h-full object-cover" alt="" /> :
                      <div className="w-full h-full grid-bg bg-muted" />}
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1.5">
                      <p className="text-white text-[11px] font-heading font-bold line-clamp-2 leading-tight">{p.haul_title}</p>
                    </div>
                  </button>
                  <BoostBadge post={p} className="absolute top-1.5 left-1.5 z-10" />
                  {isSelf && (
                    <PostOwnerActions post={p} variant="tile" onChanged={reloadPosts} onDeleted={reloadPosts} />
                  )}
                </div>
              ))}
            </div>
        }
        </>
        )}
      </div>
      {listSheet && <FollowListSheet {...listSheet} onClose={() => setListSheet(null)} />}
      <BottomNav />
    </div>
  );
}