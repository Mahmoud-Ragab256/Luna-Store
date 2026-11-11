import { Link, useLocation } from 'react-router-dom';

export default function ShopLinks({ shopLabel = 'Shop', onNavigate }) {
  const { pathname, search } = useLocation();
  const newest = pathname === '/products' && new URLSearchParams(search).get('sort') === 'newest';
  const shop = pathname.startsWith('/products') && !newest;
  return (
    <>
      <Link
        onClick={onNavigate}
        to="/products"
        className={shop ? 'active' : undefined}
        aria-current={shop ? 'page' : undefined}
      >
        {shopLabel}
      </Link>
      <Link
        onClick={onNavigate}
        to="/products?sort=newest"
        className={newest ? 'active' : undefined}
        aria-current={newest ? 'page' : undefined}
      >
        New arrivals
      </Link>
    </>
  );
}
