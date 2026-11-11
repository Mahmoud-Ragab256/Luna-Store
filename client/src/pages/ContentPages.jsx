import ProgressiveImage from '../components/common/ProgressiveImage';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowUpRight } from 'lucide-react';
import { useApiQuery, useApiMutation } from '../api/baseApi';
import { Loading, ErrorState } from '../components/common/Status';
import { errorMessage } from '../lib/utils';
export function Categories() {
  const { data, isLoading, error, refetch } = useApiQuery({ url: '/categories' });
  return (
    <div className="container section">
      <div className="page-heading">
        <p>The LUNA wardrobe</p>
        <h1>A little of everything you love.</h1>
        <p>Find your own way to wear the everyday.</p>
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <div className="categories-grid">
          {data?.data.map((c) => (
            <Link to={`/categories/${c.slug}`} className="category-tile" key={c._id}>
              <ProgressiveImage
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
                <h2>{c.name}</h2>
                <ArrowUpRight />
              </div>
              <p>{c.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
const contactSchema = z.object({
  name: z.string().min(2, 'Enter your full name.'),
  email: z.email('Enter a valid email.'),
  subject: z.string().min(3, 'Add a subject.'),
  message: z.string().min(10, 'Tell us a little more (at least 10 characters).').max(5000),
  website: z.string().max(0),
});
export function Contact() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({ resolver: zodResolver(contactSchema), defaultValues: { website: '' } });
  const [mutate, { isLoading }] = useApiMutation();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { data: config } = useApiQuery({ url: '/config' });
  const info = config?.data || {};
  async function submit(body) {
    setError('');
    try {
      await mutate({ url: '/contact', method: 'POST', body }).unwrap();
      setSent(true);
      reset();
      toast.success('Your message has been sent');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="container section">
      <div className="page-heading">
        <p>We’re here for you</p>
        <h1>Let’s talk.</h1>
        <p>A question about your order, your next favourite piece, or just a hello.</p>
      </div>
      <div className="contact-layout">
        <form className="panel" noValidate onSubmit={handleSubmit(submit)}>
          {sent ? (
            <p className="success-message" role="status">
              Thank you. Your message is with our team.
            </p>
          ) : null}
          {['name', 'email', 'subject', 'message'].map((name) => (
            <div className="field" key={name}>
              <label htmlFor={`contact-${name}`}>
                {
                  {
                    name: 'Full name',
                    email: 'Email address',
                    subject: 'Subject',
                    message: 'Your message',
                  }[name]
                }
              </label>
              {name === 'message' ? (
                <textarea
                  id={`contact-${name}`}
                  rows={6}
                  {...register(name)}
                  aria-invalid={!!errors[name]}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                />
              ) : (
                <input
                  id={`contact-${name}`}
                  type={name === 'email' ? 'email' : 'text'}
                  {...register(name)}
                  aria-invalid={!!errors[name]}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                />
              )}
              <span className="field-error" id={`${name}-error`}>
                {errors[name]?.message}
              </span>
            </div>
          ))}
          <div className="honeypot" aria-hidden="true">
            <label>
              Leave this empty
              <input tabIndex={-1} autoComplete="off" {...register('website')} />
            </label>
          </div>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <button className="btn" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send message'}
          </button>
        </form>
        <aside className="contact-aside">
          <h2>A personal touch.</h2>
          <p>
            Need help choosing a size or checking an order? Leave your details and order number in
            the form. This demonstration store does not ship physical products.
          </p>
          {info.contactEmail ? (
            <a href={`mailto:${info.contactEmail}`}>{info.contactEmail}</a>
          ) : null}
          {info.contactPhone ? <a href={`tel:${info.contactPhone}`}>{info.contactPhone}</a> : null}
          <h3>A few things you might be wondering</h3>
          <details>
            <summary>Where do you deliver?</summary>
            <p>
              We deliver across configured Egyptian governorates. Enter your address at checkout to
              see fees and delivery estimates.
            </p>
          </details>
          <details>
            <summary>Can I pay on delivery?</summary>
            <p>
              Yes, cash on delivery is available. Online payment options appear only when the store
              enables a configured provider.
            </p>
          </details>
          <details>
            <summary>How can I track my order?</summary>
            <p>Sign in and open My orders to see the latest fulfillment status.</p>
          </details>
          <Link className="text-link" to="/policies/returns">
            Returns & exchanges
          </Link>
        </aside>
      </div>
    </div>
  );
}
export function Journal() {
  return (
    <div className="container section journal">
      <div className="page-heading">
        <p>The LUNA point of view</p>
        <h1>Room to be yourself.</h1>
      </div>
      <ProgressiveImage
        src="/images/luna-hero-960.webp"
        sizes="(max-width: 760px) 100vw, 80vw"
        alt="LUNA linen editorial"
        width="1440"
        height="900"
      />
      <div className="reading-column">
        <h2>Getting dressed, a little differently.</h2>
        <p>
          There’s a quiet confidence in finding pieces that feel like you. A shirt that works with
          everything. A dress that moves with your day. The layer you reach for without thinking.
        </p>
        <p>
          That’s the idea behind LUNA: a considered approach to everyday dressing, with easy
          silhouettes and thoughtful details.
        </p>
        <p>
          Explore our concept collection: linen-inspired layers, easy cotton essentials and softly
          tailored shapes. Product images are styling inspiration for this demonstration store,
          rather than photographs of goods available for dispatch.
        </p>
        <Link className="btn" to="/products">
          Find your everyday favourites
        </Link>
      </div>
    </div>
  );
}
export function Policy() {
  const { slug } = useParams();
  const sections = {
    shipping: [
      'Shipping & delivery',
      'Shipping availability and fees are calculated by governorate on the server at checkout. Standard and optional express delivery estimates are displayed with your quote. Free shipping is available above the configured threshold.',
    ],
    returns: [
      'Returns & exchanges',
      'This demonstration store does not dispatch goods or collect online payments, so no physical return is needed. You can cancel an eligible test order from My orders. For help, use the contact form and include your order number. Commercial returns and exchange terms will be published before real sales begin.',
    ],
    privacy: [
      'Privacy',
      'LUNA stores the account details, addresses, orders and messages you choose to submit. Use fictional delivery details when exploring this demo. Passwords and refresh tokens are hashed; card details are never requested or stored. Session cookies keep you signed in, and browser storage remembers your bag and wishlist. Our hosting, database, image and email providers process the information needed to operate these features. Use the contact form to request access, correction or deletion of your information. Do not submit sensitive personal information.',
    ],
    terms: [
      'Terms of service',
      'LUNA is a demonstration fashion storefront. Catalog prices are in Egyptian pounds and illustrate the shopping experience. Orders, stock levels, shipping estimates and online payment results are simulated; no goods are dispatched and no online money is collected. Cash on delivery is demonstrated as an order workflow only. Please use fictional delivery details. Do not enter card information. You may explore the collection, create an account and test the shopping flows without making a commercial purchase.',
    ],
    'size-guide': [
      'Size guide',
      'Check measurements on the product page and garment care information. The development size chart is illustrative and must be replaced with actual product measurements.',
    ],
  };
  const [title, copy] = sections[slug] || [
    'Page not found',
    'Explore the collection or contact us for help.',
  ];
  return (
    <div className="container section reading-column policy">
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link className="text-link" to="/contact">
        Contact the LUNA team
      </Link>
    </div>
  );
}
