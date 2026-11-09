import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials, logout } from '../features/auth/authSlice';
const raw = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  credentials: 'include',
  prepareHeaders(headers, { getState }) {
    const token = getState().auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});
let refreshPromise;
const baseQuery = async (args, api, options) => {
  let result = await raw(args, api, options);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status === 401 && !url.startsWith('/auth/')) {
    if (!refreshPromise)
      refreshPromise = raw({ url: '/auth/refresh', method: 'POST' }, api, options)
        .then((r) => {
          if (r.data?.data) api.dispatch(setCredentials(r.data.data));
          else {
            api.dispatch(logout());
            api.dispatch(baseApi.util.resetApiState());
          }
          return r;
        })
        .finally(() => {
          refreshPromise = null;
        });
    const refreshed = await refreshPromise;
    if (refreshed.data) result = await raw(args, api, options);
  }
  return result;
};
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Remote'],
  endpoints: (builder) => ({
    api: builder.query({ query: (args) => args, providesTags: ['Remote'] }),
    apiMutation: builder.mutation({ query: (args) => args, invalidatesTags: ['Remote'] }),
  }),
});
export const { useApiQuery, useApiMutationMutation } = baseApi;
export const useApiMutation = baseApi.useApiMutationMutation;
