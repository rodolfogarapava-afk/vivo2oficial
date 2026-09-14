import { WifiOff, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { VIVO_PANEL_URL } from "@/hooks/useVivoPanel";

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-400">
        <WifiOff className="h-3 w-3" />
        Offline
      </span>
    );
  }

  return (
    <button
      onClick={() => window.open(VIVO_PANEL_URL, "_blank", "noopener,noreferrer")}
      className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/30"
      title="Abrir o painel Vivo Gestão"
    >
      <ExternalLink className="h-3 w-3" />
      <span>Gestor</span>
    </button>
  );
};
