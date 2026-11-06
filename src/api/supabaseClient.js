import { createClient } from '@supabase/supabase-js';
import { prepareImageUpload, PHOTO_POLICY_VERSION } from '@/lib/imageUpload';

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
  const preparedFile = await prepareImageUpload(file);
  const body = new FormData();
  body.append('file', preparedFile);
  body.append('folder', folder);
  body.append('policyVersion', PHOTO_POLICY_VERSION);
  const { data, error } = await supabase.functions.invoke('moderateMedia', { body });
  if (error) {
    let message = 'The photo could not be checked. Please try again.';
    if (error.context instanceof Response) {
      const details = await error.context.clone().json().catch(() => null);
      if (typeof details?.error === 'string') message = details.error;
    }
    throw new Error(message);
  }
  if (!data?.file_url) throw new Error('The photo could not be approved. Please try again.');
  return { file_url: data.file_url };
}
