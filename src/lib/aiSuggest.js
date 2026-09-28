import { supabase, callFunction } from "@/api/supabaseClient";
import { captureFrames, dataUrlToFile } from "@/lib/videoFrames";

// Analyze a haul clip and return an array of detected garments with suggested
// metadata + a brand/condition-based resale price estimate.
export async function detectHaulItems(videoUrl) {
  const frames = await captureFrames(videoUrl, 6);
  if (!frames.length) {
    throw new Error("Could not capture frames from the video.");
  }

  const fileUrls = [];
  for (let i = 0; i < frames.length; i++) {
    const file = await dataUrlToFile(frames[i], `frame-${i}.jpg`);
    const path = `haul-frames/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (error) throw error;
    const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
    fileUrls.push(pub.publicUrl);
  }

  const res = await callFunction("detectHaulItems", { frame_urls: fileUrls });
  return Array.isArray(res?.items) ? res.items : [];
}
