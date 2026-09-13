import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show banner for iOS after delay
    if (isIOSDevice) {
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-surface rounded-2xl p-4 shadow-xl z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-surface-foreground/50 hover:text-surface-foreground"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <Smartphone className="h-6 w-6 text-primary-foreground" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-surface-foreground">Instalar App</h3>
          {isIOS ? (
            <p className="text-sm text-surface-foreground/70 mt-1">
              Toque em <span className="font-medium">Compartilhar</span> e depois em{" "}
              <span className="font-medium">"Adicionar à Tela de Início"</span>
            </p>
          ) : (
            <>
              <p className="text-sm text-surface-foreground/70 mt-1">
                Instale o app para acesso rápido
              </p>
              <Button
                onClick={handleInstall}
                className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-10 rounded-xl"
              >
                <Download className="h-4 w-4 mr-2" />
                Instalar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
