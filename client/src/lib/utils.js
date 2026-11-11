export const money = (value) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
export const imageUrl = (product) =>
  product?.images?.[0]?.url || product?.images?.[0] || '/images/product-placeholder.svg';
export function optimizedImage(source, width = 960) {
  if (!source || typeof source !== 'string') return '/images/product-placeholder.svg';
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(source)) return source;
  return source.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
export function responsiveImageSet(source) {
  if (
    typeof source !== 'string' ||
    !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(source)
  )
    return undefined;
  return [240, 480, 720, 960, 1440]
    .map((width) => `${optimizedImage(source, width)} ${width}w`)
    .join(', ');
}
export const errorMessage = (error) =>
  error?.data?.error?.message ||
  error?.data?.message ||
  error?.data?.detail ||
  error?.message ||
  'Something went wrong. Please try again.';
export const salePrice = (product) =>
  Math.round(Number(product.basePrice) * (1 - (Number(product.discount) || 0) / 100) * 100) / 100;
