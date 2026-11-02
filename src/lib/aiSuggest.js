import { supabase, callFunction } from "@/api/supabaseClient";
import { captureFrames, dataUrlToFile } from "@/lib/videoFrames";
import { createUniqueId } from "@/lib/uniqueId";
import { hasCookieConsent } from "@/lib/cookieConsent";

function requireAnalysisConsent() {
  if (!hasCookieConsent("personalization")) {
    throw new Error("Enable personalization in cookie settings before analyzing item photos or videos.");
  }
}

// Analyze an item clip and return an array of detected garments with suggested
// metadata + a brand/condition-based resale price estimate.
export async function detectItems(videoUrl) {
  requireAnalysisConsent();
  const frames = await captureFrames(videoUrl, 6);
  if (!frames.length) {
    throw new Error("Could not capture frames from the video.");
  }

  const fileUrls = [];
  for (let i = 0; i < frames.length; i++) {
    requireAnalysisConsent();
    const file = await dataUrlToFile(frames[i], `frame-${i}.jpg`);
    const path = `item-frames/${createUniqueId()}-${file.name}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (error) throw error;
    const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
    fileUrls.push(pub.publicUrl);
  }

  requireAnalysisConsent();
  const res = await callFunction("detectItems", { frame_urls: fileUrls });
  return Array.isArray(res?.items) ? res.items : [];
}
