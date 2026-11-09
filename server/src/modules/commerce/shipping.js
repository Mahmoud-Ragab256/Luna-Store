const DEFAULT_ZONES = [
  ['Cairo', 65, 2, 4],
  ['Giza', 65, 2, 4],
  ['Alexandria', 85, 3, 5],
  ['Qalyubia', 80, 3, 5],
  ['Dakahlia', 90, 3, 5],
  ['Sharqia', 90, 3, 5],
  ['Gharbia', 90, 3, 5],
  ['Monufia', 90, 3, 5],
  ['Beheira', 90, 3, 5],
  ['Kafr El Sheikh', 95, 3, 6],
  ['Damietta', 95, 3, 6],
  ['Port Said', 95, 3, 6],
  ['Ismailia', 95, 3, 6],
  ['Suez', 95, 3, 6],
  ['Faiyum', 95, 3, 6],
  ['Beni Suef', 100, 4, 6],
  ['Minya', 110, 4, 7],
  ['Asyut', 110, 4, 7],
  ['Sohag', 120, 4, 7],
  ['Qena', 120, 4, 7],
  ['Luxor', 130, 4, 7],
  ['Aswan', 140, 5, 8],
  ['Red Sea', 140, 5, 8],
  ['Matrouh', 140, 5, 8],
  ['New Valley', 150, 5, 9],
  ['North Sinai', 150, 5, 9],
  ['South Sinai', 150, 5, 9],
].map(([governorate, fee, minDays, maxDays]) => ({ governorate, fee, minDays, maxDays }));
export function shippingConfiguration() {
  const zones = process.env.SHIPPING_ZONES_JSON
    ? JSON.parse(process.env.SHIPPING_ZONES_JSON)
    : DEFAULT_ZONES;
  if (
    !Array.isArray(zones) ||
    zones.some((zone) => !zone.governorate || !Number.isFinite(zone.fee) || zone.fee < 0)
  )
    throw new Error('Invalid SHIPPING_ZONES_JSON');
  const freeShippingThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 2500);
  const expressSurcharge = Number(process.env.SHIPPING_EXPRESS_SURCHARGE || 65);
  if (
    !Number.isFinite(freeShippingThreshold) ||
    freeShippingThreshold < 0 ||
    !Number.isFinite(expressSurcharge) ||
    expressSurcharge < 0
  )
    throw new Error('Invalid shipping amounts');
  return {
    zones,
    freeShippingThreshold,
    expressEnabled: process.env.SHIPPING_EXPRESS_ENABLED === 'true',
    expressSurcharge,
  };
}
export function calculateShipping(governorate, method, subtotal) {
  const config = shippingConfiguration();
  const zone = config.zones.find(
    (entry) => entry.governorate.toLowerCase() === governorate.toLowerCase(),
  );
  if (!zone)
    throw Object.assign(new Error('Choose a supported Egyptian governorate'), { statusCode: 422 });
  if (method === 'express' && !config.expressEnabled)
    throw Object.assign(new Error('Express shipping is not available'), { statusCode: 422 });
  return {
    fee:
      (subtotal >= config.freeShippingThreshold ? 0 : zone.fee) +
      (method === 'express' ? config.expressSurcharge : 0),
    estimatedDelivery:
      method === 'express' ? '1–2 business days' : `${zone.minDays}–${zone.maxDays} business days`,
    governorate: zone.governorate,
    method,
  };
}
