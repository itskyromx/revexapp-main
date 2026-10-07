import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { ArrowLeft, Loader2 } from "lucide-react";
import HaulCard from "@/components/HaulCard";
import { toast } from "@/components/ui/use-toast";
import { getBlockedIds } from "@/lib/blocks";
import { recordPostView } from "@/lib/postStats";

export default function HaulDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPost = async () => {
    const { data: p } = await supabase.from('posts').select('*').eq('id', postId).single();
    const blockedIds = await getBlockedIds();
    if (!p || blockedIds.includes(p.created_by_id)) {
      setPost(null);
      return null;
    }
    const viewed = await recordPostView(postId);
    setPost({ ...p, ...(viewed || {}) });
    return p;
  };

  useEffect(() => {
    (async () => {
      try {
        await loadPost();
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [postId]);

  useEffect(() => {
    const reload = () => loadPost().catch((error) => console.error(error));
    window.addEventListener('revex:block-changed', reload);
    return () => window.removeEventListener('revex:block-changed', reload);
  }, [postId]);

  // Back from Stripe: confirm the boost payment, then re-read the stamped post.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("boost");
    const sessionId = params.get("session_id");
    if (!outcome) return;

    if (outcome === "success" && sessionId) {
      supabase.functions
        .invoke("boostPost", { body: { action: "confirm", postId, sessionId } })
        .then(async (res) => {
          if (res.data?.boost_expires_at) {
            await loadPost();
            toast({
              title: "Boost is live",
              description: "Your post now sits at the top of the For You feed.",
            });
          } else if (res.data?.error) {
            toast({ title: "Boost not confirmed", description: res.data.error });
          }
        })
        .catch((e) => console.error(e))
        .finally(() => window.history.replaceState({}, "", `/haul/${postId}`));
    } else {
      window.history.replaceState({}, "", `/haul/${postId}`);
    }
  }, [postId]);

  if (loading) return (
    <div className="h-[100dvh] bg-black grid place-items-center">
      <Loader2 className="w-8 h-8 animate-spin text-white" strokeWidth={3} />
    </div>
  );

  if (!post) return (
    <div className="h-[100dvh] bg-black flex flex-col items-center justify-center text-center px-8">
      <p className="font-display text-2xl uppercase text-white mb-1">Haul not found</p>
      <button onClick={() => navigate(-1)} className="mt-4 acid-btn bg-card text-white border-white">Go back</button>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full bg-black overflow-hidden relative">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      <HaulCard
        post={post}
        onOpenProfile={(uid) => navigate(`/profile/${uid}`)}
        onChanged={(updated) => setPost((p) => ({ ...p, ...updated }))}
        onDeleted={() => navigate("/profile")}
      />
    </div>
  );
}