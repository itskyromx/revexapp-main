// Keep this inventory aligned with the services and browser storage used by the app.
// When a feature adds a collector or processor, update this file and bump the
// cookie policy version in cookieConsent.js before shipping it.
export const COOKIE_CATEGORIES = [
  {
    key: "essential",
    title: "Essential",
    description: "Required for sign-in, account security, consent records, site fonts and QR generation. The QR provider receives the drop-off code when its image is generated.",
    required: true,
  },
  {
    key: "preferences",
    title: "Preferences",
    description: "Remembers your theme, selected language, sidebar layout, feed position and local interaction cache on this device.",
    required: false,
  },
  {
    key: "analytics",
    title: "Analytics",
    description: "Measures how the platform is used. No analytics or advertising tracker is currently configured.",
    required: false,
  },
  {
    key: "personalization",
    title: "Semantic search and recommendations",
    description: "Allows product descriptions, searches and selected style/brand preferences to be processed by OpenAI for multilingual search and recommendations.",
    required: false,
  },
];

export const DATA_COLLECTION_AREAS = [
  {
    title: "Account and profile",
    details: "Email address, account identifier, username, sign-in provider, profile name, avatar, bio, style and brand preferences, and privacy settings.",
  },
  {
    title: "Content and media",
    details: "Posts, captions, tags, listings, item details, photos, videos, avatars and files uploaded to the platform's media storage.",
  },
  {
    title: "Platform activity",
    details: "Likes, views, shares, bookmarks, follows, blocks, searches sent to the profile search, notifications, chat messages, read status and message deletion records.",
  },
  {
    title: "Semantic search and recommendations",
    details: "When used, the product search query, public article descriptions and the account's selected style and brand preferences are sent to OpenAI to generate multilingual embeddings. Revex stores product vectors and limited product metadata in Supabase Vector Buckets; personal preference vectors are generated per request and are not stored.",
  },
  {
    title: "Marketplace and support",
    details: "Offers, orders, delivery country (Portugal or Spain), delivery addresses, buyer-selected collection point names and map coordinates, reviews, payout status, drop-off codes, reports and moderation records. Delivery details are shared with the seller and configured carrier to fulfil an order. Stripe processes card/payment details and the selected payment type; Revex stores a Stripe customer reference and payment-method references/summary so you can manage saved cards. Card data stays with Stripe.",
  },
  {
    title: "Technical and security data",
    details: "Authentication/session data, service request metadata, and security or operational logs processed by Supabase and Cloudflare to deliver, protect and troubleshoot the platform.",
  },
];

export const THIRD_PARTY_SERVICES = [
  {
    name: "Supabase",
    purpose: "Authentication, database, media storage and server functions used to operate Revex.",
    when: "When you use account and platform features.",
  },
  {
    name: "Cloudflare",
    purpose: "Website delivery, network security and operational observability.",
    when: "When your browser connects to Revex.",
  },
  {
    name: "Google",
    purpose: "Google OAuth sign-in, when selected, and Google Fonts for the site's required typography.",
    when: "When you choose Google sign-in or load Revex pages.",
  },
  {
    name: "QR Server",
    purpose: "Creates the drop-off QR image. The drop-off code is sent in the image request URL.",
    when: "When a drop-off QR is displayed, regardless of optional cookie choices.",
  },
  {
    name: "Stripe",
    purpose: "Hosted payment checkout, MB WAY/card/eligible Apple Pay transactions, saved card management and seller payout onboarding.",
    when: "When you start a checkout, add/manage a saved card or set up seller payouts. Stripe receives the payment information and required device/browser details directly in its hosted checkout.",
  },
  {
    name: "OpenAI",
    purpose: "Generates multilingual text embeddings for semantic product search and recommendations. Product descriptions, search queries and selected style/brand preferences are sent for this processing; Revex stores only product vectors and product metadata in its Supabase Vector Bucket.",
    when: "When you publish an article, search for products or receive personalized recommendations.",
  },
  {
    name: "OpenStreetMap",
    purpose: "Displays the map used to choose a collection point. The map provider receives the browser's IP address and requested map tile areas; selected coordinates are saved by Revex with the order and are not sent to OpenStreetMap by the map picker.",
    when: "Only when you open the map to choose a collection point.",
  },
  {
    name: "Delivery carriers",
    purpose: "Receive delivery address or collection point details and order fulfilment information when carrier integrations are configured and an order requires shipment.",
    when: "When the seller fulfils an order using a connected carrier.",
  },
  {
    name: "Social platforms",
    purpose: "Receive a post link and any message text you choose to share.",
    when: "Only when you select a sharing destination.",
  },
];
