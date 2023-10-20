// src/redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import AlertMessageReducer from './AlertMessageSlice';

export const store = configureStore({
  reducer: {
    AlertMessage: AlertMessageReducer,
  },
});