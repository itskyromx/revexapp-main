import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Loader2, Play, Flame, Sparkles } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/revex";
import { formatPrice } from "@/lib/revex";
import { getBlockedIds, hideBlocked } from "@/lib/blocks";
import SiteHeader from "@/components/SiteHeader";

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export default function Home() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, postsRes, blockedIds] = await Promise.all([
          supabase.from('items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(12),
          supabase.from('posts').select('*').order('like_count', { ascending: false }).limit(8),
          getBlockedIds(),
        ]);
        setItems(hideBlocked(itemsRes.data || [], blockedIds));
        setPosts(hideBlocked(postsRes.data || [], blockedIds));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const featured = items[0];
  const freshDrops = items.slice(1, 9);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        {loading ? (
          <div className="h-60 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <>
            {/* Featured / boosted */}
            {featured && (
              <section>
                <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="Boosted" />
                <button
                  onClick={() => navigate(`/item/${featured.id}`)}
                  className="w-full grid md:grid-cols-2 border-[3px] border-border bg-card overflow-hidden text-left">
                  <div className="aspect-[4/3] md:aspect-auto bg-muted border-b-[3px] md:border-b-0 md:border-r-[3px] border-border">
                    {featured.image_url ? (
                      <img src={featured.image_url} alt={featured.title} className="w-full h-full object-cover" />
                    ) : <div className="w-full h-full grid-bg" />}
                  </div>
                  <div className="p-6 flex flex-col justify-center gap-2">
                    <span className="inline-flex self-start text-[10px] font-heading uppercase bg-brand-red text-white px-2 py-0.5 border-2 border-border">Boosted</span>
                    <p className="font-heading font-bold uppercase text-xs text-muted-foreground">{featured.brand || "Brand"}</p>
                    <h2 className="font-display text-3xl uppercase leading-tight">{featured.title}</h2>
                    <p className="font-display text-2xl">{formatPrice(featured.price)}</p>
                  </div>
                </button>
              </section>
            )}

            {/* Categories */}
            <section>
              <SectionTitle title="Shop by category" />
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => navigate("/watch")}
                    className="aspect-square border-[3px] border-border bg-card flex flex-col items-center justify-center gap-2 hover:bg-brand-red hover:text-white transition-colors">
                    <span className="font-display uppercase text-sm text-center px-1">{CATEGORY_LABELS[c]}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Trending hauls */}
            {posts.length > 0 && (
              <section>
                <SectionTitle icon={<Flame className="w-4 h-4" />} title="Trending hauls" actionLabel="Open Watch" onAction={() => navigate("/watch")} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {posts.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate("/watch")}
                      className="aspect-[3/4] border-[3px] border-border bg-black relative overflow-hidden group">
                      {p.image_urls?.[0] ? (
                        <img src={p.image_urls[0]} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" alt="" />
                      ) : <div className="w-full h-full grid-bg" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="font-display text-white text-sm uppercase line-clamp-2">{p.haul_title}</p>
                        <span className="inline-flex items-center gap-1 text-white/80 text-[10px] mt-1">
                          <Play className="w-3 h-3" /> {p.like_count || 0} likes
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Fresh drops */}
            {freshDrops.length > 0 && (
              <section>
                <SectionTitle title="Fresh drops" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {freshDrops.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => navigate(`/item/${it.id}`)}
                      className="border-[3px] border-border bg-card overflow-hidden text-left">
                      <div className="aspect-square bg-muted border-b-[3px] border-border">
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full grid-bg" />}
                      </div>
                      <div className="p-2">
                        <p className="font-heading font-bold text-xs uppercase truncate">{it.brand || "Brand"}</p>
                        <p className="text-sm truncate">{it.title}</p>
                        <p className="font-display text-lg mt-0.5">{formatPrice(it.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t-[4px] border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs font-heading uppercase text-muted-foreground">
          <span className="font-display text-foreground">Revex</span>
          <span>© 2026 Revex — secondhand, social.</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ icon, title, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-xl uppercase flex items-center gap-2">
        {icon}{title}
      </h3>
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-xs font-heading uppercase text-brand-red">{actionLabel} →</button>
      )}
    </div>
  );
}