import { Navigate, Route, Routes } from "react-router-dom";

import Landing from "./pages/Landing";
import SharedQuiz from "./pages/SharedQuiz";
import Studio from "./pages/Studio";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/s/:token" element={<SharedQuiz />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
