import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ArrowLeft, UserPlus, UserCheck, Package, ShoppingBag, Settings as SettingsIcon, FileText, ShieldAlert, Truck, Ban, Lock, Bookmark, MoreHorizontal, Flag } from "lucide-react";
import { getBlockedIds, hideBlocked, clearBlockRelationship, getBlockDirection, setBlockRelationship } from "@/lib/blocks";
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
import ReportUserSheet from "@/components/ReportUserSheet";
import { toast } from "@/components/ui/use-toast";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me, loading: userLoading } = useCurrentUser();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false);
  const { isSaved } = useSaved(me?.id);
  const isSelf = me && targetId === me.id;
  const isBlockedRelationship = Boolean(blocked || blockedByThem);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.from('profiles').select('*').eq('id', targetId).single();
        setProfile(u);
        const [psRes, itsRes, flsRes, fingRes, blockDirection, blockedIds] = await Promise.all([
          supabase.from('posts').select('*').eq('created_by_id', targetId),
          supabase.from('items').select('*').eq('created_by_id', targetId),
          supabase.from('follows').select('*').eq('followee_id', targetId),
          supabase.from('follows').select('*').eq('follower_id', targetId),
          me && me.id !== targetId ? getBlockDirection(me.id, targetId) : Promise.resolve(null),
          getBlockedIds(me?.id)
        ]);
        const ps = psRes.data || [];
        const its = itsRes.data || [];
        const fls = flsRes.data || [];
        const fing = fingRes.data || [];
        const blockState = blockDirection;
        setPosts(hideBlocked(ps, blockedIds));
        setItems(hideBlocked(its, blockedIds));
        setBlocked(blockState === "you");
        setBlockedByThem(blockState === "them");
        setFollowers(fls.length);
        setFollowing(fing.length);
        setFollowerFollows(fls);
        setFollowingFollows(fing);
        if (me) setIsFollowing(fls.some((f) => f.follower_id === me.id));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [targetId, me?.id]);

  useEffect(() => {
    const reload = () => {
      if (!targetId) return;
      const load = async () => {
        const direction = me?.id ? await getBlockDirection(me.id, targetId) : null;
        setBlocked(direction === "you");
        setBlockedByThem(direction === "them");
      };
      load().catch((error) => console.error(error));
    };
    window.addEventListener('revex:block-changed', reload);
    return () => window.removeEventListener('revex:block-changed', reload);
  }, [targetId, me?.id]);

  useEffect(() => {
    if (!me?.id || !targetId || isSelf) return undefined;
    const refresh = async () => {
      const direction = await getBlockDirection(me.id, targetId);
      setBlocked(direction === "you");
      setBlockedByThem(direction === "them");
      if (direction) setIsFollowing(false);
    };
    const channel = supabase.channel("profile-blocks:" + [me.id, targetId].sort().join(":"))
      .on("postgres_changes", { event: "*", schema: "public", table: "blocks", filter: "blocker_id=eq." + me.id }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "blocks", filter: "blocker_id=eq." + targetId }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [me?.id, targetId, isSelf]);

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
    if (!me || !targetId || isBlockedRelationship) return;
    const freshDirection = await getBlockDirection(me.id, targetId);
    if (freshDirection) { setBlocked(freshDirection === "you"); setBlockedByThem(freshDirection === "them"); return; }
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
    if (!blocked || !me) return;
    try {
      await clearBlockRelationship(me.id, targetId);
      setBlocked(null);
      setBlockedByThem(null);
    } catch (e) {
      console.error(e);
    }
  };


  const openProfileChat = async () => {
    if (!me || !targetId || isBlockedRelationship) return;
    const direction = await getBlockDirection(me.id, targetId);
    if (direction) { setBlocked(direction === "you"); setBlockedByThem(direction === "them"); return; }
    navigate("/chat/" + targetId);
  };

  const blockProfileUser = async () => {
    if (!me || !targetId || busyBlock) return;
    setBusyBlock(true);
    try {
      const direction = await setBlockRelationship(me.id, targetId);
      setBlocked(direction === "you"); setBlockedByThem(direction === "them");
      if (direction === "you") {
        if (isFollowing || followerFollows.some((row) => row.follower_id === me.id)) setFollowers((n) => Math.max(0, n - 1));
        if (followingFollows.some((row) => row.followee_id === me.id)) setFollowing((n) => Math.max(0, n - 1));
        setIsFollowing(false);
        setFollowerFollows((rows) => rows.filter((row) => row.follower_id !== me.id));
        setFollowingFollows((rows) => rows.filter((row) => row.followee_id !== me.id));
        toast({ title: "User blocked", description: "You both no longer follow each other." });
      }
    } catch (error) { console.error(error); toast({ title: "Couldn't block user", description: "Try again." }); }
    finally { setBusyBlock(false); setMenuOpen(false); }
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

  const name = displayName(profile) || "Creator";
  const locked = Boolean(profile?.private_account) && !isSelf && !isFollowing;

  if (userLoading) return <div className="min-h-screen bg-background grid place-items-center"><div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" /></div>;

  if (!me && !userId) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <SiteHeader />
        <div className="max-w-md mx-auto p-4 mt-6 text-center">
          <p className="font-display text-lg uppercase">Sign in to view your profile</p>
          <button onClick={() => navigate("/login")} className="acid-btn bg-brand-red text-white px-4 py-2 mt-3 text-xs">
            Sign in
          </button>
        </div>
        {showReport && me && <ReportUserSheet targetId={targetId} name={name} me={me} onClose={() => setShowReport(false)} />}
      <BottomNav />
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-background grid place-items-center"><div className="w-8 h-8 border-4 border-border border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background pb-16">
      <SiteHeader
        actions={(
          <div className="flex items-center gap-2">
            {userId && (
              <>
                <button onClick={() => navigate(-1)} aria-label="Go back" className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
                {!isSelf && me && <div className="relative">
                  <button onClick={() => setMenuOpen((open) => !open)} aria-label="Profile options" aria-expanded={menuOpen} className="sticker bg-card w-9 h-9 rounded-full flex items-center justify-center"><MoreHorizontal className="w-5 h-5" /></button>
                  {menuOpen && <div className="absolute right-0 top-11 z-50 w-56 acid-card bg-card p-1.5">
                    <button disabled={busyBlock || blockedByThem} onClick={blocked ? unblock : blockProfileUser} className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted disabled:opacity-50"><Ban className="w-4 h-4" /><span className="font-heading font-bold uppercase text-xs">{blockedByThem ? "Blocked you" : blocked ? "Unblock user" : "Block user"}</span></button>
                    <button onClick={() => { setMenuOpen(false); setShowReport(true); }} className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted"><Flag className="w-4 h-4" /><span className="font-heading font-bold uppercase text-xs">Report user</span></button>
                  </div>}
                </div>}
              </>
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
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button disabled className="acid-btn bg-muted text-foreground opacity-60">
                    <Ban className="w-4 h-4" /> Messaging off
                  </button>
                  <button onClick={unblock} className="acid-btn bg-muted text-foreground">
                    <Ban className="w-4 h-4" /> Unblock
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You blocked this person — they can't message you and you won't see each other's posts.
                </p>
              </> :
            blockedByThem ?
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button disabled className="acid-btn bg-muted text-foreground opacity-60">
                    <Ban className="w-4 h-4" /> Can't message
                  </button>
                  <button disabled className="acid-btn bg-muted text-foreground opacity-60">
                    <UserPlus className="w-4 h-4" /> Follow
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You can't follow or message this person right now.
                </p>
              </> :
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={openProfileChat} disabled={isBlockedRelationship} className="acid-btn bg-foreground text-background disabled:opacity-50">
                    <UserPlus className="w-4 h-4" /> Message
                  </button>
                  <button onClick={toggleFollow} disabled={isBlockedRelationship} className={`acid-btn ${isFollowing ? "bg-muted text-foreground" : "bg-brand-red text-white"}`}>
                    {isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                  </button>
                </div>
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
                    {p.image_urls?.[0] ?
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