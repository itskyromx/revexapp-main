export async function captureFrames(videoUrl, count = 3) {
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not load video for frames"));
  });

  const duration =
    isFinite(video.duration) && video.duration > 0 ? video.duration : 2;
  const times = [];
  for (let i = 0; i < count; i++) {
    times.push(Math.min(duration, (duration / (count + 1)) * (i + 1)));
  }

  const frames = [];
  for (const t of times) {
    const f = await seekAndGrab(video, t);
    if (f) frames.push(f);
  }
  return frames;
}

function seekAndGrab(video, time) {
  return new Promise((resolve) => {
    const onseeked = () => {
      video.removeEventListener("seeked", onseeked);
      const w = video.videoWidth || 360;
      const h = video.videoHeight || 640;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      try {
        ctx.drawImage(video, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {
        resolve(null);
      }
    };
    video.addEventListener("seeked", onseeked);
    try {
      video.currentTime = time;
    } catch {
      video.removeEventListener("seeked", onseeked);
      resolve(null);
    }
  });
}

export async function dataUrlToFile(dataUrl, name) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}