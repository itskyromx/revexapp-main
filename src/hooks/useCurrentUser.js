import { useEffect, useState } from "react";
import { getCurrentUserProfile } from "@/api/supabaseClient";
import { supabase } from "@/api/supabaseClient";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = (authUser = null) => getCurrentUserProfile(authUser)
      .then((u) => { if (alive) setUser(u); })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) setLoading(false); });

    // The session event already contains the user, so don't make a second
    // /auth/v1/user request just to load the profile.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (!session?.user) {
        if (alive) { setUser(null); setLoading(false); }
        return;
      }
      load(session.user);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return { user, loading, setUser };
}