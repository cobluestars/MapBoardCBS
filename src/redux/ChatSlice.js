// src/redux/chatSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  chatid: null,
  Currentemail: null,
  roadAddress: null,
  jibunAddress: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChatId(state, action) {
      state.chatid = action.payload;
    },
    setCurrentemail(state, action) {  
      state.Currentemail = action.payload;
    },
    setRoadAddress(state, action) {
      state.roadAddress = action.payload;
    },
    setJibunAddress(state, action) {
      state.jibunAddress = action.payload;
    },
  },
});

// Export actions
export const { setChatId, setCurrentemail, setRoadAddress, setJibunAddress } = chatSlice.actions;

// Export reducer
export default chatSlice.reducer;
