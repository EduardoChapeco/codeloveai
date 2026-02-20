import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, Smartphone, Monitor, Check, ArrowRight, Share, MoreVertical } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppNav from "@/components/AppNav";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background">
      {user ? (
        <AppNav />
      ) : (
        <nav className="sticky top-0 z-20 bg-background border-b border-border px-8 py-4 flex items-center justify-between">
          <Link to="/" className="ep-label text-sm tracking-[0.3em]">CODELOVE AI</Link>
          <Link to="/login" className="ep-btn-secondary h-10 px-6 text-[9px]">ENTRAR</Link>
        </nav>
      )}

      <section className="px-8 py-24 max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-foreground/20 bg-foreground/5 rounded-[48px] px-6 py-2.5 mb-8">
            <Smartphone className="h-4 w-4 text-foreground" />
            <span className="text-[10px] font-bold text-foreground tracking-[0.2em]">INSTALAR APP</span>
          </div>
          <h1 className="ep-title mb-6">INSTALE O CODELOVE AI</h1>
          <p className="text-base text-muted-foreground font-medium max-w-lg mx-auto">
            Acesse o CodeLove AI direto da tela inicial do seu celular ou computador. 
            Funciona offline e carrega instantaneamente.
          </p>
        </div>

        {/* Install status */}
        {isInstalled ? (
          <div className="ep-card text-center py-12 mb-8">
            <div className="h-20 w-20 rounded-[28px] bg-foreground flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-background" />
            </div>
            <h2 className="ep-section-title text-2xl mb-3">APP INSTALADO!</h2>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              O CodeLove AI já está na sua tela inicial. Abra pelo ícone do app.
            </p>
            <Link to="/dashboard" className="ep-btn-primary h-12 px-8 text-[10px]">
              IR PARA O DASHBOARD
            </Link>
          </div>
        ) : deferredPrompt ? (
          /* Chrome/Edge auto install */
          <div className="ep-card text-center py-12 mb-8">
            <div className="h-20 w-20 rounded-[28px] border border-border flex items-center justify-center mx-auto mb-6">
              <Download className="h-10 w-10 text-foreground" />
            </div>
            <h2 className="ep-section-title text-2xl mb-3">INSTALAR AGORA</h2>
            <p className="text-sm text-muted-foreground font-medium mb-8">
              Clique no botão abaixo para instalar o app na sua tela inicial.
            </p>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="ep-btn-primary h-14 px-10 text-[11px]"
            >
              {installing ? "INSTALANDO..." : "INSTALAR APP"}
            </button>
          </div>
        ) : (
          /* Manual instructions */
          <div className="space-y-6 mb-8">
            {isIOS && (
              <div className="ep-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-[18px] bg-foreground flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-background" />
                  </div>
                  <div>
                    <h3 className="ep-label text-[11px]">IPHONE / IPAD</h3>
                    <p className="text-xs text-muted-foreground font-medium">Safari</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {[
                    { step: "Abra este site no Safari", icon: "🌐" },
                    { step: "Toque no botão Compartilhar (ícone de seta para cima)", icon: "📤" },
                    { step: "Role para baixo e toque em \"Adicionar à Tela de Início\"", icon: "➕" },
                    { step: "Toque em \"Adicionar\" para confirmar", icon: "✅" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-foreground tracking-widest mb-0.5">PASSO {i + 1}</p>
                        <p className="text-sm text-muted-foreground font-medium">{item.step}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {isAndroid && (
              <div className="ep-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-[18px] bg-foreground flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-background" />
                  </div>
                  <div>
                    <h3 className="ep-label text-[11px]">ANDROID</h3>
                    <p className="text-xs text-muted-foreground font-medium">Chrome</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {[
                    { step: "Abra este site no Chrome", icon: "🌐" },
                    { step: "Toque no menu (3 pontos) no canto superior direito", icon: "⋮" },
                    { step: "Toque em \"Adicionar à tela inicial\"", icon: "➕" },
                    { step: "Toque em \"Adicionar\" para confirmar", icon: "✅" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-foreground tracking-widest mb-0.5">PASSO {i + 1}</p>
                        <p className="text-sm text-muted-foreground font-medium">{item.step}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {!isIOS && !isAndroid && (
              <div className="ep-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-[18px] bg-foreground flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-background" />
                  </div>
                  <div>
                    <h3 className="ep-label text-[11px]">DESKTOP</h3>
                    <p className="text-xs text-muted-foreground font-medium">Chrome / Edge</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {[
                    { step: "Abra este site no Chrome ou Edge", icon: "🌐" },
                    { step: "Clique no ícone de instalação na barra de endereço (⊕)", icon: "⊕" },
                    { step: "Clique em \"Instalar\" para confirmar", icon: "✅" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="text-2xl shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-foreground tracking-widest mb-0.5">PASSO {i + 1}</p>
                        <p className="text-sm text-muted-foreground font-medium">{item.step}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: Download, title: "OFFLINE", desc: "Funciona sem internet após instalação." },
            { icon: Smartphone, title: "NATIVO", desc: "Experiência de app nativo no seu dispositivo." },
            { icon: Monitor, title: "MULTI-PLATAFORMA", desc: "Disponível em celular, tablet e desktop." },
          ].map((f) => (
            <div key={f.title} className="ep-card-sm text-center">
              <f.icon className="h-6 w-6 text-foreground mx-auto mb-4" />
              <h3 className="ep-label text-[10px] mb-2">{f.title}</h3>
              <p className="text-xs text-muted-foreground font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-8 py-8 text-center">
        <p className="ep-subtitle">© 2025 CODELOVE AI — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
