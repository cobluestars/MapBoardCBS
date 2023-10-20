// src/redux/AlertMessageSlice.js

import { createSlice } from '@reduxjs/toolkit';

export const AlertMessageSlice = createSlice({
  name: 'AlertMessage',
  initialState: {
    value: null,
    unreadMessageCount: 0,
  },
  reducers: {
    setAlertMessage: (state, action) => {
      state.value = action.payload;
    },
    incrementMessageCount: (state) => {
      state.unreadMessageCount += 1;
      state.value = `새 메시지가 ${state.unreadMessageCount}개 도착했습니다.`;
    },
    resetMessageCount: (state) => {
      state.unreadMessageCount = 0;
      state.value = null;
    },
  },
});

export const { setAlertMessage, incrementMessageCount, resetMessageCount } = AlertMessageSlice.actions;

export default AlertMessageSlice.reducer;
