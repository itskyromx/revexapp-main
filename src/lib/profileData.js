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

export function profileLabel(profile, fallback = "Creator") {
  return profile?.display_name || profile?.full_name || fallback;
}

export async function enrichPostCreators(posts) {
  try {
    const profiles = await loadProfilesById(posts.map((post) => post.created_by_id));
    return posts.map((post) => {
      const profile = profiles[post.created_by_id];
      const fallbackName = post.creator_name && !post.creator_name.includes("@")
        ? post.creator_name
        : "Creator";
      return {
        ...post,
        creator_name: profileLabel(profile, fallbackName),
        creator_avatar: profile?.avatar || post.creator_avatar || "",
      };
    });
  } catch (error) {
    console.error("Could not load post creator profiles:", error);
    return posts;
  }
}