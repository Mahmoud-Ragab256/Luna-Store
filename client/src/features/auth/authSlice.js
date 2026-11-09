import { createSlice } from '@reduxjs/toolkit';
const slice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null, initialized: false },
  reducers: {
    setCredentials(state, { payload }) {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      state.initialized = true;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.initialized = true;
    },
    sessionReady(state) {
      state.initialized = true;
    },
  },
});
export const { setCredentials, logout, sessionReady } = slice.actions;
export default slice.reducer;
