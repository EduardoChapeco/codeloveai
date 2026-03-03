import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/redesign.css";
import { registerSWUpdate, checkAppVersion } from "./sw-update";

// Force cache bust on new deployments
checkAppVersion();
registerSWUpdate();

createRoot(document.getElementById("root")!).render(<App />);
