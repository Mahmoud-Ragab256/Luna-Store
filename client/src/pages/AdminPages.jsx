import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Search, Upload, X } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../api/baseApi';
import { money, errorMessage } from '../lib/utils';
import Dialog from '../components/common/Dialog';
import { RemoteState } from './AccountPages';

const sections = [
  'overview',
  'products',
  'categories',
  'orders',
  'customers',
  'coupons',
  'messages',
];
const emptyProduct = {
  name: '',
  slug: '',
  description: '',
  categoryId: '',
  basePrice: '',
  discount: 0,
  images: [],
  variants: [{ sku: '', size: 'S', color: 'Ivory', stock: 10 }],
  tags: '',
  isFeatured: false,
  isActive: true,
};
const emptyCategory = {
  name: '',
  slug: '',
  description: '',
  image: '',
  displayOrder: 0,
  isActive: true,
};
const emptyCoupon = {
  code: '',
  type: 'percentage',
  value: 10,
  minimumOrderAmount: 0,
  maximumDiscount: 0,
  usageLimit: 100,
  expiresAt: '',
  isActive: true,
};
function identifier(value) {
  return value?._id || value?.id || value;
}
function AdminField({ label, value, onChange, type = 'text', ...props }) {
  const id = `admin-${props.name || label.toLowerCase().replace(/[^a-z]/g, '-')}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value ?? ''}
        type={type}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        {...props}
      />
    </div>
  );
}
function AdminSelect({ label, value, onChange, options, ...props }) {
  const id = `admin-${label.toLowerCase().replace(/[^a-z]/g, '-')}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} {...props}>
        {options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminPage() {
  const { user, initialized } = useSelector((s) => s.auth);
  const { section = 'overview' } = useParams();
  if (!initialized)
    return (
      <section className="container page-section" role="status">
        Restoring your session?
      </section>
    );
  if (!user) return <Navigate to="/login?next=%2Fadmin" replace />;
  if (user.role !== 'admin')
    return (
      <section className="container empty-state">
        <h1>This area is for store administrators</h1>
        <Link className="btn" to="/account">
          Back to my account
        </Link>
      </section>
    );
  return (
    <section className="container page-section admin-page">
      <div className="page-heading">
        <p>LUNA studio</p>
        <h1>Store administration</h1>
        <Link className="text-link" to="/">
          <ArrowLeft size={15} /> Back to storefront
        </Link>
      </div>
      <nav className="admin-nav" aria-label="Administration">
        {sections.map((item) => (
          <Link
            key={item}
            aria-current={section === item ? 'page' : undefined}
            to={item === 'overview' ? '/admin' : `/admin/${item}`}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>
      {section === 'overview' ? (
        <Overview />
      ) : sections.includes(section) ? (
        <ResourceList key={section} resource={section} />
      ) : (
        <div className="empty-state">
          <h2>Page not found</h2>
          <Link to="/admin">Return to administration</Link>
        </div>
      )}
    </section>
  );
}

function Overview() {
  const query = useApiQuery({ url: '/admin/analytics' });
  const data = query.data?.data || {};
  const stats = [
    ['Revenue', money(data.totalRevenue ?? data.revenue ?? 0)],
    ['Orders', data.totalOrders ?? data.orders ?? 0],
    ['Customers', data.totalCustomers ?? data.customers ?? 0],
    ['Products', data.totalProducts ?? data.products ?? 0],
    ['Pending orders', data.pendingOrders ?? 0],
    [
      'Low-stock products',
      Array.isArray(data.lowStockProducts)
        ? data.lowStockProducts.length
        : (data.lowStockProducts ?? 0),
    ],
  ];
  const sales = data.salesChart || data.sales || data.dailySales || [];
  const max = Math.max(...sales.map((point) => point.revenue || point.total || 0), 1);
  return (
    <RemoteState query={query}>
      <div className="admin-stats">
        {stats.map(([label, value]) => (
          <article className="panel" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="panel">
        <h2>Sales overview</h2>
        {sales.length ? (
          <div
            className="sales-chart"
            role="img"
            aria-label={`Daily revenue: ${sales.map((p) => `${p.date || p._id}: ${money(p.revenue || p.total || 0)}`).join('; ')}`}
          >
            {sales.map((point, i) => (
              <div key={point.date || point._id || i} className="sales-column">
                <span
                  style={{
                    height: `${Math.max(3, ((point.revenue || point.total || 0) / max) * 140)}px`,
                  }}
                  title={money(point.revenue || point.total || 0)}
                />
                <small>{String(point.date || point._id || '').slice(-5)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Your sales chart will appear after your first paid orders.</p>
        )}
      </div>
      <div className="panel">
        <h2>Recent orders</h2>
        {data.recentOrders?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link to="/admin/orders">{order.orderNumber}</Link>
                    </td>
                    <td>{money(order.total)}</td>
                    <td>{order.paymentStatus}</td>
                    <td>{order.fulfillmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No orders yet.</p>
        )}
      </div>
    </RemoteState>
  );
}

function ResourceList({ resource }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const query = useApiQuery({
    url: `/admin/${resource}`,
    params: {
      page,
      limit: 15,
      search: searchParams.get('q') || '',
      status: searchParams.get('status') || '',
    },
  });
  const [mutate, state] = useApiMutation();
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [customerStatus, setCustomerStatus] = useState(null);
  const [failure, setFailure] = useState('');
  const rows = query.data?.data || [];
  const canCreate = ['products', 'categories', 'coupons'].includes(resource);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('q') || '')) {
        const next = new URLSearchParams(searchParams);
        search ? next.set('q', search) : next.delete('q');
        next.delete('page');
        setSearchParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, setSearchParams]);
  async function update(item, body) {
    try {
      await mutate({ url: `/admin/${resource}/${item._id}`, method: 'PATCH', body }).unwrap();
      toast.success('Changes saved');
      query.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function archive() {
    try {
      await mutate({ url: `/admin/${resource}/${archiving._id}`, method: 'DELETE' }).unwrap();
      toast.success('Archived');
      setArchiving(null);
      query.refetch();
    } catch (e) {
      setFailure(errorMessage(e));
    }
  }
  const meta = query.data?.meta || {};
  return (
    <>
      <div className="admin-toolbar">
        <h2>{resource[0].toUpperCase() + resource.slice(1)}</h2>
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            const next = new URLSearchParams(searchParams);
            next.set('q', search);
            next.delete('page');
            setSearchParams(next);
          }}
        >
          <label className="sr-only" htmlFor="admin-search">
            Search {resource}
          </label>
          <Search size={17} />
          <input
            id="admin-search"
            value={search}
            placeholder={`Search ${resource}`}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch('');
                const next = new URLSearchParams(searchParams);
                next.delete('q');
                next.delete('page');
                setSearchParams(next);
                document.getElementById('admin-search')?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </form>
        {resource === 'orders' && (
          <AdminSelect
            label="Order status"
            value={searchParams.get('status') || ''}
            onChange={(status) => {
              const next = new URLSearchParams(searchParams);
              status ? next.set('status', status) : next.delete('status');
              next.delete('page');
              setSearchParams(next);
            }}
            options={[
              { value: '', label: 'All statuses' },
              'pending',
              'confirmed',
              'processing',
              'shipped',
              'delivered',
              'canceled',
              'returned',
            ]}
          />
        )}
        {canCreate && (
          <button className="btn" onClick={() => setEditing({})}>
            <Plus size={17} /> Add {resource === 'categories' ? 'category' : resource.slice(0, -1)}
          </button>
        )}
      </div>
      <RemoteState query={query}>
        {!rows.length ? (
          <div className="panel empty-state">
            <h3>
              {search || searchParams.get('status') ? 'No matching results' : `No ${resource} yet`}
            </h3>
            <p>
              {search
                ? 'Try a different search or clear your filters.'
                : 'Records will appear here as your store grows.'}
            </p>
          </div>
        ) : (
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {resource === 'orders' ? 'Order' : resource === 'coupons' ? 'Code' : 'Name'}
                  </th>
                  <th>
                    {resource === 'products'
                      ? 'Price / Stock'
                      : resource === 'orders'
                        ? 'Total / Payment'
                        : resource === 'customers'
                          ? 'Email'
                          : resource === 'messages'
                            ? 'Subject'
                            : 'Details'}
                  </th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <span>
                        {item.name || item.orderNumber || item.code || item.customerSnapshot?.name}
                      </span>
                      <small>
                        {item.email ||
                          item.slug ||
                          (item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString('en-EG')
                            : '')}
                      </small>
                    </td>
                    <td>
                      {resource === 'products' ? (
                        <>
                          {money(item.basePrice)}
                          <small>{item.variants?.reduce((n, v) => n + v.stock, 0)} in stock</small>
                        </>
                      ) : resource === 'orders' ? (
                        <>
                          {money(item.total)}
                          <small>{item.paymentStatus}</small>
                        </>
                      ) : resource === 'customers' ? (
                        item.email
                      ) : resource === 'messages' ? (
                        item.subject
                      ) : resource === 'coupons' ? (
                        `${item.type === 'percentage' ? `${item.value}%` : money(item.value)} · ${item.usageCount || 0}/${item.usageLimit || 'Unlimited'}`
                      ) : (
                        item.description
                      )}
                    </td>
                    <td>
                      {resource === 'orders' ? (
                        <span className="badge">{item.fulfillmentStatus}</span>
                      ) : resource === 'messages' ? (
                        item.status
                      ) : item.isActive === false ? (
                        'Inactive'
                      ) : (
                        'Active'
                      )}
                    </td>
                    <td>
                      {canCreate && (
                        <div className="table-actions">
                          <button className="text-link" onClick={() => setEditing(item)}>
                            Edit
                          </button>
                          {resource !== 'coupons' && item.isActive !== false && (
                            <button
                              className="text-link"
                              onClick={() => {
                                setFailure('');
                                setArchiving(item);
                              }}
                            >
                              Archive
                            </button>
                          )}
                          {resource === 'coupons' && (
                            <button
                              className="text-link"
                              disabled={state.isLoading}
                              onClick={() => update(item, { isActive: !item.isActive })}
                            >
                              {item.isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </div>
                      )}
                      {resource === 'customers' && (
                        <>
                          <button
                            className="text-link"
                            disabled={state.isLoading}
                            onClick={() => setEditing(item)}
                          >
                            View customer
                          </button>
                          <button
                            className="text-link"
                            disabled={state.isLoading || item.role === 'admin'}
                            onClick={() => setCustomerStatus(item)}
                          >
                            {item.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                      {resource === 'orders' && (
                        <button className="text-link" onClick={() => setEditing(item)}>
                          View / update
                        </button>
                      )}
                      {resource === 'messages' && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setEditing(item);
                            if (item.status === 'new') update(item, { status: 'read' });
                          }}
                        >
                          Read message
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('page', page - 1);
              setSearchParams(next);
            }}
          >
            Previous
          </button>
          <span>
            Page {page}
            {meta.total ? ` · ${meta.total} results` : ''}
          </span>
          <button
            disabled={
              page >=
              (meta.pages ||
                meta.totalPages ||
                Math.ceil((meta.total || 0) / (meta.limit || 15)) ||
                1)
            }
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('page', page + 1);
              setSearchParams(next);
            }}
          >
            Next
          </button>
        </div>
      </RemoteState>
      {editing && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={
            canCreate
              ? `${editing._id ? 'Edit' : 'Add'} ${resource === 'categories' ? 'category' : resource.slice(0, -1)}`
              : resource === 'orders'
                ? `Order ${editing.orderNumber}`
                : resource === 'customers'
                  ? editing.name
                  : editing.subject
          }
        >
          {canCreate ? (
            <ResourceForm
              resource={resource}
              item={editing}
              onDone={() => {
                setEditing(null);
                query.refetch();
              }}
            />
          ) : resource === 'orders' ? (
            <OrderEditor
              item={editing}
              onDone={() => {
                setEditing(null);
                query.refetch();
              }}
            />
          ) : resource === 'customers' ? (
            <CustomerDetail item={editing} />
          ) : (
            <MessageDetail
              item={editing}
              onDone={() => {
                setEditing(null);
                query.refetch();
              }}
            />
          )}
        </Dialog>
      )}
      {customerStatus && (
        <Dialog
          open
          onClose={() => setCustomerStatus(null)}
          title={`${customerStatus.isActive ? 'Deactivate' : 'Activate'} ${customerStatus.name}?`}
        >
          <p>
            {customerStatus.isActive
              ? 'This customer will no longer be able to sign in. Their order history will be preserved.'
              : 'This customer will be able to sign in again.'}
          </p>
          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setCustomerStatus(null)}>
              Keep current status
            </button>
            <button
              className="btn"
              disabled={state.isLoading}
              onClick={async () => {
                await update(customerStatus, { isActive: !customerStatus.isActive });
                setCustomerStatus(null);
              }}
            >
              Update account status
            </button>
          </div>
        </Dialog>
      )}
      {archiving && (
        <Dialog open onClose={() => setArchiving(null)} title={`Archive ${archiving.name}?`}>
          <p>
            This item will be hidden from the storefront. Existing order records will be preserved.
          </p>
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setArchiving(null)}>
              Keep item
            </button>
            <button className="btn" disabled={state.isLoading} onClick={archive}>
              Archive item
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function ResourceForm({ resource, item, onDone }) {
  const base =
    resource === 'products'
      ? emptyProduct
      : resource === 'categories'
        ? emptyCategory
        : emptyCoupon;
  const [values, setValues] = useState({
    ...base,
    ...item,
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
    categoryId: identifier(item.categoryId) || '',
    expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '',
  });
  const categories = useApiQuery(
    { url: '/admin/categories', params: { limit: 100 } },
    { skip: resource !== 'products' },
  );
  const [mutate, state] = useApiMutation();
  const [failure, setFailure] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const field = (label, key, type = 'text', props = {}) => (
    <AdminField
      key={key}
      label={label}
      value={values[key]}
      onChange={(value) => set(key, value)}
      type={type}
      {...props}
    />
  );
  async function upload(files) {
    if (!files.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      for (const file of files) body.append('images', file);
      const response = await mutate({ url: '/admin/uploads', method: 'POST', body }).unwrap();
      const images = Array.isArray(response.data) ? response.data : response.data.images;
      if (resource === 'products') set('images', [...values.images, ...images]);
      else set('image', images[0]?.url || images[0]);
      toast.success('Images uploaded');
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    setFailure('');
    try {
      let body;
      if (resource === 'products') {
        if (
          !values.name.trim() ||
          !values.slug.trim() ||
          !values.description.trim() ||
          !values.categoryId ||
          Number(values.basePrice) <= 0 ||
          !values.variants.length ||
          !values.images.length
        )
          throw new Error(
            'Complete the name, slug, description, category, price, images and at least one variant.',
          );
        if (values.variants.some((v) => !v.sku || !v.size || !v.color || v.stock < 0))
          throw new Error('Each variant needs a unique SKU, size, color and non-negative stock.');
        if (new Set(values.variants.map((v) => v.sku)).size !== values.variants.length)
          throw new Error('Variant SKUs must be unique.');
        body = {
          name: values.name,
          slug: values.slug,
          description: values.description,
          categoryId: values.categoryId,
          basePrice: Number(values.basePrice),
          discount: Number(values.discount),
          images: values.images.map((image) => image.url || image),
          variants: values.variants.map(({ sku, size, color, stock, priceOverride }) => ({
            sku,
            size,
            color,
            stock: Number(stock),
            ...(priceOverride === '' || priceOverride == null
              ? {}
              : { priceOverride: Number(priceOverride) }),
          })),
          tags: values.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isFeatured: values.isFeatured,
          isActive: values.isActive,
        };
      } else if (resource === 'categories') {
        if (!values.name || !values.slug) throw new Error('Enter a category name and slug.');
        body = {
          name: values.name,
          slug: values.slug,
          description: values.description,
          image: values.image || undefined,
          displayOrder: Number(values.displayOrder),
          isActive: values.isActive,
        };
      } else {
        if (!values.code || Number(values.value) <= 0)
          throw new Error('Enter a coupon code and a positive discount.');
        body = {
          code: values.code.toUpperCase(),
          type: values.type,
          value: Number(values.value),
          minimumOrderAmount: Number(values.minimumOrderAmount),
          maximumDiscount: Number(values.maximumDiscount) || null,
          usageLimit: Number(values.usageLimit) || null,
          expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
          isActive: values.isActive,
        };
      }
      await mutate({
        url: `/admin/${resource}${item._id ? `/${item._id}` : ''}`,
        method: item._id ? 'PATCH' : 'POST',
        body,
      }).unwrap();
      toast.success(item._id ? 'Changes saved' : 'Created successfully');
      onDone();
    } catch (e) {
      setFailure(e.message || errorMessage(e));
    }
  }
  function variant(index, key, value) {
    set(
      'variants',
      values.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    );
  }
  return (
    <form noValidate onSubmit={save} className="admin-resource-form">
      {resource !== 'coupons' ? (
        <>
          {field('Name', 'name')}
          {field('URL slug', 'slug')}
          <div className="field">
            <label htmlFor="admin-description">Description</label>
            <textarea
              id="admin-description"
              value={values.description}
              rows={4}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          {field('Coupon code', 'code')}
          <AdminSelect
            label="Discount type"
            value={values.type}
            onChange={(v) => set('type', v)}
            options={['percentage', 'fixed']}
          />
          {field('Discount value', 'value', 'number', { min: 0 })}
          {field('Minimum order amount (EGP)', 'minimumOrderAmount', 'number', { min: 0 })}
          {field('Maximum discount (EGP, 0 for none)', 'maximumDiscount', 'number', { min: 0 })}
          {field('Usage limit (0 for unlimited)', 'usageLimit', 'number', { min: 0 })}
          {field('Expiry (local time)', 'expiresAt', 'datetime-local')}
        </>
      )}
      {resource === 'products' && (
        <>
          <AdminSelect
            label="Category"
            value={values.categoryId}
            onChange={(v) => set('categoryId', v)}
            options={[
              { value: '', label: 'Choose category' },
              ...(categories.data?.data || []).map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
          <div className="form-grid">
            {field('Base price (EGP)', 'basePrice', 'number', { min: 0.01, step: '0.01' })}
            {field('Discount (%)', 'discount', 'number', { min: 0, max: 90 })}
          </div>
          {field('Tags (comma separated)', 'tags')}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={values.isFeatured}
              onChange={(e) => set('isFeatured', e.target.checked)}
            />{' '}
            Featured product
          </label>
          <fieldset>
            <legend>Variants and inventory</legend>
            {values.variants.map((v, i) => (
              <div className="variant-editor" key={i}>
                <div className="form-grid">
                  <AdminField
                    label={`SKU ${i + 1}`}
                    value={v.sku}
                    onChange={(value) => variant(i, 'sku', value)}
                  />
                  <AdminField
                    label={`Size ${i + 1}`}
                    value={v.size}
                    onChange={(value) => variant(i, 'size', value)}
                  />
                  <AdminField
                    label={`Color ${i + 1}`}
                    value={v.color}
                    onChange={(value) => variant(i, 'color', value)}
                  />
                  <AdminField
                    label={`Stock ${i + 1}`}
                    value={v.stock}
                    type="number"
                    min="0"
                    onChange={(value) => variant(i, 'stock', value)}
                  />
                  <AdminField
                    label={`Price override ${i + 1} (optional)`}
                    value={v.priceOverride}
                    type="number"
                    min="0"
                    onChange={(value) => variant(i, 'priceOverride', value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    set(
                      'variants',
                      values.variants.filter((_, index) => index !== i),
                    )
                  }
                >
                  Remove variant
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                set('variants', [...values.variants, { sku: '', size: '', color: '', stock: 0 }])
              }
            >
              Add variant
            </button>
          </fieldset>
        </>
      )}
      {resource === 'categories' && field('Display order', 'displayOrder', 'number')}
      {resource !== 'coupons' && (
        <fieldset>
          <legend>Images</legend>
          <p className="muted">
            JPEG, PNG or WebP, up to 5 MB each. Cloudinary must be configured to upload.
          </p>
          <label className="btn btn-outline upload-button">
            <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload images'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={resource === 'products'}
              disabled={uploading}
              onChange={(e) => upload([...e.target.files])}
            />
          </label>
          {resource === 'categories' ? (
            field('Image URL', 'image', 'url')
          ) : (
            <>
              <div className="image-editor">
                {values.images.map((image, i) => (
                  <div key={i}>
                    <img
                      src={image.url || image}
                      alt={`Product view ${i + 1}`}
                      width="80"
                      height="100"
                    />
                    <button
                      type="button"
                      className="text-link"
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...values.images];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        set('images', next);
                      }}
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        set(
                          'images',
                          values.images.filter((_, index) => index !== i),
                        )
                      }
                    >
                      Remove image
                    </button>
                  </div>
                ))}
              </div>
              <AdminField
                label="Add existing image URL"
                value={values.newImage || ''}
                type="url"
                onChange={(v) => set('newImage', v)}
              />
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  try {
                    const url = new URL(values.newImage);
                    if (url.protocol !== 'https:') throw new Error();
                    set('images', [...values.images, { url: url.href }]);
                    set('newImage', '');
                  } catch {
                    setFailure('Enter a valid HTTPS image URL.');
                  }
                }}
              >
                Add image URL
              </button>
            </>
          )}
        </fieldset>
      )}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />{' '}
        Active
      </label>
      {failure && (
        <p role="alert" className="field-error">
          {failure}
        </p>
      )}
      <button className="btn" disabled={state.isLoading || uploading}>
        {state.isLoading ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function OrderEditor({ item, onDone }) {
  const [status, setStatus] = useState(item.fulfillmentStatus);
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const canCollect =
    item.paymentMethod === 'cod' &&
    item.fulfillmentStatus === 'delivered' &&
    item.paymentStatus === 'pending';
  const [mutate, state] = useApiMutation();
  const [error, setError] = useState('');
  async function collectCash() {
    try {
      await mutate({
        url: `/admin/orders/${item._id}/collect-cod`,
        method: 'POST',
        body: { confirmed: true },
      }).unwrap();
      toast.success('Cash payment recorded');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save() {
    try {
      await mutate({
        url: `/admin/orders/${item._id}/status`,
        method: 'PATCH',
        body: { status },
      }).unwrap();
      toast.success('Order status updated');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <p>
        {item.customerSnapshot?.name} · {item.customerSnapshot?.email}
      </p>
      <p>
        {item.shippingAddressSnapshot?.street}, {item.shippingAddressSnapshot?.city},{' '}
        {item.shippingAddressSnapshot?.governorate}
      </p>
      <p>
        Payment: {item.paymentStatus} / {item.paymentMethod}
      </p>
      <ul>
        {item.items?.map((i) => (
          <li key={i.sku}>
            {i.name} · {i.size} / {i.color} · {i.quantity} × {money(i.unitPrice)}
          </li>
        ))}
      </ul>
      <h3>Total {money(item.total)}</h3>
      {canCollect && (
        <div className="notice">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={cashConfirmed}
              onChange={(e) => setCashConfirmed(e.target.checked)}
            />
            I confirm the full cash payment has been received.
          </label>
          <button
            className="btn"
            disabled={!cashConfirmed || state.isLoading}
            onClick={collectCash}
          >
            Record cash payment collected
          </button>
        </div>
      )}
      <AdminSelect
        label="Fulfillment status"
        value={status}
        onChange={setStatus}
        options={[
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'canceled',
          'returned',
        ]}
      />
      <p className="muted">
        Only valid order transitions are accepted by the server. Canceling releases inventory where
        permitted.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn"
        disabled={state.isLoading || status === item.fulfillmentStatus}
        onClick={save}
      >
        Update order status
      </button>
    </>
  );
}
function CustomerDetail({ item }) {
  const query = useApiQuery({ url: `/admin/customers/${item._id}/orders` });
  return (
    <>
      <p>
        {item.email}
        <br />
        {item.phone || 'No phone number saved'}
      </p>
      <p>
        {item.isActive ? 'Active account' : 'Inactive account'} ·{' '}
        {item.isEmailVerified ? 'Email verified' : 'Email not verified'}
      </p>
      <h3>Order history</h3>
      <RemoteState query={query}>
        {query.data?.data?.length ? (
          <ul>
            {query.data.data.map((order) => (
              <li key={order._id}>
                {order.orderNumber} · {money(order.total)} · {order.fulfillmentStatus}
              </li>
            ))}
          </ul>
        ) : (
          <p>No orders found.</p>
        )}
      </RemoteState>
    </>
  );
}
function MessageDetail({ item, onDone }) {
  const [mutate, state] = useApiMutation();
  async function close() {
    try {
      await mutate({
        url: `/admin/messages/${item._id}`,
        method: 'PATCH',
        body: { status: 'resolved' },
      }).unwrap();
      toast.success('Message marked as resolved');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <p>
        From {item.name} · <a href={`mailto:${item.email}`}>{item.email}</a>
      </p>
      <p className="message-body">{item.message}</p>
      <button
        className="btn"
        disabled={state.isLoading || item.status === 'resolved'}
        onClick={close}
      >
        Mark as resolved
      </button>
    </>
  );
}
