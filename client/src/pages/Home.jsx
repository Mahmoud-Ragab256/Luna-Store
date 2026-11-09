import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useApiQuery } from '../api/baseApi';
import ProductCard from '../components/products/ProductCard';
import { Loading, ErrorState } from '../components/common/Status';
function ProductSection({ title, subtitle, url }) {
  const { data, isLoading, error, refetch } = useApiQuery({ url, params: { limit: 4 } });
  return (
    <section className="section container">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <Link
          className="text-link"
          to={url.includes('best-sellers') ? '/products?sort=popularity' : '/products?sort=newest'}
        >
          View the edit <ArrowUpRight size={16} />
        </Link>
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <div className="product-grid">
          {(data?.data || []).slice(0, 4).map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
export default function Home() {
  const { data: categories } = useApiQuery({ url: '/categories' });
  const cats = categories?.data || [];
  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src="/images/luna-hero.png"
          alt="LUNA editorial: ivory linen tailoring in a sunlit stone courtyard"
          fetchPriority="high"
          width="1536"
          height="1024"
        />
        <div className="hero-content">
          <span className="hero-season">The everyday collection</span>
          <h1>
            A softer kind
            <br />
            of statement.
          </h1>
          <p>
            Thoughtful pieces. Endless possibilities.
            <br />
            Find a little more you in every day.
          </p>
          <div className="hero-actions">
            <Link to="/products?sort=newest" className="btn">
              Shop new arrivals <ArrowRight size={17} />
            </Link>
            <Link to="/categories" className="hero-link">
              Explore the collection
            </Link>
          </div>
        </div>
        <div className="hero-bottom">
          <span>Effortless, from morning to evening.</span>
          <span>
            Discover LUNA <ArrowDown />
          </span>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <h2>Made for your every day.</h2>
            <p>Considered essentials. Entirely your own.</p>
          </div>
          <Link className="text-link" to="/categories">
            All collections <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="category-editorial">
          {cats.slice(0, 3).map((c, i) => (
            <Link
              to={`/categories/${c.slug}`}
              key={c._id}
              className={`category-tile category-tile-${i}`}
            >
              <img
                src={c.image || '/images/product-placeholder.svg'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/product-placeholder.svg';
                }}
                alt={c.name}
                loading="lazy"
                width="600"
                height="700"
              />
              <div>
                <h3>{c.name}</h3>
                <ArrowUpRight strokeWidth={1} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <ProductSection
        title="Just arrived. Already loved."
        subtitle="Fresh additions to your wardrobe rotation."
        url="/products/new-arrivals"
      />
      <section className="collection-story">
        <div className="collection-photo">
          <img
            src="/images/catalog/fashion-7.jpg"
            alt="Soft neutral garments and natural fabrics"
            loading="lazy"
            width="1200"
            height="1200"
          />
        </div>
        <div className="collection-copy">
          <span>The soft tailoring edit</span>
          <h2>
            Less effort.
            <br />
            More possibility.
          </h2>
          <p>
            Easy silhouettes. Quiet details. Pieces that work together, and feel like you. Meet the
            collection made to move through your day.
          </p>
          <Link className="btn" to="/products?category=sets">
            Discover the edit <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <ProductSection
        title="The pieces you come back to."
        subtitle="Explore our best-selling styles."
        url="/products/best-sellers"
      />
      <section className="seasonal container">
        <div>
          <h2>
            Your next chapter,
            <br />
            beautifully dressed.
          </h2>
          <p>Layer softly. Dress freely. Make it yours.</p>
          <Link to="/products?category=knitwear" className="text-link">
            Discover seasonal layers <ArrowRight size={17} />
          </Link>
        </div>
        <img
          src="/images/catalog/fashion-8.jpg"
          alt="A city wardrobe for a new season"
          loading="lazy"
          width="1000"
          height="800"
        />
      </section>
      <section className="promo">
        <p>A wardrobe worth making room for.</p>
        <h2>Find something unexpected.</h2>
        <Link to="/products?discount=true" className="btn btn-outline">
          Shop the sale edit
        </Link>
      </section>
      <ProductSection
        title="On our radar."
        subtitle="A few pieces to get to know."
        url="/products/featured"
      />
      <section className="brand-story container">
        <span>The LUNA point of view</span>
        <h2>
          Clothes to live in.
          <br />A feeling to come back to.
        </h2>
        <p>
          We believe getting dressed should feel good. LUNA brings together easy shapes, thoughtful
          details and a softer approach to everyday style. Discover a wardrobe that leaves room for
          you.
        </p>
        <Link to="/journal" className="text-link">
          Meet LUNA <ArrowUpRight size={16} />
        </Link>
      </section>
      <CustomerReviews />
      <section className="community container">
        <div className="section-heading">
          <h2>The everyday, through our lens.</h2>
          <Link className="text-link" to="/journal">
            The LUNA journal <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="community-grid">
          {cats.slice(3, 7).map((c) => (
            <Link to={`/categories/${c.slug}`} key={c._id}>
              <img
                src={c.image || '/images/product-placeholder.svg'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/product-placeholder.svg';
                }}
                alt={`${c.name} styling inspiration`}
                loading="lazy"
                width="400"
                height="480"
              />
            </Link>
          ))}
        </div>
        <p className="development-note">
          Development collection: product photography and sample reviews are illustrative
          placeholders.
        </p>
      </section>
    </>
  );
}
function CustomerReviews() {
  const { data } = useApiQuery({ url: '/products', params: { sort: 'rating', limit: 1 } });
  const product = data?.data?.[0];
  const reviews = useApiQuery({ url: `/products/${product?._id}/reviews` }, { skip: !product });
  return (
    <section className="community-reviews">
      <div className="container">
        <h2>A few words from the fitting room.</h2>
        <p className="development-note">
          Development sample reviews. These are illustrative, not real customer endorsements.
        </p>
        <div className="review-grid">
          {(reviews.data?.data || []).slice(0, 3).map((review) => (
            <article className="review" key={review._id}>
              <span aria-label={`${review.rating} out of 5 stars`}>
                {'?'.repeat(review.rating)}
              </span>
              <p>{review.comment}</p>
              <small>{review.name || 'Development sample'}</small>
            </article>
          ))}
        </div>
        {!reviews.isLoading && !reviews.data?.data?.length ? (
          <p>Customer reviews will appear after verified purchases.</p>
        ) : null}
      </div>
    </section>
  );
}
function ArrowDown() {
  return <span aria-hidden="true">↓</span>;
}
