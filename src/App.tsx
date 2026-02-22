import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SupportChatProvider } from "@/contexts/SupportChatContext";
import ChatPanel from "@/components/chat/ChatPanel";
import SupportChatPanel from "@/components/chat/SupportChatPanel";
import Index from "./pages/Index";

// Retry dynamic imports once on failure (stale chunk after deploy)
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch(() => {
      const key = 'clf_chunk_retry';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
      sessionStorage.removeItem(key);
      return importFn();
    })
  );
}

const Login = lazyRetry(() => import("./pages/Login"));
const Register = lazyRetry(() => import("./pages/Register"));
const ForgotPassword = lazyRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Admin = lazyRetry(() => import("./pages/Admin"));
const AdminGlobal = lazyRetry(() => import("./pages/AdminGlobal"));
const TenantAdmin = lazyRetry(() => import("./pages/TenantAdmin"));
const Community = lazyRetry(() => import("./pages/Community"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const Notes = lazyRetry(() => import("./pages/Notes"));
const Install = lazyRetry(() => import("./pages/Install"));
const LovableConnect = lazyRetry(() => import("./pages/LovableConnect"));
const LovableProjects = lazyRetry(() => import("./pages/LovableProjects"));
const LovablePreview = lazyRetry(() => import("./pages/LovablePreview"));
const LovableUploadTest = lazyRetry(() => import("./pages/LovableUploadTest"));
const Brain = lazyRetry(() => import("./pages/Brain"));
const ProjectEditor = lazyRetry(() => import("./pages/ProjectEditor"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
          <ChatProvider>
          <SupportChatProvider>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/global" element={<AdminGlobal />} />
                <Route path="/admin/tenant" element={<TenantAdmin />} />
                <Route path="/community" element={<Community />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/install" element={<Install />} />
                <Route path="/lovable/connect" element={<LovableConnect />} />
                <Route path="/lovable/projects" element={<LovableProjects />} />
                <Route path="/lovable/preview" element={<LovablePreview />} />
                <Route path="/lovable/upload-test" element={<LovableUploadTest />} />
                <Route path="/brain" element={<Brain />} />
                <Route path="/projeto/:id/editar" element={<ProjectEditor />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <ChatPanel />
            <SupportChatPanel />
          </SupportChatProvider>
          </ChatProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
