import ProgressiveImage from '../components/common/ProgressiveImage';
import { useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  LockKeyhole,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '../api/baseApi';
import { setCredentials, logout } from '../features/auth/authSlice';
import {
  updateQuantity,
  removeItem,
  clearCart,
  setCoupon,
  replaceCart,
} from '../features/cart/cartSlice';
import { toggleWishlist } from '../features/wishlist/wishlistSlice';
import { money, imageUrl, errorMessage } from '../lib/utils';
import Dialog from '../components/common/Dialog';

export function Field({ label, name, register, errors = {}, type = 'text', ...props }) {
  const [visible, setVisible] = useState(false);
  const secret = type === 'password';
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className={secret ? 'password-field' : undefined}>
        <input
          id={name}
          type={secret && visible ? 'text' : type}
          {...register(name)}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
          {...props}
        />
        {secret && (
          <button
            type="button"
            className="icon-button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {errors[name] && (
        <span className="field-error" id={`${name}-error`} role="alert">
          {errors[name].message}
        </span>
      )}
    </div>
  );
}

export function RemoteState({ query, children }) {
  if (query.isLoading)
    return (
      <div className="panel skeleton" role="status" aria-label="Loading">
        <p>Loading…</p>
      </div>
    );
  if (query.error)
    return (
      <div className="panel" role="alert">
        <h2>We couldn’t load this page</h2>
        <p>{errorMessage(query.error)}</p>
        <button className="btn btn-outline" onClick={query.refetch}>
          Try again
        </button>
      </div>
    );
  return children;
}

function RequireAccount({ children }) {
  const { user, initialized } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!initialized)
    return (
      <section className="container page-section" role="status">
        Restoring your session?
      </section>
    );
  return user ? (
    children
  ) : (
    <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  );
}

const passwordSchema = z.string().min(10, 'Use at least 10 characters.').max(128);
const authSchemas = {
  login: z.object({
    email: z.string().email('Enter a valid email.'),
    password: z.string().min(1, 'Enter your password.'),
  }),
  register: z.object({
    name: z.string().trim().min(2, 'Enter your full name.'),
    email: z.string().email('Enter a valid email.'),
    password: passwordSchema,
  }),
  'forgot-password': z.object({ email: z.string().email('Enter a valid email.') }),
  'reset-password': z.object({
    token: z.string().min(1, 'Open the reset link in your email.'),
    password: passwordSchema,
  }),
  'verify-email': z.object({
    token: z.string().min(1, 'Enter the verification token from your email.'),
  }),
};

export function AuthPage({ mode = 'login' }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mutate, request] = useApiMutation();
  const [message, setMessage] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(authSchemas[mode]),
    defaultValues: {
      token: new URLSearchParams(location.hash.slice(1)).get('token') || params.get('token') || '',
    },
  });
  const titles = {
    login: 'Welcome back',
    register: 'Make yourself at home',
    'forgot-password': 'A fresh start',
    'reset-password': 'Choose a new password',
    'verify-email': 'Verify your email',
  };
  async function submit(values) {
    try {
      const response = await mutate({
        url: `/auth/${mode}`,
        method: 'POST',
        body: values,
      }).unwrap();
      if (response.data?.accessToken) {
        dispatch(setCredentials(response.data));
        const next = params.get('next');
        navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/account');
        toast.success(mode === 'register' ? 'Your account is ready' : 'You’re signed in');
      } else
        setMessage(
          response.message ||
            response.data?.message ||
            (mode === 'forgot-password'
              ? 'If an account matches that email, a reset link will arrive shortly.'
              : 'Your request is complete. Check your email for the next step.'),
        );
    } catch (error) {
      setMessage('');
      toast.error(errorMessage(error));
    }
  }
  return (
    <section className="container auth-layout">
      <div className="auth-story">
        <p>LUNA, made for you</p>
        <h1>
          Good style.
          <br />
          Even better company.
        </h1>
        <p>Keep your favourites close, find your next everyday piece, and follow every order.</p>
        <Link to="/products" className="text-link">
          Explore the collection <ArrowRight size={16} />
        </Link>
      </div>
      <div className="panel auth-panel">
        <h2>{titles[mode]}</h2>
        <p>
          {mode === 'login' ? 'Sign in to your LUNA account.' : 'A little more you, every day.'}
        </p>
        <form noValidate onSubmit={handleSubmit(submit)} key={mode}>
          {mode === 'register' && (
            <Field
              label="Full name"
              name="name"
              register={register}
              errors={errors}
              autoComplete="name"
            />
          )}
          {['login', 'register', 'forgot-password'].includes(mode) && (
            <Field
              label="Email address"
              name="email"
              type="email"
              register={register}
              errors={errors}
              autoComplete="email"
            />
          )}
          {['reset-password', 'verify-email'].includes(mode) && (
            <Field
              label="Email token"
              name="token"
              register={register}
              errors={errors}
              autoComplete="off"
            />
          )}
          {['login', 'register', 'reset-password'].includes(mode) && (
            <Field
              label="Password"
              name="password"
              type="password"
              register={register}
              errors={errors}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          )}
          {mode === 'register' && (
            <p className="muted">
              Use at least 10 characters. You can paste from your password manager.
            </p>
          )}
          {mode === 'login' && (
            <Link to="/forgot-password" className="text-link">
              Forgot your password?
            </Link>
          )}
          <button className="btn full-width" disabled={request.isLoading}>
            {request.isLoading
              ? 'Please wait…'
              : {
                  login: 'Sign in',
                  register: 'Create account',
                  'forgot-password': 'Send reset link',
                  'reset-password': 'Save password',
                  'verify-email': 'Verify email',
                }[mode]}
          </button>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </form>
        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              New to LUNA? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
        </p>
      </div>
    </section>
  );
}

export function AccountPage() {
  return (
    <RequireAccount>
      <AccountContent />
    </RequireAccount>
  );
}
function AccountContent() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mutate, request] = useApiMutation();
  const query = useApiQuery({ url: '/auth/me' });
  const profile = query.data?.data || user;
  const [tab, setTab] = useState('profile');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().min(2),
        phone: z
          .string()
          .regex(/^(?:\+20|0)1[0125]\d{8}$/, 'Enter a valid Egyptian mobile number.')
          .or(z.literal('')),
      }),
    ),
    defaultValues: { name: user.name, phone: user.phone || '' },
  });
  useEffect(() => {
    reset({ name: profile.name, phone: profile.phone || '' });
  }, [profile.name, profile.phone, reset]);
  async function save(values) {
    try {
      await mutate({ url: '/users/me', method: 'PATCH', body: values }).unwrap();
      toast.success('Profile updated');
      query.refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function signOut() {
    try {
      await mutate({ url: '/auth/logout', method: 'POST' }).unwrap();
      dispatch(logout());
      navigate('/');
      toast.success('You’re signed out');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <section className="container page-section">
      <div className="page-heading">
        <p>Your LUNA</p>
        <h1>Hello, {user.name.split(' ')[0]}</h1>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account">
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
            My profile
          </button>
          <button
            className={tab === 'addresses' ? 'active' : ''}
            onClick={() => setTab('addresses')}
          >
            Saved addresses
          </button>
          <Link to="/orders">My orders</Link>
          <Link to="/wishlist">Wishlist</Link>
          <button className={tab === 'password' ? 'active' : ''} onClick={() => setTab('password')}>
            Password
          </button>
          {user.role === 'admin' && <Link to="/admin">Store administration</Link>}
          <button disabled={request.isLoading} onClick={signOut}>
            Sign out
          </button>
        </nav>
        <div>
          <RemoteState query={query}>
            {tab === 'profile' && (
              <div className="panel">
                <h2>Personal details</h2>
                <p>{profile.email}</p>
                {!profile.isEmailVerified && (
                  <p className="notice">
                    Verify your email using the link sent when you registered.{' '}
                    <Link to="/verify-email">Enter verification token</Link>
                  </p>
                )}
                <form noValidate onSubmit={handleSubmit(save)}>
                  <Field
                    label="Full name"
                    name="name"
                    register={register}
                    errors={errors}
                    autoComplete="name"
                  />
                  <Field
                    label="Mobile number"
                    name="phone"
                    register={register}
                    errors={errors}
                    autoComplete="tel"
                    type="tel"
                  />
                  <button className="btn" disabled={request.isLoading}>
                    Save changes
                  </button>
                </form>
              </div>
            )}
            {tab === 'password' && <PasswordForm />}
            {tab === 'addresses' && (
              <Addresses addresses={profile.addresses || []} onChange={query.refetch} />
            )}
          </RemoteState>
        </div>
      </div>
    </section>
  );
}

function PasswordForm() {
  const dispatch = useDispatch();
  const [mutate, request] = useApiMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
    ),
  });
  const [done, setDone] = useState(false);
  async function save(values) {
    try {
      await mutate({ url: '/users/me/password', method: 'PATCH', body: values }).unwrap();
      dispatch(logout());
      setDone(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="panel">
      <h2>Change password</h2>
      {done ? (
        <p role="status">
          Password changed. <Link to="/login">Sign in again</Link> with your new password.
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit(save)}>
          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            register={register}
            errors={errors}
            autoComplete="current-password"
          />
          <Field
            label="New password"
            name="newPassword"
            type="password"
            register={register}
            errors={errors}
            autoComplete="new-password"
          />
          <button className="btn" disabled={request.isLoading}>
            Change password
          </button>
        </form>
      )}
    </div>
  );
}

const addressSchema = z.object({
  governorate: z.string().min(1, 'Choose your governorate.'),
  city: z.string().min(2, 'Enter your city.'),
  street: z.string().min(3, 'Enter your street address.'),
  building: z.string().min(1, 'Enter your building number.'),
  apartment: z.string().optional(),
  postalCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});
function AddressFields({ register, errors, zones }) {
  return (
    <>
      <div className="field">
        <label htmlFor="governorate">Governorate</label>
        <select
          id="governorate"
          {...register('governorate')}
          aria-invalid={!!errors.governorate}
          aria-describedby={errors.governorate ? 'governorate-error' : undefined}
        >
          <option value="">Select governorate</option>
          {zones.map((zone) => (
            <option
              key={zone.name || zone.governorate || zone}
              value={zone.name || zone.governorate || zone}
            >
              {zone.name || zone.governorate || zone}
            </option>
          ))}
        </select>
        {errors.governorate && (
          <span id="governorate-error" role="alert" className="field-error">
            {errors.governorate.message}
          </span>
        )}
      </div>
      <Field
        label="City"
        name="city"
        register={register}
        errors={errors}
        autoComplete="address-level2"
      />
      <Field
        label="Street address"
        name="street"
        register={register}
        errors={errors}
        autoComplete="street-address"
      />
      <div className="form-grid">
        <Field label="Building" name="building" register={register} errors={errors} />
        <Field label="Apartment (optional)" name="apartment" register={register} errors={errors} />
      </div>
      <Field
        label="Postal code (optional)"
        name="postalCode"
        register={register}
        errors={errors}
        autoComplete="postal-code"
      />
      <Field label="Delivery notes (optional)" name="notes" register={register} errors={errors} />
    </>
  );
}
function shippingZones(query) {
  const data = query.data?.data;
  return Array.isArray(data) ? data : data?.zones || [];
}
function Addresses({ addresses, onChange }) {
  const [mutate, state] = useApiMutation();
  const shipping = useApiQuery({ url: '/shipping' });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(addressSchema) });
  async function save(values) {
    try {
      await mutate({ url: '/users/me/addresses', method: 'POST', body: values }).unwrap();
      reset();
      onChange();
      toast.success('Address saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function remove(id) {
    try {
      await mutate({ url: `/users/me/addresses/${id}`, method: 'DELETE' }).unwrap();
      onChange();
      toast.success('Address removed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="panel">
      <h2>Saved addresses</h2>
      {addresses.map((address) => (
        <div className="address-card" key={address._id}>
          <p>
            {address.street}, building {address.building}, {address.city}, {address.governorate}
          </p>
          <button
            className="text-link"
            disabled={state.isLoading}
            onClick={() => remove(address._id)}
          >
            Remove address
          </button>
        </div>
      ))}
      {!addresses.length && <p>No saved addresses yet. Add one for your next order.</p>}
      <h3>Add an address</h3>
      <form noValidate onSubmit={handleSubmit(save)}>
        <RemoteState query={shipping}>
          <AddressFields register={register} errors={errors} zones={shippingZones(shipping)} />
        </RemoteState>
        <button className="btn" disabled={state.isLoading || shipping.isError}>
          Save address
        </button>
      </form>
    </div>
  );
}

function CartLines({ items, editable = false }) {
  const dispatch = useDispatch();
  return (
    <div className="cart-lines">
      {items.map((item) => (
        <article className="cart-line" key={item.sku}>
          <Link to={item.slug ? `/products/${item.slug}` : '/products'}>
            <ProgressiveImage
              src={item.image || item.images?.[0]?.url || '/images/product-placeholder.svg'}
              alt={item.name}
              width="100"
              height="130"
            />
          </Link>
          <div>
            <Link to={item.slug ? `/products/${item.slug}` : '/products'}>
              <h3>{item.name}</h3>
            </Link>
            <p className="muted">
              {item.color} / {item.size}
            </p>
            <p>{money(item.unitPrice ?? item.price ?? 0)}</p>
            {editable ? (
              <div className="quantity-control">
                <button
                  aria-label={`Decrease quantity of ${item.name}`}
                  disabled={item.quantity <= 1}
                  onClick={() =>
                    dispatch(updateQuantity({ sku: item.sku, quantity: item.quantity - 1 }))
                  }
                >
                  <Minus size={14} />
                </button>
                <span aria-live="polite">{item.quantity}</span>
                <button
                  aria-label={`Increase quantity of ${item.name}`}
                  disabled={item.quantity >= (item.stock ?? 20)}
                  onClick={() =>
                    dispatch(updateQuantity({ sku: item.sku, quantity: item.quantity + 1 }))
                  }
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <p>Quantity {item.quantity}</p>
            )}
          </div>
          {editable && (
            <button
              className="icon-button remove-item"
              onClick={() => dispatch(removeItem(item.sku))}
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 size={18} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
function Totals({ quote }) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(quote.subtotal)}</dd>
      </div>
      <div>
        <dt>Discount</dt>
        <dd>−{money(quote.discount || 0)}</dd>
      </div>
      <div>
        <dt>Delivery</dt>
        <dd>{quote.shippingFee ? money(quote.shippingFee) : 'Complimentary'}</dd>
      </div>
      <div className="total">
        <dt>Total</dt>
        <dd>{money(quote.total)}</dd>
      </div>
    </dl>
  );
}

export function CartPage() {
  const cart = useSelector((s) => s.cart);
  const dispatch = useDispatch();
  const [coupon, setCouponInput] = useState(cart.couponCode || '');
  const [quote, quoteState] = useApiMutation();
  const [serverQuote, setServerQuote] = useState(null);
  const [failure, setFailure] = useState('');
  const body = JSON.stringify({
    items: cart.items.map(({ productId, sku, quantity }) => ({ productId, sku, quantity })),
    couponCode: cart.couponCode || undefined,
  });
  useEffect(() => {
    if (!cart.items.length) return;
    let alive = true;
    setServerQuote(null);
    quote({ url: '/cart/quote', method: 'POST', body: JSON.parse(body) })
      .unwrap()
      .then((r) => {
        if (alive) {
          setServerQuote(r.data);
          setFailure('');
        }
      })
      .catch((e) => {
        if (alive) setFailure(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [body, quote, cart.items.length]);
  return (
    <section className="container page-section">
      <div className="page-heading">
        <p>A little something for you</p>
        <h1>
          Your shopping bag{' '}
          <span className="muted">({cart.items.reduce((n, i) => n + i.quantity, 0)})</span>
        </h1>
      </div>
      {!cart.items.length ? (
        <div className="empty-state">
          <ShoppingBag size={40} />
          <h2>Your next favourite is waiting</h2>
          <p>Your bag is empty. Let’s find something you’ll love.</p>
          <Link className="btn" to="/products">
            Explore the collection
          </Link>
        </div>
      ) : (
        <div className="checkout-layout">
          <div>
            <CartLines items={serverQuote?.items || cart.items} editable />
            <Link className="text-link" to="/products">
              <ArrowLeft size={16} /> Continue shopping
            </Link>
          </div>
          <aside className="panel order-summary">
            <h2>Order summary</h2>
            {failure && (
              <p role="alert" className="field-error">
                {failure}
              </p>
            )}
            {serverQuote ? (
              <Totals quote={serverQuote} />
            ) : (
              <p role="status">
                {quoteState.isLoading
                  ? 'Checking current prices and availability…'
                  : 'Totals unavailable. Please resolve the message above.'}
              </p>
            )}
            <form
              noValidate
              className="coupon-form"
              onSubmit={(e) => {
                e.preventDefault();
                dispatch(setCoupon(coupon.trim()));
              }}
            >
              <label htmlFor="coupon">Have a promotion code?</label>
              <div>
                <input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Enter code"
                />
                <button className="btn btn-outline" disabled={quoteState.isLoading}>
                  Apply
                </button>
              </div>
            </form>
            {cart.couponCode && (
              <button
                className="text-link"
                onClick={() => {
                  dispatch(setCoupon(''));
                  setCouponInput('');
                }}
              >
                Remove {cart.couponCode}
              </button>
            )}
            {serverQuote && (
              <Link className="btn full-width" to="/checkout">
                Proceed to checkout <ArrowRight size={16} />
              </Link>
            )}
            <p className="muted">
              <LockKeyhole size={14} /> Prices and stock verified before you order.
            </p>
            <p className="muted">
              <Truck size={14} /> Final delivery fee based on your address.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

const checkoutSchema = addressSchema.extend({
  name: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email.'),
  phone: z.string().regex(/^(?:\+20|0)1[0125]\d{8}$/, 'Enter a valid Egyptian mobile number.'),
  shippingMethod: z.enum(['standard', 'express']),
  paymentMethod: z.enum(['cod', 'online']),
});
export function CheckoutPage() {
  return (
    <RequireAccount>
      <CheckoutContent />
    </RequireAccount>
  );
}
function CheckoutContent() {
  const user = useSelector((s) => s.auth.user);
  const cart = useSelector((s) => s.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const shipping = useApiQuery({ url: '/shipping' });
  const [mutate, state] = useApiMutation();
  const [quoteRequest, quoteState] = useApiMutation();
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [step, setStep] = useState(0);
  const idempotencyKey = useRef(crypto.randomUUID());
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      governorate: '',
      shippingMethod: 'standard',
      paymentMethod: 'cod',
    },
  });
  const governorate = watch('governorate');
  const shippingMethod = watch('shippingMethod');
  const quoteBody = JSON.stringify({
    items: cart.items.map(({ productId, sku, quantity }) => ({ productId, sku, quantity })),
    governorate,
    shippingMethod,
    couponCode: cart.couponCode || undefined,
  });
  useEffect(() => {
    if (!governorate || !cart.items.length) return;
    let alive = true;
    setQuote(null);
    quoteRequest({ url: '/cart/quote', method: 'POST', body: JSON.parse(quoteBody) })
      .unwrap()
      .then((r) => {
        if (alive) {
          setQuote(r.data);
          setQuoteError('');
        }
      })
      .catch((e) => {
        if (alive) setQuoteError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [quoteBody, governorate, quoteRequest, cart.items.length]);
  const config = shipping.data?.data || {};
  const onlineEnabled = config.onlinePaymentsEnabled || config.payment?.onlineEnabled;
  async function next(event) {
    event?.preventDefault();
    const fields = [
      ['name', 'email', 'phone'],
      ['governorate', 'city', 'street', 'building', 'apartment', 'postalCode', 'notes'],
      ['shippingMethod'],
      ['paymentMethod'],
    ][step];
    if (await trigger(fields, { shouldFocus: true })) setStep(step + 1);
  }
  async function submit(values) {
    if (step < 4) return next();
    if (!quote) return toast.error('Wait for your order total to be verified.');
    try {
      const {
        name,
        email,
        phone,
        paymentMethod,
        shippingMethod: method,
        ...shippingAddress
      } = values;
      const response = await mutate({
        url: '/orders',
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: {
          customer: { name, email, phone },
          shippingAddress,
          paymentMethod,
          shippingMethod: method,
          couponCode: cart.couponCode || undefined,
          items: cart.items.map(({ productId, sku, quantity }) => ({ productId, sku, quantity })),
        },
      }).unwrap();
      dispatch(clearCart());
      toast.success('Your order has been placed');
      navigate(
        paymentMethod === 'cod' ? `/orders/${response.data._id}` : `/payment/${response.data._id}`,
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  if (!cart.items.length)
    return (
      <section className="container empty-state">
        <ShoppingBag size={40} />
        <h1>Your bag is empty</h1>
        <Link className="btn" to="/products">
          Find your next favourite
        </Link>
      </section>
    );
  return (
    <section className="container page-section">
      <div className="page-heading">
        <p>Almost yours</p>
        <h1>Checkout</h1>
      </div>
      <ol className="checkout-steps" aria-label="Checkout progress">
        {['Your details', 'Delivery address', 'Shipping', 'Payment', 'Review'].map((label, i) => (
          <li key={label} aria-current={step === i ? 'step' : undefined}>
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="checkout-layout">
        <form className="panel" noValidate onSubmit={handleSubmit(submit)}>
          {step === 0 && (
            <>
              <h2>Your details</h2>
              <Field
                label="Full name"
                name="name"
                register={register}
                errors={errors}
                autoComplete="name"
              />
              <Field
                label="Email"
                name="email"
                type="email"
                register={register}
                errors={errors}
                autoComplete="email"
              />
              <Field
                label="Egyptian mobile number"
                name="phone"
                type="tel"
                register={register}
                errors={errors}
                autoComplete="tel"
                placeholder="01012345678"
              />
            </>
          )}
          {step === 1 && (
            <>
              <h2>Where shall we send it?</h2>
              {user.addresses?.length > 0 && (
                <div className="field">
                  <label htmlFor="saved-address">Use a saved address</label>
                  <select
                    id="saved-address"
                    defaultValue=""
                    onChange={(e) => {
                      const address = user.addresses.find((a) => a._id === e.target.value);
                      if (address)
                        Object.keys(addressSchema.shape).forEach((key) =>
                          setValue(key, address[key] || '', { shouldValidate: true }),
                        );
                    }}
                  >
                    <option value="">Enter a new address</option>
                    {user.addresses.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.street}, {a.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <RemoteState query={shipping}>
                <AddressFields
                  register={register}
                  errors={errors}
                  zones={shippingZones(shipping)}
                />
              </RemoteState>
            </>
          )}
          {step === 2 && (
            <>
              <h2>A delivery that suits you</h2>
              <label className="choice">
                <input type="radio" value="standard" {...register('shippingMethod')} />
                <span>
                  <strong>Standard delivery</strong>
                  <small>
                    {config.estimatedDelivery ||
                      'Delivery estimate shown in your order confirmation'}
                  </small>
                </span>
              </label>
              {config.expressEnabled && (
                <label className="choice">
                  <input type="radio" value="express" {...register('shippingMethod')} />
                  <span>
                    <strong>Express delivery</strong>
                    <small>Available in selected areas</small>
                  </span>
                </label>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h2>How would you like to pay?</h2>
              <label className="choice">
                <input type="radio" value="cod" {...register('paymentMethod')} />
                <span>
                  <strong>Cash on delivery</strong>
                  <small>Pay when your order arrives</small>
                </span>
              </label>
              <label className={`choice ${!onlineEnabled ? 'disabled' : ''}`}>
                <input
                  type="radio"
                  value="online"
                  disabled={!onlineEnabled}
                  {...register('paymentMethod')}
                />
                <span>
                  <strong>Online payment</strong>
                  <small>
                    {onlineEnabled
                      ? 'Test payment only. No money will be charged.'
                      : 'Currently unavailable. Please choose cash on delivery.'}
                  </small>
                </span>
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <h2>One last look</h2>
              <p>
                {watch('name')}
                <br />
                {watch('email')}
                <br />
                {watch('phone')}
              </p>
              <p>
                {watch('street')}, building {watch('building')}
                <br />
                {watch('city')}, {governorate}
              </p>
              <p>
                {shippingMethod === 'standard' ? 'Standard delivery' : 'Express delivery'} ·{' '}
                {watch('paymentMethod') === 'cod' ? 'Cash on delivery' : 'Online payment'}
              </p>
              <p className="muted">
                Your order reserves these pieces. Final prices and inventory are checked securely
                when you place your order.
              </p>
            </>
          )}
          {quoteError && (
            <p role="alert" className="field-error">
              {quoteError}
            </p>
          )}
          <div className="form-actions">
            {step > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(step - 1)}
                disabled={state.isLoading}
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button key={`continue-${step}`} type="button" className="btn" onClick={next}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                key="place-order"
                type="submit"
                className="btn"
                disabled={state.isLoading || !quote || quoteState.isLoading}
              >
                {state.isLoading ? 'Placing your order…' : 'Place order'}
              </button>
            )}
          </div>
        </form>
        <aside className="panel order-summary">
          <h2>In your bag</h2>
          <CartLines items={quote?.items || cart.items} />
          {quote ? (
            <Totals quote={quote} />
          ) : (
            <p role="status">
              {governorate
                ? 'Verifying your total…'
                : 'Choose your delivery address to see the final total.'}
            </p>
          )}
          <p className="muted">
            <LockKeyhole size={14} /> Secure checkout. No card details stored.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function OrdersPage() {
  return (
    <RequireAccount>
      <OrdersContent />
    </RequireAccount>
  );
}
function OrdersContent() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = useApiQuery({ url: '/orders', params: { page, limit: 10 } });
  const orders = query.data?.data || [];
  return (
    <section className="container page-section">
      <div className="page-heading">
        <p>Your wardrobe, on its way</p>
        <h1>My orders</h1>
      </div>
      <RemoteState query={query}>
        {!orders.length ? (
          <div className="empty-state">
            <ShoppingBag size={36} />
            <h2>Your story starts here</h2>
            <p>You haven’t placed an order yet.</p>
            <Link className="btn" to="/products">
              Shop the collection
            </Link>
          </div>
        ) : (
          <>
            <div className="orders-list">
              {orders.map((order) => (
                <article className="panel order-card" key={order._id}>
                  <div>
                    <h2>{order.orderNumber}</h2>
                    <p>
                      {new Date(order.createdAt).toLocaleDateString('en-EG', {
                        dateStyle: 'medium',
                        timeZone: 'Africa/Cairo',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="badge">{order.fulfillmentStatus}</span>
                    <p>Payment: {order.paymentStatus}</p>
                  </div>
                  <div>
                    <strong>{money(order.total)}</strong>
                    <p>
                      {order.items?.length} piece{order.items?.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Link className="btn btn-outline" to={`/orders/${order._id}`}>
                    View order
                  </Link>
                </article>
              ))}
            </div>
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setParams({ page: page - 1 })}>
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={page >= (query.data?.meta?.pages || query.data?.meta?.totalPages || 1)}
                onClick={() => setParams({ page: page + 1 })}
              >
                Next
              </button>
            </div>
          </>
        )}
      </RemoteState>
    </section>
  );
}
export function OrderPage() {
  return (
    <RequireAccount>
      <OrderContent />
    </RequireAccount>
  );
}
function OrderContent() {
  const { orderId } = useParams();
  const query = useApiQuery({ url: `/orders/${orderId}` });
  const [mutate, state] = useApiMutation();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const order = query.data?.data;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  async function cancel() {
    try {
      await mutate({ url: `/orders/${orderId}/cancel`, method: 'POST' }).unwrap();
      setConfirmCancel(false);
      query.refetch();
      toast.success('Order canceled');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function reorder() {
    try {
      const response = await mutate({ url: `/orders/${orderId}/reorder`, method: 'POST' }).unwrap();
      dispatch(
        replaceCart({
          items: (response.data.items || []).map((item) => ({
            ...item,
            price: item.unitPrice ?? item.price,
          })),
          couponCode: response.data.couponCode || '',
        }),
      );
      navigate('/cart');
      toast.success('Available items added to your bag');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <section className="container page-section">
      <Link to="/orders" className="text-link">
        <ArrowLeft size={16} /> My orders
      </Link>
      <RemoteState query={query}>
        {order && (
          <>
            <div className="page-heading">
              <p>Thank you for choosing LUNA</p>
              <h1>Order {order.orderNumber}</h1>
              <p>
                {new Date(order.createdAt).toLocaleDateString('en-EG', {
                  dateStyle: 'long',
                  timeZone: 'Africa/Cairo',
                })}
              </p>
            </div>
            <div className="checkout-layout">
              <div className="panel">
                <div className="order-status">
                  <span className="badge">{order.fulfillmentStatus}</span>
                  <span>Payment: {order.paymentStatus}</span>
                </div>
                <CartLines items={order.items || []} />
                <div className="form-actions">
                  <button className="btn btn-outline" onClick={reorder} disabled={state.isLoading}>
                    Shop these pieces again
                  </button>
                  {['pending', 'confirmed'].includes(order.fulfillmentStatus?.toLowerCase()) &&
                    order.paymentStatus !== 'paid' && (
                      <button className="text-link" onClick={() => setConfirmCancel(true)}>
                        Cancel order
                      </button>
                    )}
                  {order.paymentMethod === 'online' && order.paymentStatus === 'pending' && (
                    <Link className="btn" to={`/payment/${orderId}`}>
                      Continue payment
                    </Link>
                  )}
                </div>
                {confirmCancel && (
                  <Dialog open onClose={() => setConfirmCancel(false)} title="Cancel this order?">
                    <p>Your reserved items will be released. This cannot be undone.</p>
                    <button className="btn btn-outline" onClick={() => setConfirmCancel(false)}>
                      Keep order
                    </button>
                    <button className="btn" disabled={state.isLoading} onClick={cancel}>
                      Cancel order
                    </button>
                  </Dialog>
                )}
              </div>
              <aside className="panel">
                <h2>Order total</h2>
                <Totals quote={order} />
                <h3>Delivery address</h3>
                <p>
                  {order.customerSnapshot?.name}
                  <br />
                  {order.shippingAddressSnapshot?.street}, {order.shippingAddressSnapshot?.building}
                  <br />
                  {order.shippingAddressSnapshot?.city},{' '}
                  {order.shippingAddressSnapshot?.governorate}
                </p>
                <p>{order.customerSnapshot?.phone}</p>
                <p>{order.shippingMethod} delivery</p>
              </aside>
            </div>
          </>
        )}
      </RemoteState>
    </section>
  );
}

export function PaymentPage() {
  return (
    <RequireAccount>
      <PaymentContent />
    </RequireAccount>
  );
}
function PaymentContent() {
  const { orderId } = useParams();
  const [mutate, state] = useApiMutation();
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  async function start() {
    try {
      const result = await mutate({
        url: '/payments/create-session',
        method: 'POST',
        body: { orderId },
      }).unwrap();
      setSession(result.data);
      const url = result.data.redirectUrl || result.data.url;
      if (url) {
        const target = new URL(url, window.location.origin);
        if (
          target.protocol === 'https:' ||
          (import.meta.env.DEV && target.origin === window.location.origin)
        )
          window.location.assign(target.href);
        else toast.error('The payment provider returned an invalid URL.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function mock(outcome) {
    try {
      await mutate({
        url: '/payments/mock-confirm',
        method: 'POST',
        body: { orderId, outcome },
      }).unwrap();
      navigate(`/payment/${outcome === 'paid' ? 'success' : 'failed'}?orderId=${orderId}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <section className="container page-section">
      <div className="panel payment-panel">
        <LockKeyhole size={32} />
        <h1>Complete your payment</h1>
        <p>
          Your payment is handled by the configured payment provider. LUNA never stores card
          details.
        </p>
        <button className="btn" onClick={start} disabled={state.isLoading}>
          Continue to secure payment
        </button>
        {(session?.provider === 'mock' || session?.developmentOnly) && (
          <div className="notice">
            <h2>Test payment simulator</h2>
            <p>No money will be charged. This is a demonstration payment only.</p>
            <button className="btn" disabled={state.isLoading} onClick={() => mock('paid')}>
              Simulate successful payment
            </button>
            <button
              className="btn btn-outline"
              disabled={state.isLoading}
              onClick={() => mock('failed')}
            >
              Simulate failed payment
            </button>
          </div>
        )}
        <Link to={`/orders/${orderId}`} className="text-link">
          Back to order
        </Link>
      </div>
    </section>
  );
}
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const query = useApiQuery(
    { url: `/payments/${orderId}/status` },
    { skip: !orderId, pollingInterval: 5000 },
  );
  const result = query.data?.data;
  const status = result?.status || result?.paymentStatus;
  return (
    <section className="container empty-state">
      <LockKeyhole size={36} />
      <h1>{status === 'paid' ? 'Payment confirmed' : 'Payment status'}</h1>
      {orderId ? (
        <RemoteState query={query}>
          <p>
            {status === 'paid'
              ? 'Your payment has been verified by our server. We’ll take it from here.'
              : `Your payment is ${status || 'awaiting verification'}. A redirect alone does not confirm payment.`}
          </p>
          <Link className="btn" to={`/orders/${orderId}`}>
            View order
          </Link>
        </RemoteState>
      ) : (
        <>
          <p>Open your order to see its verified payment status.</p>
          <Link className="btn" to="/orders">
            My orders
          </Link>
        </>
      )}
    </section>
  );
}

export function WishlistPage() {
  const items = useSelector((s) => s.wishlist.items);
  const user = useSelector((s) => s.auth.user);
  const [mutate, state] = useApiMutation();
  const dispatch = useDispatch();
  async function remove(product) {
    try {
      if (user) await mutate({ url: `/wishlist/items/${product._id}`, method: 'DELETE' }).unwrap();
      dispatch(toggleWishlist(product));
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <section className="container page-section">
      <div className="page-heading">
        <p>Keep them close</p>
        <h1>Your wishlist</h1>
      </div>
      {!items.length ? (
        <div className="empty-state">
          <Heart size={40} />
          <h2>A space for your favourites</h2>
          <p>Tap the heart on a piece you love. It’ll be waiting here.</p>
          <Link className="btn" to="/products">
            Find something to love
          </Link>
        </div>
      ) : (
        <div className="product-grid">
          {items.map((product) => (
            <article className="product-card" key={product._id}>
              <Link to={`/products/${product.slug}`}>
                <ProgressiveImage src={imageUrl(product)} alt={product.name} loading="lazy" />
                <h2>{product.name}</h2>
                <p>{money(product.basePrice)}</p>
              </Link>
              <p className="muted">
                {product.variants?.some((v) => v.stock > 0)
                  ? 'Available in selected sizes'
                  : 'Currently unavailable'}
              </p>
              <div className="form-actions">
                <Link className="btn btn-outline" to={`/products/${product.slug}`}>
                  Choose your size
                </Link>
                <button
                  className="icon-button"
                  disabled={state.isLoading}
                  onClick={() => remove(product)}
                  aria-label={`Remove ${product.name} from wishlist`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
