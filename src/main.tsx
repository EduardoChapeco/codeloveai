import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/redesign.css";
import { registerSWUpdate, checkAppVersion } from "./sw-update";

// Force dark theme globally and cache bust on new deployments
document.documentElement.classList.add("dark");
checkAppVersion();
registerSWUpdate();

createRoot(document.getElementById("root")!).render(<App />);
