import { AppRouter } from "./routes/AppRouter";
import { PwaExperience } from "./components/pwa/PwaExperience";
import { ToastProvider } from "./context/ToastContext";

function App() {
  return (
    <ToastProvider>
      <AppRouter />
      <PwaExperience />
    </ToastProvider>
  );
}

export default App;
