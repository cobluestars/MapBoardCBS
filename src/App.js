import { BrowserRouter, Routes, Route } from "react-router-dom";
import ApolloClientSetup from './apollo/ApolloClientSetup';
import Kakao from "./Componants/Kakao";

function App() {

  return (
    <ApolloClientSetup>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Kakao />} />
      </Routes>
    </BrowserRouter>
    </ApolloClientSetup>
  );
}

export default App;
