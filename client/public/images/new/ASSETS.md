# LUNA capsule concept photography

Eight separate images were generated with the built-in image_gen tool on 11 November 2026, reviewed visually, saved in this project and encoded as WebP. They are AI product concepts for a clearly marked demonstration store, not photographs of manufactured stock. No real model, customer review or inventory authenticity claim is made.

## Shared generation prompt

Create one premium ecommerce product photograph for LUNA women's fashion. Single product only: [subject below]. The entire garment must be clearly visible and accurate, perfectly centered hanging invisibly in a straight front view, portrait 3:4 composition. Warm ivory seamless studio background, very soft natural shadows, delicate high-end fabric texture, realistic photographic material and stitching. No people, mannequin, hanger, accessories, other garments, text, watermark, collage, panels or labels. Generous padding around the garment. This image will be used for exactly this named product; silhouette and color must be unambiguous.

The first two prompts used the equivalent closing wording: Leave generous padding around the garment. This image will be used for exactly this named product, so silhouette and color must be unambiguous.

## Individual subjects and final files

- `ivory-linen-dress.webp`: An ivory linen midi dress, short sleeves, V neckline, subtle waist seam and matching fabric waist tie, no buttons, gently flared hem.
- `navy-cotton-tee.webp`: A women's navy blue cotton crew-neck short sleeve T-shirt, relaxed straight fit, no graphics or logos.
- `white-poplin-blouse.webp`: A women's crisp white cotton poplin long sleeve button-front blouse, classic pointed collar, subtly puffed sleeves with fitted cuffs, straight relaxed body.
- `blue-straight-jeans.webp`: Women's classic mid-blue straight-leg full-length denim jeans, high waist, five-pocket construction, brass button, no rips or distressing.
- `sand-tailored-trousers.webp`: Women's warm sand beige high-waisted tailored full-length trousers, single front pleat on each leg, wide straight leg, clean waistband.
- `rose-pleated-skirt.webp`: A women's dusty rose pink pleated midi skirt, defined narrow accordion pleats, simple flat elastic waist, elegant A-line silhouette.
- `linen-relaxed-blazer.webp`: A women's warm oat beige linen single-breasted relaxed blazer, two tonal buttons, notched lapels, long sleeves, two flap pockets. The output has one visible front button; the product description deliberately does not claim two.
- `cream-ribbed-knit.webp`: A women's soft cream ivory ribbed knit sweater, long sleeves, crew neckline, relaxed hip length, clearly visible vertical knitted ribs.

Each added product uses only its own reviewed photo and one matching colour, with XS?XL demo sizes. No unrelated alternate gallery image was attached. The public Cloudinary URLs and product mapping are recorded in `artifacts/capsule-products.json`; the contact sheet is `artifacts/new-product-image-review.png`. `scripts/add-capsule-products.js` inserts missing products through the protected admin API and skips already-existing slugs.
