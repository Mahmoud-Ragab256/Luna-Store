import { configureStore } from '@reduxjs/toolkit';
import auth from '../features/auth/authSlice';
import cart from '../features/cart/cartSlice';
import wishlist from '../features/wishlist/wishlistSlice';
import { baseApi } from '../api/baseApi';
import { toast } from 'sonner';
let cartSync = Promise.resolve();
const persistence = (api) => (next) => (action) => {
  const result = next(action);
  if (action.type === 'auth/logout') {
    api.dispatch(baseApi.util.resetApiState());
    api.dispatch({ type: 'cart/replaceCart', payload: { items: [], couponCode: '' } });
    api.dispatch({ type: 'wishlist/replaceWishlist', payload: [] });
  }
  if (
    [
      'cart/addItem',
      'cart/updateQuantity',
      'cart/removeItem',
      'cart/clearCart',
      'cart/setCoupon',
    ].includes(action.type)
  ) {
    const state = api.getState();
    if (state.auth.user) {
      const userId = state.auth.user._id;
      const body = {
        items: state.cart.items.map((i) => ({
          productId: i.productId,
          sku: i.sku || i.variantSku,
          quantity: i.quantity,
        })),
        couponCode: state.cart.couponCode,
      };
      cartSync = cartSync
        .catch(() => {})
        .then(async () => {
          if (api.getState().auth.user?._id !== userId) return;
          try {
            await api
              .dispatch(
                baseApi.endpoints.apiMutation.initiate({ url: '/cart', method: 'PUT', body }),
              )
              .unwrap();
          } catch {
            toast.error(
              'Your bag is saved on this device. Server sync failed; try again from your bag.',
            );
          }
        });
    }
  }
  return result;
};
export const store = configureStore({
  reducer: { auth, cart, wishlist, [baseApi.reducerPath]: baseApi.reducer },
  middleware: (g) => g().concat(baseApi.middleware, persistence),
});
store.subscribe(() => {
  const { cart, wishlist } = store.getState();
  try {
    localStorage.setItem('luna.cart.v1', JSON.stringify(cart));
    localStorage.setItem('luna.wishlist.v1', JSON.stringify(wishlist));
  } catch {
    /* Storage may be unavailable in privacy mode. */
  }
});
