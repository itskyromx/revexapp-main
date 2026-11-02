import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";

// Preserve previously shared /haul links, including a Stripe return in flight.
export default function LegacyItemRedirect() {
  const { legacyId } = useParams();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.rpc("resolve_item_id", { p_id: legacyId }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) { setError("Item not found"); return; }
      navigate(`/item/${data}${search}${hash}`, { replace: true });
    });
    return () => { active = false; };
  }, [legacyId, search, hash, navigate]);
  return <div className="min-h-screen grid place-items-center">{error || "Opening item…"}</div>;
}
