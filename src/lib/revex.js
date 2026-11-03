// Revex shared helpers + constants
import { hasCookieConsent } from "@/lib/cookieConsent";

export const CONDITION_LABELS = {
  new_with_tags: "NWT",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

export const CATEGORY_LABELS = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Other",
};

export const PRODUCT_GENDERS = ["men", "women", "unisex"];
export const PRODUCT_GENDER_LABELS = { men: "Men", women: "Women", unisex: "Unisex" };

export const PRODUCT_CATEGORIES = {
  coats: { label: "Coats & jackets", subcategories: ["Puffer", "Denim jacket", "Leather jacket", "Bomber", "Trench coat", "Blazer", "Windbreaker"] },
  trousers: { label: "Trousers", subcategories: ["Baggy", "Straight", "Skinny", "Wide-leg", "Cargo", "Flare", "Tailored", "Joggers"] },
  shirts: { label: "Shirts & tops", subcategories: ["T-shirt", "Shirt", "Blouse", "Tank top", "Knitwear", "Hoodie", "Sweatshirt", "Polo"] },
  accessories: { label: "Accessories", subcategories: ["Bags", "Belts", "Hats", "Jewellery", "Scarves", "Sunglasses", "Watches"] },
  shoes: { label: "Shoes", subcategories: ["Sneakers", "Boots", "Loafers", "Heels", "Sandals", "Flats"] },
  dresses: { label: "Dresses & skirts", subcategories: ["Mini dress", "Midi dress", "Maxi dress", "Mini skirt", "Midi skirt", "Maxi skirt"] },
};

export const PRODUCT_BRANDS = [
  "Nike", "Adidas", "Levi's", "New Balance", "Zara", "H&M", "Uniqlo", "Carhartt",
  "The North Face", "Patagonia", "Converse", "Puma", "Reebok", "Vans", "Dickies",
  "Dr. Martens", "Stüssy", "Supreme", "Ralph Lauren", "Gucci", "Prada", "Other",
];

export const STYLE_TAGS = [
  "Y2K", "Streetwear", "Alternative", "Vintage", "Grunge", "Minimalist", "Gorpcore",
  "Old money", "Coquette", "Cottagecore", "Skater", "Workwear", "Darkwear", "Preppy",
];

export const POST_CATEGORIES = [
  "hauls", "try_on", "streetwear", "vintage", "y2k", "cottagecore", "luxury", "other",
];

export const POST_CATEGORY_LABELS = {
  hauls: "Hauls", try_on: "Try-On", streetwear: "Streetwear", vintage: "Vintage",
  y2k: "Y2K", cottagecore: "Cottagecore", luxury: "Luxury", other: "Other",
};

export function formatPrice(n) {
  if (n == null || isNaN(n)) return "—";
  return "€" + Number(n).toFixed(0);
}

/** The name shown for a user everywhere: their chosen display name first. */
export function displayName(user) {
  if (!user) return "";
  return user.display_name || user.full_name || user.email || "";
}

export function initials(name) {
  if (!name) return "S";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "S";
}

const AVATAR_COLORS = ["#00E5FF", "#FFE600", "#FF3D9A", "#9DFF00", "#B388FF", "#FF8A3D"];
export function avatarColor(name) {
  let h = 0;
  for (let i = 0; name && i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/**
 * Server timestamps come back without a timezone marker. Reading those as local
 * time shifts them by the viewer's UTC offset, which is what made messages sent
 * right after clearing a chat look older than the clear and disappear.
 */
export function toDate(value) {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const d = new Date(value + "Z");
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = toDate(dateStr);
  if (!d) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return new Date(dateStr).toLocaleDateString();
}

export function timeAgoVerbose(dateStr) {
  if (!dateStr) return "";
  const date = toDate(dateStr);
  if (!date) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${Math.max(1, seconds)} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} week`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} month`;
  return `${Math.floor(seconds / 31536000)} year`;
}

export function loadLiked() {
  if (!hasCookieConsent("preferences")) return new Set();
  try { return new Set(JSON.parse(localStorage.getItem("revex_liked") || "[]")); }
  catch { return new Set(); }
}
export function saveLiked(set) {
  if (!hasCookieConsent("preferences")) return;
  try { localStorage.setItem("revex_liked", JSON.stringify([...set])); } catch {}
}

export function loadSaved() {
  if (!hasCookieConsent("preferences")) return new Set();
  try { return new Set(JSON.parse(localStorage.getItem("revex_saved") || "[]")); }
  catch { return new Set(); }
}
export function saveSaved(set) {
  if (!hasCookieConsent("preferences")) return;
  try { localStorage.setItem("revex_saved", JSON.stringify([...set])); } catch {}
}

// Curated aesthetic tags for item tagging (hybrid system)
export const CURATED_TAGS = [
  "Y2K", "Vintage", "Streetwear", "Cottagecore", "Luxury", "Oversized",
  "Slim Fit", "Minimalist", "Thrifted", "Grunge", "Cozy", "Festival",
];

// Curated brand list for onboarding selection
export const CURATED_BRANDS = [
  "Nike", "Adidas", "Zara", "H&M", "Gucci", "Prada", "Balenciaga",
  "Levi's", "Carhartt", "Stüssy", "Supreme", "Ralph Lauren",
  "Maison Margiela", "Diesel", "The North Face", "Patagonia",
  "Vetements", "Rick Owens",
];

// Trim, strip leading #, de-duplicate (case-insensitive)
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (let t of tags) {
    const v = String(t).trim().replace(/^#/, "");
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
