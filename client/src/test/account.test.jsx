import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage, CartPage, CheckoutPage, WishlistPage } from '../pages/AccountPages';

const mocks = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('../api/baseApi', () => ({ useApiMutation: () => [mocks.mutation, { isLoading: false }], useApiQuery: (...args) => mocks.query(...args) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
const piece = { productId: '012345678901234567890123', sku: 'LUNA-001-S', name: 'The linen dress', size: 'S', color: 'Ivory', quantity: 1, price: 2000, image: '/product.jpg', slug: 'linen-dress' };
function mount(Component, overrides = {}) {
  const initial = { auth: { initialized: true, user: null }, cart: { items: [], couponCode: '' }, wishlist: { items: [] }, ...overrides };
  const store = configureStore({ reducer: (state = initial, action) => {
    if (action.type === 'wishlist/toggleWishlist') return { ...state, wishlist: { items: state.wishlist.items.filter(item => item._id !== action.payload._id) } };
    if (action.type === 'cart/removeItem') return { ...state, cart: { ...state.cart, items: state.cart.items.filter(i => i.sku !== action.payload) } };
    if (action.type === 'cart/updateQuantity') return { ...state, cart: { ...state.cart, items: state.cart.items.map(i => i.sku === action.payload.sku ? { ...i, quantity: action.payload.quantity } : i) } };
    return state;
  } });
  render(<Provider store={store}><MemoryRouter>{Component}</MemoryRouter></Provider>);
  return store;
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ data: { data: { zones: [{ governorate: 'Cairo', fee: 60 }], onlinePaymentsEnabled: false } }, refetch: vi.fn(), isLoading: false });
  mocks.mutation.mockImplementation(() => ({ unwrap: () => Promise.resolve({ data: { items: [piece], subtotal: 1000, discount: 100, shippingFee: 60, total: 960 } }) }));
});

describe('account and checkout forms', () => {
  it('rejects invalid login input without sending credentials', async () => {
    const user = userEvent.setup(); mount(<AuthPage mode="login" />);
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it('lets a password manager value be revealed without changing it', async () => {
    const user = userEvent.setup(); mount(<AuthPage mode="register" />);
    const password = screen.getByLabelText('Password');
    await user.type(password, 'a-long-password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('a-long-password');
  });
  it('keeps checkout on customer details when the Egyptian phone is invalid', async () => {
    const user = userEvent.setup(); mount(<CheckoutPage />, { auth: { initialized: true, user: { name: 'Sara Ali', email: 'sara@example.com' } }, cart: { items: [piece] } });
    await user.type(screen.getByLabelText('Egyptian mobile number'), '12345');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Enter a valid Egyptian mobile number.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Where shall we send it?' })).not.toBeInTheDocument();
  });
  it('waits for session initialization before redirecting checkout', () => {
    mount(<CheckoutPage />, { auth: { initialized: false, user: null } });
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your session');
  });
  it('opens review without creating an order when the last Continue is clicked', async () => {
    const user = userEvent.setup();
    mount(<CheckoutPage />, { auth: { initialized: true, user: { name: 'Sara Ali', email: 'sara@example.com', phone: '01012345678' } }, cart: { items: [piece] } });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.selectOptions(await screen.findByLabelText('Governorate'), 'Cairo');
    await user.type(screen.getByLabelText('City'), 'Cairo');
    await user.type(screen.getByLabelText('Street address'), '12 Studio Street');
    await user.type(screen.getByLabelText('Building'), '12');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'A delivery that suits you' });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByRole('heading', { name: 'How would you like to pay?' });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'One last look' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
    expect(mocks.mutation.mock.calls.some(([request]) => request.url === '/orders')).toBe(false);
  });
});

describe('shopping bag', () => {
  it('renders server-verified totals instead of calculating them from cached prices', async () => {
    mount(<CartPage />, { cart: { items: [piece], couponCode: '' } });
    expect(await screen.findByText(/960/)).toBeInTheDocument();
    expect(mocks.mutation).toHaveBeenCalledWith(expect.objectContaining({ url: '/cart/quote', body: { items: [{ productId: piece.productId, sku: piece.sku, quantity: 1 }] } }));
  });
  it('removes an item and explains the resulting empty state', async () => {
    const user = userEvent.setup(); const store = mount(<CartPage />, { cart: { items: [piece] } });
    await user.click(screen.getByRole('button', { name: `Remove ${piece.name}` }));
    expect(store.getState().cart.items).toHaveLength(0);
    expect(await screen.findByRole('heading', { name: 'Your next favourite is waiting' })).toBeInTheDocument();
  });
  it('blocks checkout when inventory verification fails', async () => {
    mocks.mutation.mockImplementation(() => ({ unwrap: () => Promise.reject({ data: { message: 'Selected size is sold out' } }) }));
    mount(<CartPage />, { cart: { items: [piece] } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });
});


describe('saved wishlist', () => {
  const product = { _id: '012345678901234567890123', name: 'Linen dress', slug: 'linen-dress', basePrice: 1000, images: ['/product.jpg'], variants: [{stock: 2}] };
  it('removes an authenticated saved product through the backend before updating local state', async () => {
    const user = userEvent.setup();
    const store = mount(<WishlistPage />, { auth: {initialized:true,user:{name:'Sara'}}, wishlist:{items:[product]} });
    await user.click(screen.getByRole('button',{name:'Remove Linen dress from wishlist'}));
    await waitFor(() => expect(store.getState().wishlist.items).toHaveLength(0));
    expect(mocks.mutation).toHaveBeenCalledWith({url:`/wishlist/items/${product._id}`,method:'DELETE'});
  });
  it('keeps a saved product when the server rejects removal', async () => {
    mocks.mutation.mockImplementation(() => ({ unwrap: () => Promise.reject({data:{message:'Connection lost'}}) }));
    const user=userEvent.setup();
    const store=mount(<WishlistPage />, {auth:{initialized:true,user:{name:'Sara'}},wishlist:{items:[product]}});
    await user.click(screen.getByRole('button',{name:'Remove Linen dress from wishlist'}));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(store.getState().wishlist.items).toHaveLength(1);
  });
});
