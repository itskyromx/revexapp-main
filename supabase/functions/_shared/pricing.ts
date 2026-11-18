export const BUYER_PROTECTION_RATE = 0.04;
export const BUYER_PROTECTION_FIXED = 0.6;

const cents = (n) => Math.round(Number(n || 0) * 100) / 100;

export function buyerProtectionFee(itemPrice) {
  return cents(Number(itemPrice || 0) * BUYER_PROTECTION_RATE + BUYER_PROTECTION_FIXED);
}

export function orderTotals(itemPrice, shippingPrice) {
  const price = cents(itemPrice);
  const shipping = cents(shippingPrice);
  const fee = buyerProtectionFee(price);
  return { itemPrice: price, shipping, fee, total: cents(price + shipping + fee) };
}

export function sellerPayout(itemPrice, shippingPrice) {
  return cents(cents(itemPrice) + cents(shippingPrice));
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateDropOffCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return 'RV-' + out;
}
