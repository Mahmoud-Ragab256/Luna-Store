import ProgressiveImage from '../common/ProgressiveImage';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Heart, ArrowUpRight, Star } from 'lucide-react';
import { toast } from 'sonner';
import { toggleWishlist } from '../../features/wishlist/wishlistSlice';
import { useApiMutation } from '../../api/baseApi';
import { money, imageUrl, salePrice, errorMessage } from '../../lib/utils';
import Dialog from '../common/Dialog';
const swatches = {
  Ivory: '#ebe7df',
  Black: '#333',
  Rose: '#b98686',
  Beige: '#cebda6',
  Blue: '#8c9fae',
  White: '#fff',
  Olive: '#83846c',
  Brown: '#8f705e',
  Cream: '#ece4d5',
  Navy: '#344153',
  Pink: '#d5a1ae',
  Sage: '#a0ac97',
};
export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const [quick, setQuick] = useState(false);
  const saved = useSelector((s) => s.wishlist.items.some((p) => p._id === product._id));
  const user = useSelector((s) => s.auth.user);
  const [mutate] = useApiMutation();
  const colors = [...new Set(product.variants?.map((v) => v.color) || [])];
  async function wish() {
    dispatch(toggleWishlist(product));
    if (user) {
      try {
        await mutate({
          url: saved ? `/wishlist/items/${product._id}` : '/wishlist/items',
          method: saved ? 'DELETE' : 'POST',
          body: saved ? undefined : { productId: product._id },
        }).unwrap();
      } catch (e) {
        dispatch(toggleWishlist(product));
        toast.error(errorMessage(e));
        return;
      }
    }
    toast.success(saved ? 'Removed from your wishlist' : 'Saved to your wishlist');
  }
  return (
    <article className="product-card">
      <div className="product-picture">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
          <ProgressiveImage
            src={imageUrl(product)}
            alt={product.name}
            loading="lazy"
            width="600"
            height="800"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/product-placeholder.svg';
            }}
          />
        </Link>
        {product.discount > 0 ? (
          <span className="product-badge">−{product.discount}%</span>
        ) : product.isFeatured ? (
          <span className="product-badge">Luna favourite</span>
        ) : null}
        <button
          className={`wish-button ${saved ? 'saved' : ''}`}
          onClick={wish}
          aria-label={`${saved ? 'Remove' : 'Save'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
          aria-pressed={saved}
        >
          <Heart size={19} fill={saved ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>
        <button className="quick-view" onClick={() => setQuick(true)}>
          Quick view <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="product-information">
        <Link to={`/products/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-price">
          <span>{money(salePrice(product))}</span>
          {product.discount > 0 ? <del>{money(product.basePrice)}</del> : null}
        </div>
        <div className="card-bottom">
          <div className="swatches" aria-label={`Colours: ${colors.join(', ')}`}>
            {colors.slice(0, 5).map((c) => (
              <span key={c} title={c} style={{ background: swatches[c] || c.toLowerCase() }} />
            ))}
          </div>
          {product.reviewCount > 0 ? (
            <span className="rating">
              <Star size={11} fill="currentColor" />
              {Number(product.averageRating).toFixed(1)} <span>({product.reviewCount})</span>
            </span>
          ) : null}
        </div>
      </div>
      <Dialog title={product.name} open={quick} onClose={() => setQuick(false)}>
        <div className="quick-content">
          <ProgressiveImage src={imageUrl(product)} alt={product.name} />
          <div>
            <p className="price-large">{money(salePrice(product))}</p>
            <p>{product.description}</p>
            <p>Available in {colors.join(', ')}.</p>
            <Link className="btn" onClick={() => setQuick(false)} to={`/products/${product.slug}`}>
              Choose size & colour
            </Link>
          </div>
        </div>
      </Dialog>
    </article>
  );
}
