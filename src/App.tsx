import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ChatProvider } from "@/contexts/ChatContext";
import ChatPanel from "@/components/chat/ChatPanel";
import Index from "./pages/Index";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminGlobal = lazy(() => import("./pages/AdminGlobal"));
const TenantAdmin = lazy(() => import("./pages/TenantAdmin"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const AffiliateRefPage = lazy(() => import("./pages/AffiliateRefPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
// FreePlan removed
const Community = lazy(() => import("./pages/Community"));
const Profile = lazy(() => import("./pages/Profile"));
const AffiliatesPage = lazy(() => import("./pages/AffiliatesPage"));
const Install = lazy(() => import("./pages/Install"));
const LovableConnect = lazy(() => import("./pages/LovableConnect"));
const LovableProjects = lazy(() => import("./pages/LovableProjects"));
const LovablePreview = lazy(() => import("./pages/LovablePreview"));
const LovableUploadTest = lazy(() => import("./pages/LovableUploadTest"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
                <Route path="/affiliate" element={<AffiliateDashboard />} />
                <Route path="/ref/:code" element={<AffiliateRefPage />} />
                <Route path="/checkout" element={<Checkout />} />
                {/* /free route removed */}
                <Route path="/community" element={<Community />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/affiliates" element={<AffiliatesPage />} />
                <Route path="/install" element={<Install />} />
                <Route path="/lovable/connect" element={<LovableConnect />} />
                <Route path="/lovable/projects" element={<LovableProjects />} />
                <Route path="/lovable/preview" element={<LovablePreview />} />
                <Route path="/lovable/upload-test" element={<LovableUploadTest />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <ChatPanel />
          </ChatProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
