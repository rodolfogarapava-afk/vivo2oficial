import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) return;
    
    setIsSyncing(true);
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
    setTimeout(() => setIsSyncing(false), 1000);
  };

  return (
    <button 
      onClick={handleSync}
      disabled={!isOnline || isSyncing}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
        isOnline 
          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" 
          : "bg-yellow-500/20 text-yellow-400"
      }`}
      title={isOnline ? "Clique para sincronizar" : "Sem conexão"}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      )}
    </button>
  );
};
