import { BrowserRouter, Routes, Route } from "react-router-dom";
import Kakao from "./Componants/Kakao";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Kakao />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
