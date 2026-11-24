// Keep this inventory aligned with the services and browser storage used by the app.
// When a feature adds a collector or processor, update this file and bump the
// cookie policy version in cookieConsent.js before shipping it.
export const COOKIE_CATEGORIES = [
  {
    key: "essential",
    title: "Essential",
    description: "Required for sign-in, account security, email verification, photo safety checks, consent records, site fonts and QR generation.",
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
    description: "Measures how the user navigates through the platform.",
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
    details: "Items, descriptions, tags, listing details and archive/visibility choices, photos, videos, avatars and files uploaded to the platform's media storage. New photos go through a mandatory safety checks before being published, independently of optional personalization consent. Revex keeps the account ID, image fingerprint, policy version, decision and limited reason code for up to 30 days; rejected image files are not saved by Revex. Approved-file references remain while the media is stored.",
  },
  {
    title: "Platform activity",
    details: "Likes, views, shares, bookmarks, follows, blocks, searches sent to the profile search, notifications, chat messages, read status and message deletion records.",
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
    name: "Resend",
    purpose: "Transactional email delivery for Supabase Auth, including account verification, recovery, sign-in and account security emails. Resend receives the recipient email address and the one-time code or verification link data needed to complete the requested action.",
    when: "When Supabase Auth needs to send an email for an account action.",
  },
  {
    name: "Cloudflare",
    purpose: "Website delivery, network security and operational observability.",
    when: "When your browser connects to Revex, and when you use semantic search, recommendations or publish an item while personalization is enabled.",
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
    name: "Delivery carriers",
    purpose: "Receive delivery address or collection point details and order fulfilment information when carrier integrations are configured and an order requires shipment.",
    when: "When the seller fulfils an order using a connected carrier.",
  },
  {
    name: "Social platforms",
    purpose: "Receive a item link and any message text you choose to share.",
    when: "Only when you select a sharing destination.",
  },
];
