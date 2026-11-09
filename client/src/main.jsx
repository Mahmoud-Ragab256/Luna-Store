import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { store } from './app/store';
import { router } from './app/router';
import './styles/index.css';
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </Provider>,
);
