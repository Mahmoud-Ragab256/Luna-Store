import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Heart, Minus, Plus, Truck, RotateCcw, Star, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { useApiQuery, useApiMutation } from '../api/baseApi';
import { addItem } from '../features/cart/cartSlice';
import { toggleWishlist } from '../features/wishlist/wishlistSlice';
import { money, imageUrl, errorMessage } from '../lib/utils';
import { Loading, ErrorState } from '../components/common/Status';
import ProductCard from '../components/products/ProductCard';
import Dialog from '../components/common/Dialog';
export default function ProductDetails() {
  const { slug } = useParams();
  const gallery = useRef(null);
  const { data, isLoading, error, refetch } = useApiQuery({ url: `/products/${slug}` });
  const product = data?.data;
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [mutate, { isLoading: saving }] = useApiMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const saved = useSelector((s) => s.wishlist.items.some((p) => p.slug === slug));
  const { data: related } = useApiQuery(
    {
      url: '/products',
      params: { category: product?.categoryId?.slug || product?.categoryId, limit: 4 },
    },
    { skip: !product },
  );
  const { data: reviews } = useApiQuery(
    { url: `/products/${product?._id}/reviews` },
    { skip: !product },
  );
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    setColor('');
    setSize('');
    setQuantity(1);
  }, [slug]);
  useEffect(() => {
    if (!product) return;
    try {
      const previous = JSON.parse(localStorage.getItem('luna.recent.v1') || '[]');
      setRecent(previous.filter((p) => p._id !== product._id).slice(0, 4));
      localStorage.setItem(
        'luna.recent.v1',
        JSON.stringify([product, ...previous.filter((p) => p._id !== product._id)].slice(0, 5)),
      );
    } catch {
      /* Optional history does not block shopping. */
    }
  }, [product]);
  if (isLoading)
    return (
      <div className="container section">
        <Loading count={2} />
      </div>
    );
  if (error)
    return (
      <div className="container section">
        <ErrorState error={error} retry={refetch} />
      </div>
    );
  if (!product) return null;
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const variant = product.variants.find((v) => v.color === color && v.size === size);
  const price = variant?.priceOverride ?? product.basePrice;
  const finalPrice = Math.round(price * (1 - (product.discount || 0) / 100) * 100) / 100;
  function add(buy = false) {
    if (!variant || variant.stock < quantity) {
      toast.error('Choose an available size and colour.');
      return;
    }
    dispatch(
      addItem({
        productId: product._id,
        sku: variant.sku,
        size,
        color,
        quantity,
        name: product.name,
        price: finalPrice,
        image: imageUrl(product),
        slug,
      }),
    );
    toast.success('Added to your bag');
    if (buy) navigate('/checkout');
  }
  async function wish() {
    dispatch(toggleWishlist(product));
    if (user)
      try {
        await mutate({
          url: saved ? `/wishlist/items/${product._id}` : '/wishlist/items',
          method: saved ? 'DELETE' : 'POST',
          body: saved ? undefined : { productId: product._id },
        }).unwrap();
      } catch (e) {
        dispatch(toggleWishlist(product));
        toast.error(errorMessage(e));
      }
  }
  async function review(e) {
    e.preventDefault();
    try {
      await mutate({
        url: `/products/${product._id}/reviews`,
        method: 'POST',
        body: { rating: Number(rating), comment },
      }).unwrap();
      setComment('');
      toast.success('Review submitted for moderation');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="container product-page">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">The collection</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail-layout">
        <div className="product-gallery">
          <Swiper
            onSwiper={(swiper) => {
              gallery.current = swiper;
            }}
            modules={[Navigation, Pagination]}
            navigation
            pagination={{ clickable: true }}
            spaceBetween={12}
          >
            {product.images.map((src, i) => (
              <SwiperSlide key={src.url || src}>
                <img
                  src={src.url || src}
                  alt={`${product.name}, view ${i + 1}`}
                  width="900"
                  height="1200"
                  loading={i ? 'lazy' : 'eager'}
                />
              </SwiperSlide>
            ))}
          </Swiper>
          <button
            className="zoom-button icon-btn"
            aria-label="Zoom product image"
            onClick={() => setZoom(true)}
          >
            <Maximize2 size={18} />
          </button>
          <div className="thumbnail-gallery">
            {product.images.map((src, i) => (
              <button
                className="thumbnail-button"
                key={i}
                aria-label={`View image ${i + 1}`}
                onClick={() => gallery.current?.slideTo(i)}
              >
                <img
                  src={src.url || src}
                  alt={`Thumbnail ${i + 1}`}
                  width="80"
                  height="100"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
        <div className="product-detail-copy">
          <p className="muted">The LUNA collection</p>
          <h1>{product.name}</h1>
          {product.reviewCount > 0 ? (
            <a className="rating" href="#reviews">
              <Star size={14} fill="currentColor" />
              {Number(product.averageRating).toFixed(1)} Â· {product.reviewCount} reviews
            </a>
          ) : (
            <p className="muted">New to your wardrobe</p>
          )}
          <div className="price-large">
            {money(finalPrice)}{' '}
            {product.discount > 0 ? (
              <>
                <del>{money(price)}</del>
                <span className="sale-tag">Save {product.discount}%</span>
              </>
            ) : null}
          </div>
          <p className="product-description">{product.description}</p>
          <fieldset className="variant-field">
            <legend>
              Colour <span>{color || 'Choose your colour'}</span>
            </legend>
            <div className="variant-options">
              {colors.map((c) => (
                <button
                  key={c}
                  className={color === c ? 'selected' : ''}
                  aria-pressed={color === c}
                  onClick={() => {
                    setColor(c);
                    setQuantity(1);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="variant-field">
            <legend>
              Size{' '}
              <button className="text-link" onClick={() => setGuide(true)}>
                Size guide
              </button>
            </legend>
            <div className="variant-options sizes">
              {sizes.map((s) => {
                const unavailable = !product.variants.some(
                  (v) => v.size === s && (!color || v.color === color) && v.stock > 0,
                );
                return (
                  <button
                    key={s}
                    disabled={unavailable}
                    aria-pressed={size === s}
                    className={size === s ? 'selected' : ''}
                    onClick={() => {
                      setSize(s);
                      setQuantity(1);
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="stock-message" role="status">
            {variant
              ? variant.stock > 0
                ? `${variant.stock} available in your selection`
                : 'This combination is currently unavailable.'
              : 'Select size and colour to check availability.'}
          </p>
          <div className="purchase-row">
            <div className="quantity-control">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                disabled={!variant || quantity >= variant.stock}
                aria-label="Increase quantity"
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="btn"
              disabled={!variant || variant.stock < quantity}
              onClick={() => add()}
            >
              Add to bag Â· {money(finalPrice * quantity)}
            </button>
            <button
              className="icon-btn wishlist-detail"
              onClick={wish}
              aria-label="Save to wishlist"
              aria-pressed={saved}
            >
              <Heart fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
          <button
            className="btn btn-outline buy-now"
            disabled={!variant || variant.stock < quantity}
            onClick={() => add(true)}
          >
            Buy now
          </button>
          <div className="product-services">
            <span>
              <Truck size={17} /> Shipping across Egypt. Calculated at checkout.
            </span>
            <span>
              <RotateCcw size={17} />{' '}
              <Link to="/policies/returns">Read our returns & exchanges policy</Link>
            </span>
          </div>
          <details open>
            <summary>Details & care</summary>
            <p>
              {product.specifications && typeof product.specifications === 'object'
                ? Object.entries(product.specifications)
                    .map(([key, value]) => key + ': ' + value)
                    .join(' · ')
                : product.specifications ||
                  'See the garment care label for composition and washing instructions. Measurements may vary slightly by style.'}
            </p>
          </details>
          <details>
            <summary>Shipping & delivery</summary>
            <p>
              Choose your governorate at checkout for available delivery methods, costs and
              estimated delivery windows.
            </p>
          </details>
        </div>
      </div>
      <section id="reviews" className="section review-section">
        <h2>A closer look, from you.</h2>
        <p className="development-note">
          Seeded reviews are development samples, not verified customer testimonials.
        </p>
        {(reviews?.data || []).map((r) => (
          <article key={r._id} className="review">
            <span>{'â˜…'.repeat(r.rating)}</span>
            <p>{r.comment}</p>
            <small>{r.userId?.name || 'LUNA customer'}</small>
          </article>
        ))}
        {user ? (
          <form noValidate onSubmit={review} className="panel review-form">
            <h3>Share your thoughts</h3>
            <label>
              Rating
              <select value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your review
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                minLength={5}
                maxLength={2000}
                required
                rows={4}
              />
            </label>
            <button className="btn" disabled={saving || comment.length < 5}>
              Submit review
            </button>
          </form>
        ) : (
          <Link className="text-link" to="/login">
            Sign in to write a review
          </Link>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>A little more to love.</h2>
          <Link to="/products" className="text-link">
            Shop all
          </Link>
        </div>
        <div className="product-grid">
          {(related?.data || [])
            .filter((p) => p._id !== product._id)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
        </div>
      </section>
      {recent.length ? (
        <section className="section">
          <h2>Recently on your mind.</h2>
          <div className="product-grid">
            {recent.map((p) => (
              <ProductCard product={p} key={p._id} />
            ))}
          </div>
        </section>
      ) : null}
      <Dialog open={guide} title="Find your fit" onClose={() => setGuide(false)}>
        <p>
          Illustrative body measurements in centimetres. Check style-specific details before
          ordering.
        </p>
        <table>
          <thead>
            <tr>
              <th>Size</th>
              <th>Bust</th>
              <th>Waist</th>
              <th>Hips</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['XS', 80, 62, 88],
              ['S', 84, 66, 92],
              ['M', 90, 72, 98],
              ['L', 96, 78, 104],
              ['XL', 102, 84, 110],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Dialog>
      <Dialog open={zoom} title={product.name} onClose={() => setZoom(false)}>
        <img className="zoom-image" src={imageUrl(product)} alt={`${product.name} enlarged`} />
      </Dialog>
    </div>
  );
}
