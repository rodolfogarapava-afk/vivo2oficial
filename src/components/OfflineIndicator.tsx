import { WifiOff, Users } from "lucide-react";
import { useState, useEffect } from "react";

interface OfflineIndicatorProps {
  onClick: () => void;
}

export const OfflineIndicator = ({ onClick }: OfflineIndicatorProps) => {
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
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 bg-transparent px-2 py-1 text-xs font-medium text-success"
      title="Abrir lista completa do Gestor"
    >
      <Users className="h-5 w-5" />
      <span>Gestor</span>
    </button>
  );
};
