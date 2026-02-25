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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
const OrchestratorProjectPanel = lazyRetry(() => import("./pages/OrchestratorProjectPanel"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const WhiteLabelOnboarding = lazyRetry(() => import("./pages/WhiteLabelOnboarding"));
const TenantDashboard = lazyRetry(() => import("./pages/TenantDashboard"));
const WhiteLabelFAQ = lazyRetry(() => import("./pages/WhiteLabelFAQ"));
const Checkout = lazyRetry(() => import("./pages/Checkout"));
const FreePlan = lazyRetry(() => import("./pages/FreePlan"));
const PlansPage = lazyRetry(() => import("./pages/PlansPage"));
const AdminIntegrations = lazyRetry(() => import("./pages/AdminIntegrations"));
const Automation = lazyRetry(() => import("./pages/Automation"));
// Lab pages (feature-flag gated)
const BrainLab = lazyRetry(() => import("./pages/lab/BrainLab"));
const StarCrawlLab = lazyRetry(() => import("./pages/lab/StarCrawlLab"));
const VoiceLab = lazyRetry(() => import("./pages/lab/VoiceLab"));
const OrchestratorLab = lazyRetry(() => import("./pages/lab/OrchestratorLab"));
// Public landings
const AffiliateLanding = lazyRetry(() => import("./pages/public/AffiliateLanding"));
const WhiteLabelLanding = lazyRetry(() => import("./pages/public/WhiteLabelLanding"));
// Help, Terms, Support
const HelpCenter = lazyRetry(() => import("./pages/HelpCenter"));
const HelpArticle = lazyRetry(() => import("./pages/HelpArticle"));
const TermsOfUse = lazyRetry(() => import("./pages/TermsOfUse"));
const SupportPage = lazyRetry(() => import("./pages/SupportPage"));

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
                <Route path="/cadastro" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/global" element={<AdminGlobal />} />
                <Route path="/admin/integrations" element={<AdminIntegrations />} />
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
                <Route path="/orquestrador/:id" element={<OrchestratorProjectPanel />} />
                <Route path="/automation" element={<Automation />} />
                <Route path="/whitelabel/onboarding" element={<WhiteLabelOnboarding />} />
                <Route path="/wl/setup" element={<WhiteLabelOnboarding />} />
                <Route path="/faq/whitelabel" element={<WhiteLabelFAQ />} />
                <Route path="/tenant/dashboard" element={<TenantDashboard />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/free" element={<FreePlan />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/precos" element={<PlansPage />} />
                {/* Lab pages (feature-flag gated, with waitlist) */}
                <Route path="/lab/brain" element={<BrainLab />} />
                <Route path="/lab/starcrawl" element={<StarCrawlLab />} />
                <Route path="/lab/voice" element={<VoiceLab />} />
                <Route path="/lab/orchestrator" element={<OrchestratorLab />} />
                {/* Public landings */}
                <Route path="/afiliados" element={<AffiliateLanding />} />
                <Route path="/whitelabel" element={<WhiteLabelLanding />} />
                {/* Help, Terms, Support */}
                <Route path="/ajuda" element={<HelpCenter />} />
                <Route path="/ajuda/:slug" element={<HelpArticle />} />
                <Route path="/termos" element={<TermsOfUse />} />
                <Route path="/suporte" element={<SupportPage />} />
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
