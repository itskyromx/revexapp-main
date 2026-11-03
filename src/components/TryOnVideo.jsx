// Acid Arcade styled try-on video player.
export default function TryOnVideo({ src, className = "" }) {
  if (!src) return null;
  return (
    <div className={`acid-card bg-black overflow-hidden ${className}`}>
      <video src={src} className="w-full h-full object-cover" controls playsInline loop preload="metadata" />
    </div>
  );
}