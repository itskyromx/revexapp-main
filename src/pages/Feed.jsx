import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import BottomNav from "@/components/BottomNav";
import ItemFeedCard from "@/components/ItemFeedCard";
import { Loader2 } from "lucide-react";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";
import { enrichItemCreators } from "@/lib/profileData";
import { refreshItemCounters } from "@/lib/itemStats";
import { hasCookieConsent } from "@/lib/cookieConsent";
import { useI18n } from "@/lib/i18n";

// Kept for the life of the app session: coming back to the feed reuses the items
// already loaded instead of refetching and reordering them.
let feedCache = null;
const INDEX_KEY = "revex_feed_index";

async function personalizeItems(items) {
  if (!hasCookieConsent("personalization")) return items;
  try {
    const { data, error } = await supabase.functions.invoke("productSemantics", { body: { mode: "recommend" } });
    if (error || !data?.itemIds?.length) return items;
    const rank = new Map(data.itemIds.map((id, index) => [id, index]));
    return items.map((item, index) => ({ item, index, rank: rank.get(item.id) ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ item }) => item);
  } catch {
    return items;
  }
}

export default function Feed() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState(feedCache?.items || []);
  const [loading, setLoading] = useState(!feedCache);
  const [feedError, setFeedError] = useState("");
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
    setFeedError("");
    try {
      const [res, blockedIds] = await Promise.all([
        supabase.functions.invoke("getFeed", { body: { mode: "fyp" } }),
        getBlockedIds(),
      ]);
      if (res.error) throw res.error;
      const next = await personalizeItems(await enrichItemCreators(hideBlocked(res.data?.items || [], blockedIds)));
      feedCache = { items: next, cursor: res.data.nextCursor };
      setItems(next);
      setCursor(res.data.nextCursor);
    } catch (e) {
      console.error(e);
      setFeedError("We couldn't load the feed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDesktop && !feedCache) fetchFeed();
  }, [fetchFeed, isDesktop]);

  // Reconcile cached cards with the database after returning from a item detail.
  useEffect(() => {
    if (!feedCache?.items?.length) return undefined;
    let active = true;
    refreshItemCounters(feedCache.items.map((item) => item.id))
      .then((counters) => {
        if (!active) return;
        setItems((current) => {
          const refreshed = current.filter(item => counters[item.id] && !counters[item.id].is_archived)
            .map(item => ({ ...item, ...counters[item.id] }));
          feedCache = { ...feedCache, items: refreshed };
          return refreshed;
        });
      })
      .catch((error) => console.error("Could not refresh feed counters", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => {
      feedCache = null;
      fetchFeed();
    };
    window.addEventListener('revex:block-changed', refresh);
    return () => window.removeEventListener('revex:block-changed', refresh);
  }, [fetchFeed]);

  // Land back on the item the viewer was watching — before first paint.
  useLayoutEffect(() => {
    if (loading || restoredRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = hasCookieConsent("preferences") ? Number(sessionStorage.getItem(INDEX_KEY) || 0) : 0;
    if (idx > 0) el.scrollTop = idx * el.clientHeight;
    restoredRef.current = true;
  }, [loading, items]);

  const rememberIndex = () => {
    const el = scrollRef.current;
    if (!el || !el.clientHeight) return;
    if (hasCookieConsent("preferences")) {
      try {
        sessionStorage.setItem(INDEX_KEY, String(Math.round(el.scrollTop / el.clientHeight)));
      } catch {}
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const [res, blockedIds] = await Promise.all([
        supabase.functions.invoke("getFeed", { body: { mode: "fyp", cursor } }),
        getBlockedIds(),
      ]);
      const more = await personalizeItems(await enrichItemCreators(hideBlocked(res.data?.items || [], blockedIds)));
      setItems((p) => {
        const merged = [...p, ...more];
        feedCache = { items: merged, cursor: res.data.nextCursor };
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
      ) : feedError ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-sm text-white/80">{feedError}</p>
          <button
            onClick={fetchFeed}
            className="px-4 py-2 border-2 border-white text-white text-xs font-heading uppercase"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center px-8 text-center">
          <p className="font-display text-2xl uppercase text-white mb-1">{t("No items yet")}</p>
          <p className="text-sm text-white/70">{t("Be the first to upload!")}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={rememberIndex}
          className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {items.map((p) => (
            <div key={p.id} className="h-[100dvh] w-full snap-start">
              <ItemFeedCard
                item={p}
                onDeleted={() => {
                  setItems(current => {
                    const next = current.filter(item => item.id !== p.id);
                    feedCache = { ...(feedCache || {}), items: next };
                    return next;
                  });
                }}
                onChanged={(updated) => {
                  setItems((current) => {
                    const next = current.map((item) => item.id === updated.id ? { ...item, ...updated } : item).filter(item => !item.is_archived);
                    feedCache = { ...(feedCache || {}), items: next };
                    return next;
                  });
                }}
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
