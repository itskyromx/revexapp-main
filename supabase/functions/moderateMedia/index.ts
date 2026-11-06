import { createClient } from 'jsr:@supabase/supabase-js@2';
import { imageSize } from 'npm:image-size@2.0.2';
import { corsHeaders } from '../_shared/cors.ts';
import { createModeratedUploadHandler } from './handler.ts';

Deno.serve(createModeratedUploadHandler({ createClient, imageSize, corsHeaders, env: (key: string) => Deno.env.get(key) }));
