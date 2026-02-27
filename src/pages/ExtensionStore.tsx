import { Navigate } from "react-router-dom";

// All extensions removed except Venus — redirect to Venus page
export default function ExtensionStore() {
  return <Navigate to="/extensoes/venus" replace />;
}
