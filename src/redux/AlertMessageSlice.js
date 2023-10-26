// src/redux/AlertMessageSlice.js

import { createSlice } from '@reduxjs/toolkit';

export const AlertMessageSlice = createSlice({
  name: 'AlertMessage',
  initialState: {
    messages: [], // 메세지 목록을 저장할 배열 추가
    unreadMessageCount: 0,
  },

  reducers: {
    setAlertMessage: (state, action) => {
      state.value = action.payload;
    },
    resetMessageCount: (state) => {
      state.unreadMessageCount = 0;
      state.value = null;
    },
    // 새로운 메세지를 메세지 목록에 추가하는 액션
    addMessageToAlert: (state, action) => {
      state.messages.push(action.payload);
      state.unreadMessageCount += 1;
      state.value = `새 메시지가 ${state.unreadMessageCount}개 도착했습니다.`;
    },
  },
});

export const { addMessageToAlert, resetMessageCount } = AlertMessageSlice.actions;

export default AlertMessageSlice.reducer;