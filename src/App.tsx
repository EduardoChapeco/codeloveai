import { lazy, Suspense, Component, type ReactNode } from "react";
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

// Error boundary to catch chunk load failures and auto-reload
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    if (error.message?.includes("dynamically imported module") || error.message?.includes("Failed to fetch")) {
      return { hasError: true };
    }
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    if (error.message?.includes("dynamically imported module") || error.message?.includes("Failed to fetch")) {
      const key = "clf_chunk_retry";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(key);
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Erro ao carregar a página.</p>
            <button
              onClick={() => { sessionStorage.removeItem("clf_chunk_retry"); window.location.reload(); }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Retry dynamic imports once on failure (stale chunk after deploy)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((err) => {
      const key = "clf_chunk_retry";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise so React doesn't try to render while reloading
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
      // Second attempt after reload
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
// Assistant removed — functionality merged into general ChatPanel
const OrchestratorPage = lazyRetry(() => import("./pages/OrchestratorPage"));
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
// Orphan pages — now registered
const AffiliateDashboard = lazyRetry(() => import("./pages/AffiliateDashboard"));
const AffiliatesPage = lazyRetry(() => import("./pages/AffiliatesPage"));
const AffiliateRefPage = lazyRetry(() => import("./pages/AffiliateRefPage"));
const WlAffiliateDashboard = lazyRetry(() => import("./pages/WlAffiliateDashboard"));
const WhiteLabelRefPage = lazyRetry(() => import("./pages/WhiteLabelRefPage"));
const PartnersLanding = lazyRetry(() => import("./pages/PartnersLanding"));
const LovableCloudAdmin = lazyRetry(() => import("./pages/LovableCloudAdmin"));
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
const ExtensionStore = lazyRetry(() => import("./pages/ExtensionStore"));
const ExtensionDetail = lazyRetry(() => import("./pages/ExtensionDetail"));
const VenusPage = lazyRetry(() => import("./pages/VenusPage"));
const EditorLanding = lazyRetry(() => import("./pages/EditorLanding"));
const Marketplace = lazyRetry(() => import("./pages/Marketplace"));
const MarketplaceDetail = lazyRetry(() => import("./pages/MarketplaceDetail"));
const MarketplaceSell = lazyRetry(() => import("./pages/MarketplaceSell"));
const MarketplaceLanding = lazyRetry(() => import("./pages/MarketplaceLanding"));
const MarketplaceOnboarding = lazyRetry(() => import("./pages/MarketplaceOnboarding"));
const CommunityTestList = lazyRetry(() => import("./pages/CommunityTestList"));
const CommunityTestSession = lazyRetry(() => import("./pages/CommunityTestSession"));
const EvolutionSetupGuide = lazyRetry(() => import("./pages/EvolutionSetupGuide"));
const BrainchainAdmin = lazyRetry(() => import("./pages/BrainchainAdmin"));
const CiriusDashboard = lazyRetry(() => import("./pages/CiriusDashboard"));
const CiriusNew = lazyRetry(() => import("./pages/CiriusNew"));
const CiriusProject = lazyRetry(() => import("./pages/CiriusProject"));
const CiriusIntegrations = lazyRetry(() => import("./pages/CiriusIntegrations"));
const CiriusEditor = lazyRetry(() => import("./pages/CiriusEditor"));
const LovableHireMe = lazyRetry(() => import("./pages/LovableHireMe"));

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
            <ChunkErrorBoundary>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/home" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/global" element={<AdminGlobal />} />
                <Route path="/admin/integrations" element={<AdminIntegrations />} />
                <Route path="/admin/tenant" element={<Admin />} />
                <Route path="/community" element={<Community />} />
                <Route path="/community/tests" element={<CommunityTestList />} />
                <Route path="/community/test/:id" element={<CommunityTestSession />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/install" element={<Install />} />
                <Route path="/painel" element={<LovableConnect />} />
                <Route path="/lovable/connect" element={<LovableConnect />} /> {/* Legacy */}
                <Route path="/lovable/projects" element={<LovableProjects />} />
                <Route path="/lovable/preview" element={<LovablePreview />} />
                <Route path="/lovable/upload-test" element={<LovableUploadTest />} />
                <Route path="/ai" element={<Brain />} />
                <Route path="/brain" element={<Brain />} />
                <Route path="/assistente" element={<Dashboard />} />
                <Route path="/orquestrador" element={<OrchestratorPage />} />
                <Route path="/projeto/:id/editar" element={<ProjectEditor />} />
                <Route path="/orquestrador/:id" element={<OrchestratorProjectPanel />} />
                <Route path="/automation" element={<Automation />} />
                {/* Orphan pages — now accessible */}
                <Route path="/afiliado/dashboard" element={<AffiliateDashboard />} />
                <Route path="/afiliados/painel" element={<AffiliatesPage />} />
                <Route path="/ref/:code" element={<AffiliateRefPage />} />
                <Route path="/wl/afiliados" element={<WlAffiliateDashboard />} />
                <Route path="/wl/ref/:code" element={<WhiteLabelRefPage />} />
                <Route path="/parceiros" element={<PartnersLanding />} />
                <Route path="/admin/cloud" element={<LovableCloudAdmin />} />
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
                <Route path="/extensoes" element={<ExtensionStore />} />
                <Route path="/extensoes/venus" element={<VenusPage />} />
                <Route path="/extensoes/:slug" element={<ExtensionDetail />} />
                <Route path="/editor" element={<EditorLanding />} />
                {/* Marketplace */}
                <Route path="/store" element={<MarketplaceLanding />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/marketplace/vender" element={<MarketplaceSell />} />
                <Route path="/marketplace/:slug" element={<MarketplaceDetail />} />
                <Route path="/marketplace/onboarding/:purchaseId" element={<MarketplaceOnboarding />} />
                <Route path="/setup/evolution" element={<EvolutionSetupGuide />} />
                <Route path="/admin/brainchain" element={<BrainchainAdmin />} />
                {/* Cirius — dashboard redirects to unified projects */}
                <Route path="/cirius" element={<LovableProjects />} />
                <Route path="/cirius/new" element={<CiriusNew />} />
                <Route path="/cirius/create" element={<CiriusNew />} />
                <Route path="/cirius/project/:id" element={<CiriusProject />} />
                <Route path="/cirius/integrations" element={<CiriusIntegrations />} />
                <Route path="/cirius/editor/:id" element={<CiriusEditor />} />
                <Route path="/lovable-me-contrata" element={<LovableHireMe />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ChunkErrorBoundary>
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
