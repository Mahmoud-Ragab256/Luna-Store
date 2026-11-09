import { createSlice } from '@reduxjs/toolkit';
function stored() {
  try {
    const d = JSON.parse(localStorage.getItem('luna.wishlist.v1'));
    return { items: Array.isArray(d?.items) ? d.items : [] };
  } catch {
    return { items: [] };
  }
}
const slice = createSlice({
  name: 'wishlist',
  initialState: stored(),
  reducers: {
    toggleWishlist(state, { payload }) {
      if (state.items.some((p) => p._id === payload._id))
        state.items = state.items.filter((p) => p._id !== payload._id);
      else state.items.push(payload);
    },
    replaceWishlist(state, { payload }) {
      state.items = payload;
    },
  },
});
export const { toggleWishlist, replaceWishlist } = slice.actions;
export default slice.reducer;
