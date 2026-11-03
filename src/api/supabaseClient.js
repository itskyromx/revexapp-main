import { createClient } from '@supabase/supabase-js';
import { createUniqueId } from '@/lib/uniqueId';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUserProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  // A failed profile request is not evidence of an incomplete registration.
  if (error) throw error;
  if (!profile) throw new Error('Unable to load your profile. Please try again.');
  return { ...user, ...profile };
}

export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

export async function uploadPublicFile(file, folder = "uploads") {
  const path = `${folder}/${createUniqueId()}-${file.name}`;
  const { error } = await supabase.storage.from('media').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { file_url: data.publicUrl };
}
