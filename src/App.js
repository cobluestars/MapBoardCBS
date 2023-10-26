import { BrowserRouter, Routes, Route } from "react-router-dom";
import ApolloClientSetup from './apollo/ApolloClientSetup';
import Kakao from "./Componants/Kakao";
import { ChatRoomProvider } from './Componants/ChatRoomProvider';

function App() {
  return (
    <ApolloClientSetup>
      <BrowserRouter>
      <ChatRoomProvider>
        <Routes>
          <Route path="/" element={<Kakao />} />
        </Routes>
      </ChatRoomProvider>
      </BrowserRouter>
    </ApolloClientSetup>
  );
}

export default App;
