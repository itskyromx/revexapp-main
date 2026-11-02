import { supabase } from "@/api/supabaseClient";

export async function loadProfilesById(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, avatar")
    .in("id", uniqueIds);
  if (error) {
    console.error("Could not load profiles:", error);
    return {};
  }
  return Object.fromEntries((data || []).map((profile) => [profile.id, profile]));
}

export function profileLabel(profile, fallback = "Unknown") {
  return profile?.display_name || profile?.full_name || fallback;
}

export async function enrichItemCreators(items) {
  try {
    const profiles = await loadProfilesById(items.map((item) => item.created_by_id));
    return items.map((item) => {
      const profile = profiles[item.created_by_id];
      const fallbackName = item.seller_name && !item.seller_name.includes("@")
        ? item.seller_name
        : "Unknown";
      return {
        ...item,
        seller_name: profileLabel(profile, fallbackName),
        seller_avatar: profile?.avatar || item.seller_avatar || "",
      };
    });
  } catch (error) {
    console.error("Could not load item creator profiles:", error);
    return items;
  }
}