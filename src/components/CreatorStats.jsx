import { TrendingUp, Eye, Heart, Bookmark } from "lucide-react";

function StatCard({ icon: Icon, value, label, accent }) {
  return (
    <div className={`acid-card-sm p-3 flex flex-col items-center justify-center text-center ${accent ? "bg-brand-red text-white border-white" : "bg-card"}`}>
      <Icon className={`w-4 h-4 mb-1 ${accent ? "text-white" : "text-foreground"}`} strokeWidth={2.5} />
      <span className="font-display text-2xl leading-none">{value.toLocaleString()}</span>
      <span className={`text-[9px] font-heading uppercase tracking-wide mt-1 ${accent ? "text-white/80" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

export default function CreatorStats({ posts }) {
  const totals = posts.reduce(
    (acc, p) => {
      acc.views += p.view_count || 0;
      acc.likes += p.like_count || 0;
      acc.saves += p.bookmark_count || 0;
      return acc;
    },
    { views: 0, likes: 0, saves: 0 }
  );

  const trending = [...posts]
    .map((p) => ({
      post: p,
      score: (p.view_count || 0) + (p.like_count || 0) + (p.bookmark_count || 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (posts.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4" />
        <h2 className="font-display text-base uppercase">Your Stats</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Eye} value={totals.views} label="Views" />
        <StatCard icon={Heart} value={totals.likes} label="Likes" />
        <StatCard icon={Bookmark} value={totals.saves} label="Bookmarks" />
      </div>

      {trending.length > 0 && (
        <div className="mt-3">
          <h3 className="font-heading font-bold uppercase text-xs text-muted-foreground mb-2">Trending posts</h3>
          <div className="space-y-2">
            {trending.map(({ post, score }, i) => (
              <div key={post.id} className={`acid-card-sm p-2 flex items-center gap-3 ${i === 0 ? "bg-brand-red text-white border-white" : "bg-card"}`}>
                <div className="w-12 h-12 shrink-0 border-2 border-border overflow-hidden bg-muted">
                  {post.image_urls?.[0] ? (
                    <img src={post.image_urls[0]} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full grid-bg" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-heading font-bold text-xs truncate ${i === 0 ? "text-white" : "text-foreground"}`}>{post.haul_title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`flex items-center gap-0.5 text-[10px] ${i === 0 ? "text-white/80" : "text-muted-foreground"}`}>
                      <Eye className="w-3 h-3" /> {post.view_count || 0}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[10px] ${i === 0 ? "text-white/80" : "text-muted-foreground"}`}>
                      <Heart className="w-3 h-3" /> {post.like_count || 0}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[10px] ${i === 0 ? "text-white/80" : "text-muted-foreground"}`}>
                      <Bookmark className="w-3 h-3" /> {post.bookmark_count || 0}
                    </span>
                  </div>
                </div>
                <span className={`font-display text-lg shrink-0 ${i === 0 ? "text-white" : "text-foreground"}`}>#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}