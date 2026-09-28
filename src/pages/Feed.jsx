import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import BottomNav from "@/components/BottomNav";
import HaulCard from "@/components/HaulCard";
import { Loader2 } from "lucide-react";

// Kept for the life of the app session: coming back to the feed reuses the posts
// already loaded instead of refetching and reordering them.
let feedCache = null;
const INDEX_KEY = "revex_feed_index";

export default function Feed() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState(feedCache?.posts || []);
  const [loading, setLoading] = useState(!feedCache);
  const [cursor, setCursor] = useState(feedCache?.cursor || null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const scrollRef = useRef(null);
  const restoredRef = useRef(false);

  // Route-based split: desktop browsers land on the static web homepage.
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsDesktop(true);
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("getFeed", { body: { mode: "fyp" } });
      const next = res.data.posts || [];
      feedCache = { posts: next, cursor: res.data.nextCursor };
      setPosts(next);
      setCursor(res.data.nextCursor);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDesktop && !feedCache) fetchFeed();
  }, [fetchFeed, isDesktop]);

  // Land back on the post the viewer was watching — before first paint.
  useLayoutEffect(() => {
    if (loading || restoredRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = Number(sessionStorage.getItem(INDEX_KEY) || 0);
    if (idx > 0) el.scrollTop = idx * el.clientHeight;
    restoredRef.current = true;
  }, [loading, posts]);

  const rememberIndex = () => {
    const el = scrollRef.current;
    if (!el || !el.clientHeight) return;
    try {
      sessionStorage.setItem(INDEX_KEY, String(Math.round(el.scrollTop / el.clientHeight)));
    } catch {}
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await supabase.functions.invoke("getFeed", { body: { mode: "fyp", cursor } });
      const more = res.data.posts || [];
      setPosts((p) => {
        const merged = [...p, ...more];
        feedCache = { posts: merged, cursor: res.data.nextCursor };
        return merged;
      });
      setCursor(res.data.nextCursor);
    } catch {} finally { setLoadingMore(false); }
  };

  return (
    <div className="h-[100dvh] w-full bg-black overflow-hidden relative">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-9 h-9 animate-spin text-white" strokeWidth={3} />
        </div>
      ) : posts.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center px-8 text-center">
          <p className="font-display text-2xl uppercase text-white mb-1">No hauls yet</p>
          <p className="text-sm text-white/70">Be the first to drop a haul — hit Create.</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={rememberIndex}
          className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {posts.map((p) => (
            <div key={p.id} className="h-[100dvh] w-full snap-start">
              <HaulCard
                post={p}
                chromeVisible={chrome}
                onToggleChrome={() => setChrome((v) => !v)}
                onOpenProfile={(uid) => navigate(`/profile/${uid}`)}
              />
            </div>
          ))}
          {cursor && (
            <div className="h-20 flex items-center justify-center">
              <button onClick={loadMore} className="px-4 py-2 border-2 border-white text-white text-xs font-heading uppercase">
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {chrome && <BottomNav overlay />}
    </div>
  );
}