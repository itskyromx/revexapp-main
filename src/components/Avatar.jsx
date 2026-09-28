import { initials, avatarColor } from "@/lib/styld";

export default function Avatar({ name, src, size = 40, ring = false, className = "" }) {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        style={dim}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...dim, backgroundColor: avatarColor(name) }}
      className={`rounded-full flex items-center justify-center font-display text-black ${className}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}