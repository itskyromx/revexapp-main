export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$/;

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidUsername(value) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export async function isUsernameAvailable(supabase, value, excludeUserId = null) {
  const username = normalizeUsername(value);
  if (!isValidUsername(username)) return false;
  const pattern = username.replace(/[\\%_]/g, "\\$&");
  let query = supabase.from("profiles").select("id").ilike("display_name", pattern).limit(1);
  if (excludeUserId) query = query.neq("id", excludeUserId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length === 0;
}
