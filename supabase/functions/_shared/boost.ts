export const BOOST_PACKAGES = [
  { id: 'day', label: '24 hours', hours: 24, price: 1.49 },
  { id: 'three_days', label: '3 days', hours: 72, price: 3.99 },
  { id: 'week', label: '7 days', hours: 168, price: 7.99 },
];

export function findBoostPackage(id) {
  if (typeof id !== 'string') return null;
  return BOOST_PACKAGES.find((p) => p.id === id) || null;
}

