import { AppRouter } from "./routes/AppRouter";
import { PwaExperience } from "./components/pwa/PwaExperience";
import { ToastProvider } from "./context/ToastContext";
import { GoogleCallbackHandler } from "./components/google/GoogleCallbackHandler";

function App() {
  return (
    <ToastProvider>
      <GoogleCallbackHandler />
      <AppRouter />
      <PwaExperience />
    </ToastProvider>
  );
}

export default App;
