import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, useLocation, Outlet } from 'react-router-dom';
import Layout from '../components/layout/Layout';
const Home = lazy(() => import('../pages/Home'));
const Products = lazy(() => import('../pages/Products'));
const ProductDetails = lazy(() => import('../pages/ProductDetails'));
const AdminPage = lazy(() => import('../pages/AdminPages'));
const account = (name) =>
  lazy(() => import('../pages/AccountPages').then((m) => ({ default: m[name] })));
const content = (name) =>
  lazy(() => import('../pages/ContentPages').then((m) => ({ default: m[name] })));
const AuthPage = account('AuthPage'),
  AccountPage = account('AccountPage'),
  CartPage = account('CartPage'),
  CheckoutPage = account('CheckoutPage'),
  OrdersPage = account('OrdersPage'),
  OrderPage = account('OrderPage'),
  PaymentPage = account('PaymentPage'),
  PaymentResultPage = account('PaymentResultPage'),
  WishlistPage = account('WishlistPage');
const Categories = content('Categories'),
  Contact = content('Contact'),
  Journal = content('Journal'),
  Policy = content('Policy');
function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.dataset.lunaRoute = pathname;
    const name =
      pathname === '/'
        ? 'Considered womenswear'
        : pathname
            .split('/')
            .filter(Boolean)
            .map((s) => s.replaceAll('-', ' '))
            .join(' · ');
    document.title = `${name.charAt(0).toUpperCase() + name.slice(1)} | LUNA`;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.append(link);
    }
    link.href = (import.meta.env.VITE_SITE_URL || window.location.origin) + pathname;
  }, [pathname]);
  return (
    <Suspense
      fallback={
        <div className="page-loader" role="status">
          A little LUNA, loading…
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: (
      <div className="empty-state">
        <h1>Something didn’t load.</h1>
        <a className="btn" href="/">
          Return to LUNA
        </a>
      </div>
    ),
    children: [
      {
        element: <PageMeta />,
        children: [
          { index: true, element: <Home /> },
          { path: 'products', element: <Products /> },
          { path: 'products/:slug', element: <ProductDetails /> },
          { path: 'categories', element: <Categories /> },
          { path: 'categories/:slug', element: <Products /> },
          ...['login', 'register', 'forgot-password', 'reset-password', 'verify-email'].map(
            (mode) => ({ path: mode, element: <AuthPage key={mode} mode={mode} /> }),
          ),
          { path: 'account', element: <AccountPage /> },
          { path: 'cart', element: <CartPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:orderId', element: <OrderPage /> },
          { path: 'payment/success', element: <PaymentResultPage success /> },
          { path: 'payment/failed', element: <PaymentResultPage success={false} /> },
          { path: 'payment/:orderId', element: <PaymentPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'contact', element: <Contact /> },
          { path: 'journal', element: <Journal /> },
          { path: 'policies/:slug', element: <Policy /> },
          { path: 'admin', element: <AdminPage /> },
          { path: 'admin/:section', element: <AdminPage /> },
          {
            path: '*',
            element: (
              <div className="empty-state">
                <h1>A little off track.</h1>
                <p>This page doesn’t exist.</p>
                <a className="btn" href="/products">
                  Explore the collection
                </a>
              </div>
            ),
          },
        ],
      },
    ],
  },
]);
