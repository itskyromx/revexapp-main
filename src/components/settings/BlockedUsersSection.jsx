import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Loader2 } from "lucide-react";
import Avatar from "@/components/Avatar";

export default function BlockedUsersSection() {
  const { user } = useCurrentUser();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.from('blocks').select('*').eq('blocker_id', user.id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { if (alive) setBlocks(data || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const unblock = async (block) => {
    setBusyId(block.id);
    try {
      await supabase.from('blocks').delete().eq('id', block.id);
      setBlocks((list) => list.filter((b) => b.id !== block.id));
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <div className="h-32 grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="acid-card p-6 text-center">
        <p className="font-display text-lg uppercase">No blocked users</p>
        <p className="text-sm text-muted-foreground mt-1">
          Anyone you block from a chat or profile shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <div key={b.id} className="acid-card-sm p-3 flex items-center gap-3">
          <Avatar name={b.blocked_name} size={40} />
          <span className="min-w-0 flex-1 font-heading font-bold text-sm truncate">
            {b.blocked_name || "User"}
          </span>
          <button
            onClick={() => unblock(b)}
            disabled={busyId === b.id}
            className="acid-chip bg-card text-foreground disabled:opacity-50">
            {busyId === b.id ? "Unblocking…" : "Unblock"}
          </button>
        </div>
      ))}
    </div>
  );
}