// src/redux/store.js

import { configureStore } from '@reduxjs/toolkit';
import AlertMessageReducer from './AlertMessageSlice';
import chatReducer from './ChatSlice';

export const store = configureStore({
  reducer: {
    AlertMessage: AlertMessageReducer,
    chat: chatReducer,
  },
});
