import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Smartphone, Monitor, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import AppLayout from "@/components/AppLayout";
import MeshBackground from "@/components/MeshBackground";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const brandName = tenant?.name || "Engios";

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
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
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const guestNav = !user ? (
    <nav className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
      <div className="rd-card rounded-2xl px-5 py-2.5 flex items-center justify-between w-full">
        <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{brandName}</Link>
        <Link to="/login" className="gl ghost h-9 px-4 text-xs">Entrar</Link>
      </div>
    </nav>
  ) : null;

  const content = (
    <div className="min-h-screen relative">
      {!user && <MeshBackground />}
      {guestNav}

      <section className="px-6 py-24 max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <div className="chip inline-flex items-center gap-2 px-4 py-2 mb-8">
            <Smartphone className="h-4 w-4" />
            <span className="text-xs font-medium">Instalar App</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6" style={{ letterSpacing: "-0.04em" }}>Instale o {brandName}</h1>
          <p className="text-sm text-muted-foreground text-base max-w-lg mx-auto">
            Acesse o {brandName} direto da tela inicial do seu celular ou computador.
            Funciona offline e carrega instantaneamente.
          </p>
        </div>

        {isInstalled ? (
          <div className="rd-card text-center py-12 mb-8">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-[28px] font-extrabold text-foreground mb-3" style={{ letterSpacing: "-0.03em" }}>App instalado!</h2>
            <p className="text-sm text-muted-foreground mb-8">O {brandName} já está na sua tela inicial.</p>
            <Link to="/home" className="gl primary h-11 px-5">Ir para o Dashboard</Link>
          </div>
        ) : deferredPrompt ? (
          <div className="rd-card text-center py-12 mb-8">
            <div className="h-20 w-20 rounded-2xl border border-border/60 flex items-center justify-center mx-auto mb-6">
              <Download className="h-10 w-10 text-foreground" />
            </div>
            <h2 className="text-[28px] font-extrabold text-foreground mb-3" style={{ letterSpacing: "-0.03em" }}>Instalar agora</h2>
            <p className="text-sm text-muted-foreground mb-8">Clique no botão abaixo para instalar o app.</p>
            <button onClick={handleInstall} disabled={installing} className="gl primary h-11 px-5">
              {installing ? "Instalando..." : "Instalar App"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {isIOS && (
              <div className="rd-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground">iPhone / iPad</h3>
                    <p className="text-xs text-muted-foreground">Safari</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {["Abra este site no Safari", "Toque no botão Compartilhar", "Toque em \"Adicionar à Tela de Início\"", "Confirme tocando em \"Adicionar\""].map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {isAndroid && (
              <div className="rd-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground">Android</h3>
                    <p className="text-xs text-muted-foreground">Chrome</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {["Abra este site no Chrome", "Toque no menu (3 pontos)", "Toque em \"Adicionar à tela inicial\"", "Confirme tocando em \"Adicionar\""].map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!isIOS && !isAndroid && (
              <div className="rd-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground">Desktop</h3>
                    <p className="text-xs text-muted-foreground">Chrome / Edge</p>
                  </div>
                </div>
                <ol className="space-y-4">
                  {["Abra este site no Chrome ou Edge", "Clique no ícone de instalação na barra de endereço", "Clique em \"Instalar\" para confirmar"].map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {[
            { icon: Download, title: "Offline", desc: "Funciona sem internet após instalação." },
            { icon: Smartphone, title: "Nativo", desc: "Experiência de app nativo no seu dispositivo." },
            { icon: Monitor, title: "Multi-plataforma", desc: "Disponível em celular, tablet e desktop." },
          ].map((f) => (
            <div key={f.title} className="rd-card text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-[15px] font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>


      <footer className="border-t border-border/60 px-6 py-6 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {brandName} — Todos os direitos reservados</p>
      </footer>
    </div>
  );

  if (user) return <AppLayout>{content}</AppLayout>;
  return content;
}
