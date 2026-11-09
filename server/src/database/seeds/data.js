export const fashionImages = Array.from({ length: 8 }, (_, index) => `/images/catalog/fashion-${index + 1}.jpg`);
export const categoryNames = ['Dresses', 'Tops', 'Blouses', 'T-Shirts', 'Jeans', 'Pants', 'Skirts', 'Jackets', 'Knitwear', 'Sets', 'Activewear', 'Accessories'];
export const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categoryData = categoryNames.map((name, index) => ({ name, slug: slugify(name), description: `Thoughtfully selected ${name.toLowerCase()} for your everyday wardrobe.`, image: fashionImages[index % fashionImages.length], displayOrder: index, isActive: true }));
const styles = [
  ['The Linen Midi Dress', 1890], ['Everyday Cotton Shirt', 990], ['The Gathered Blouse', 1190], ['Essential Soft Tee', 490],
  ['The Straight-Leg Jean', 1490], ['The Tailored Trouser', 1590], ['The Satin Midi Skirt', 1290], ['The Relaxed Blazer', 2290],
  ['The Soft Ribbed Knit', 1190], ['The Weekend Linen Set', 2490], ['The Studio Legging', 890], ['The Everyday Tote', 790],
  ['The Evening Slip Dress', 2190], ['The Ribbed Tank', 590], ['The Poplin Tie Blouse', 1090], ['The Weekend Tee', 550],
  ['The Wide-Leg Jean', 1590], ['The Linen Pull-On Pant', 1390], ['The Pleated Maxi Skirt', 1490], ['The Cropped Denim Jacket', 1790],
  ['The Fine-Knit Cardigan', 1690], ['The Soft Lounge Set', 1890], ['The Studio Zip Top', 1090], ['The Silk-Feel Scarf', 390],
  ['The Wrap Maxi Dress', 1990], ['The Square-Neck Top', 790], ['The Relaxed Linen Blouse', 1390], ['The Boxy Cotton Tee', 590],
  ['The Classic Blue Jean', 1390], ['The Fluid Wide-Leg Pant', 1690], ['The Linen Wrap Skirt', 1190], ['The Trench Jacket', 2890],
  ['The Textured Sweater', 1790], ['The City Co-Ord', 2790], ['The Movement Short', 690], ['The Woven Shoulder Bag', 990],
  ['The Cotton Day Dress', 1690], ['The Asymmetric Top', 890], ['The Soft Drape Blouse', 1290], ['The Signature Crew Tee', 490],
];
export function productData(categories) {
  return styles.map(([name, basePrice], index) => {
    const color = ['Ivory', 'Black', 'Sand', 'Rose'][index % 4];
    const second = ['Sand', 'Ivory', 'Black', 'Ivory'][index % 4];
    const category = categories[index % 12];
    return { name, slug: slugify(name), description: `${name} brings an effortless shape to your wardrobe. A considered silhouette, soft hand feel and easy movement make it a piece to return to, season after season. Style it your way, from a slow morning to an evening in the city.`, categoryId: category._id, images: [fashionImages[index % fashionImages.length], fashionImages[(index + 3) % fashionImages.length]], basePrice, discount: index % 5 === 0 ? 15 : 0, variants: [color, second].flatMap((variantColor, colorIndex) => ['XS', 'S', 'M', 'L', 'XL'].map((size, sizeIndex) => ({ sku: `LUNA-${String(index + 1).padStart(3, '0')}-${colorIndex}-${size}`, size, color: variantColor, colorHex: { Ivory: '#F4F0E8', Black: '#252525', Sand: '#D1BDA5', Rose: '#B98686' }[variantColor], stock: sizeIndex === 4 && index % 3 === 0 ? 0 : 5 + (index % 15) }))), tags: [index < 12 ? 'new-arrival' : 'essentials', index % 3 === 0 ? 'bestseller' : 'everyday'], specifications: { Composition: index % 2 ? '100% cotton (development sample)' : '55% linen, 45% viscose (development sample)', Care: 'Cold gentle wash. Dry flat. Cool iron.', Fit: 'Relaxed fit. Model measurements are unavailable for development imagery.' }, isFeatured: index < 8, isActive: true, averageRating: 0, reviewCount: 0, soldCount: 40 - index };
  });
}

