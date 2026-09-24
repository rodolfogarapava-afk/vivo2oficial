import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY_PREFIX = "cliente-vivo-offline-data";

export interface OfflineClient {
  id: string;
  name: string;
  phone: string;
  value_paid: number;
  due_day: number;
  created_at: string;
  virtual_chip: boolean;
  blocked: boolean;
  is_resale: boolean;
  bonus: boolean;
  company?: string;
  account?: number | null;
  whatsapp?: string | null;
  data_gb?: number | null;
  data_used_gb?: number | null;
  line_cost?: number | null;
}


interface OfflineData {
  clients: OfflineClient[];
  lastSync: string | null;
}

export const useOfflineStorage = (userId?: string) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData>({ clients: [], lastSync: null });

  const storageKey = useMemo(() => {
    // Important: cache MUST be scoped per user to avoid showing another account's data.
    if (!userId) return null;
    return `${STORAGE_KEY_PREFIX}:${userId}`;
  }, [userId]);

  // Monitor online/offline status
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

  // Load offline data whenever user changes
  useEffect(() => {
    if (!storageKey) {
      setOfflineData({ clients: [], lastSync: null });
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setOfflineData(JSON.parse(stored));
      } else {
        setOfflineData({ clients: [], lastSync: null });
      }
    } catch (error) {
      console.error("Error loading offline data:", error);
      setOfflineData({ clients: [], lastSync: null });
    }
  }, [storageKey]);

  // Save clients to local storage
  const saveClientsLocally = useCallback(
    (clients: OfflineClient[]) => {
      if (!storageKey) return;

      try {
        const data: OfflineData = {
          clients,
          lastSync: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
        setOfflineData(data);
      } catch (error) {
        console.error("Error saving offline data:", error);
      }
    },
    [storageKey]
  );

  // Get cached clients
  const getCachedClients = useCallback((): OfflineClient[] => {
    if (!storageKey) return [];

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: OfflineData = JSON.parse(stored);
        return data.clients;
      }
    } catch (error) {
      console.error("Error reading cached clients:", error);
    }

    return [];
  }, [storageKey]);

  const clearCachedClients = useCallback(() => {
    if (!storageKey) {
      setOfflineData({ clients: [], lastSync: null });
      return;
    }

    try {
      localStorage.removeItem(storageKey);
    } finally {
      setOfflineData({ clients: [], lastSync: null });
    }
  }, [storageKey]);

  // Get last sync time
  const getLastSync = useCallback((): string | null => {
    return offlineData.lastSync;
  }, [offlineData.lastSync]);

  return {
    isOnline,
    saveClientsLocally,
    getCachedClients,
    clearCachedClients,
    getLastSync,
    cachedClients: offlineData.clients,
  };
};

