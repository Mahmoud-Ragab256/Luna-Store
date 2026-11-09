import { Link } from 'react-router-dom';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { errorMessage } from '../../lib/utils';
export function Loading({ count = 4 }) {
  return (
    <div className="product-grid" aria-label="Loading products" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-image" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty-state" role="alert">
      <RefreshCw />
      <h2>We couldn’t load this right now.</h2>
      <p>{errorMessage(error)}</p>
      {retry ? (
        <button className="btn" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here just yet.',
  description = 'Find something you love in the collection.',
  to = '/products',
  action = 'Explore the collection',
}) {
  return (
    <div className="empty-state">
      <ShoppingBag strokeWidth={1} />
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="btn" to={to}>
        {action}
      </Link>
    </div>
  );
}
