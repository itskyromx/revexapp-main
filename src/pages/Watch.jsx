import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Home, Compass, Users, Plus, User, Inbox, Loader2 } from "lucide-react";
import HaulCard from "@/components/HaulCard";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";
import { enrichPostCreators } from "@/lib/profileData";
import { refreshPostCounters } from "@/lib/postStats";

const NAV = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/home", icon: Compass, label: "Explore" },
  { to: "/home", icon: Users, label: "Following" },
  { to: "/upload", icon: Plus, label: "Upload" },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function Watch() {
  const navigate = useNavigate();
  const location = useLocation();
  /** @type {Array<any>} */
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setPosts([]);
    setCursor(null);
    try {
      const [res, blockedIds] = await Promise.all([
        supabase.functions.invoke("getFeed", { body: { mode: "fyp" } }),
        getBlockedIds(),
      ]);
      const postsFromFeed = hideBlocked(res.data?.posts || [], blockedIds);
      const counters = await refreshPostCounters(postsFromFeed.map((post) => post.id));
      const next = await enrichPostCreators(postsFromFeed.map((post) => ({
        ...post,
        ...counters[post.id],
      })));
      setPosts(next);
      setCursor(res.data.nextCursor);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const [res, blockedIds] = await Promise.all([
        supabase.functions.invoke("getFeed", { body: { mode: "fyp", cursor } }),
        getBlockedIds(),
      ]);
      const postsFromFeed = hideBlocked(res.data?.posts || [], blockedIds);
      const counters = await refreshPostCounters(postsFromFeed.map((post) => post.id));
      const more = await enrichPostCreators(postsFromFeed.map((post) => ({
        ...post,
        ...counters[post.id],
      })));
      setPosts((p) => [...p, ...more]);
      setCursor(res.data.nextCursor);
    } catch {}
  };

  return (
    <div className="h-screen w-full bg-black text-white flex overflow-hidden">
      {/* Left sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r-2 border-white/15 p-4 gap-1">
        <Link to="/home" className="font-display text-2xl uppercase mb-6">Revex</Link>
        {NAV.map(({ to, icon: Icon, label }, i) => {
          const active = to === "/home" && location.pathname === "/watch" && label === "Home";
          return (
            <Link
              key={i}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 border-2 ${active ? "border-brand-red text-brand-red" : "border-transparent text-white hover:bg-white/10"}`}>
              <Icon className="w-5 h-5" strokeWidth={active ? 3 : 2} />
              <span className="font-heading uppercase text-sm">{label}</span>
            </Link>
          );
        })}
        <Link to="/upload" className="mt-4 border-[3px] border-white bg-brand-red text-white font-display uppercase text-center py-2.5">
          Sell
        </Link>
      </aside>

      {/* Center feed */}
      <main className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="h-full w-full max-w-[460px] overflow-y-scroll snap-y snap-mandatory no-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="font-display text-2xl uppercase">No hauls yet</p>
              <p className="text-sm text-white/70 mt-1">Drop the first haul.</p>
            </div>
          ) : (
            <>
              {posts.map((p) => (
                <div key={p.id} className="h-full w-full snap-start">
                  <HaulCard post={p} onOpenProfile={(uid) => navigate(`/profile/${uid}`)} />
                </div>
              ))}
              {cursor && (
                <div className="h-20 flex items-center justify-center">
                  <button onClick={loadMore} className="px-4 py-2 border-2 border-white text-white text-xs font-heading uppercase">Load more</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}