export const money=value=>new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP',maximumFractionDigits:0}).format(Number(value)||0);
export const imageUrl=product=>product?.images?.[0]?.url||product?.images?.[0]||'/images/product-placeholder.svg';
export const errorMessage=error=>error?.data?.error?.message||error?.data?.message||error?.data?.detail||error?.message||'Something went wrong. Please try again.';
export const salePrice=product=>Math.round(Number(product.basePrice)*(1-(Number(product.discount)||0)/100)*100)/100;
