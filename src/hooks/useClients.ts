import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { useFixedExpense } from "@/hooks/useFixedExpense";

export interface Client {
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

}



export const useClients = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOnline, saveClientsLocally, getCachedClients } = useOfflineStorage(userId);

  const { fixedExpense: FIXED_EXPENSE } = useFixedExpense();

  // Get cached data immediately for initial render
  const cachedClients = getCachedClients();

  const { data: clients = cachedClients, isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ["clients", userId],
    queryFn: async () => {
      // If no user, return empty
      if (!userId) {
        return [];
      }

      // If offline, return cached data immediately
      if (!navigator.onLine) {
        console.log("Offline: returning cached clients");
        return getCachedClients();
      }

      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", userId)
          .order("name", { ascending: true });

        if (error) throw error;
        return data as Client[];
      } catch (err) {
        // If fetch fails, use cache
        console.log("Fetch failed, using cached data:", err);
        return getCachedClients();
      }
    },
    // Don't retry when offline
    retry: isOnline ? 3 : 0,
    // Reduce stale time to get fresh data more often
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 60, // 1 hour
    enabled: !!userId,
    refetchOnMount: isOnline ? "always" : false,
    refetchOnWindowFocus: isOnline,
    // Use cached data immediately while fetching
    initialData: cachedClients.length > 0 ? cachedClients : undefined,
  });

  // Show loading only when online and no cached data
  const isLoading = queryLoading && isOnline && cachedClients.length === 0;

  // Save clients to local storage whenever they change
  useEffect(() => {
    if (clients && clients.length > 0) {
      saveClientsLocally(clients);
    }
  }, [clients, saveClientsLocally]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline) {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  }, [isOnline, queryClient]);

  // Real-time subscription
  useEffect(() => {
    if (!isOnline) return;

    const channel = supabase
      .channel("clients-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isOnline]);

  const addClient = useMutation({
    mutationFn: async (client: { name: string; phone: string; value_paid: number; due_day: number; virtual_chip?: boolean; is_resale?: boolean; bonus?: boolean; company?: string; account?: number | null; whatsapp?: string | null; data_gb?: number | null }) => {
      if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet");
      }

      if (!userId) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase
        .from("clients")
        .insert([{ ...client, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
      toast({
        title: "Cliente cadastrado!",
        description: "O cliente foi adicionado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error.message === "Sem conexão com a internet"
            ? "Você está offline. Conecte-se para cadastrar clientes."
            : "Não foi possível cadastrar o cliente.",
        variant: "destructive",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet");
      }

      if (!userId) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;

      // If 0 rows affected, the client no longer exists in the database
      // (likely a stale local cache entry). Treat as success so the cache resyncs.

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
      toast({
        title: "Cliente removido",
        description: "O cliente foi removido com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error.message === "Sem conexão com a internet"
            ? "Você está offline. Conecte-se para remover clientes."
            : error.message || "Não foi possível remover o cliente.",
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async (client: { id: string; name: string; phone: string; value_paid: number; due_day: number; bonus?: boolean; is_resale?: boolean; company?: string; account?: number | null; whatsapp?: string | null; data_gb?: number | null }) => {
      if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet");
      }

      if (!userId) {
        throw new Error("Você precisa estar logado");
      }

      // Always set user_id on update to "claim" legacy rows with user_id NULL
      // and satisfy the table policy that checks auth.uid() = user_id
      const updatePayload: Record<string, unknown> = {
        name: client.name,
        phone: client.phone,
        value_paid: client.value_paid,
        due_day: client.due_day,
        user_id: userId,
      };
      if (typeof client.bonus === "boolean") updatePayload.bonus = client.bonus;
      if (typeof client.is_resale === "boolean") updatePayload.is_resale = client.is_resale;
      if (typeof client.company === "string") updatePayload.company = client.company;
      if (client.account !== undefined) updatePayload.account = client.account;
      if (client.whatsapp !== undefined) updatePayload.whatsapp = client.whatsapp;
      if (client.data_gb !== undefined) updatePayload.data_gb = client.data_gb;


      const { data, error } = await supabase
        .from("clients")
        .update(updatePayload)
        .eq("id", client.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Não foi possível atualizar o cliente. Verifique suas permissões.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
      toast({
        title: "Cliente atualizado",
        description: "Os dados foram salvos com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error.message === "Sem conexão com a internet"
            ? "Você está offline. Conecte-se para atualizar clientes."
            : error.message || "Não foi possível atualizar o cliente.",
        variant: "destructive",
      });
    },
  });

  const toggleVirtualChip = useMutation({
    mutationFn: async ({ id, virtual_chip }: { id: string; virtual_chip: boolean }) => {
      if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet");
      }

      const { data, error } = await supabase
        .from("clients")
        .update({ virtual_chip })
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar.",
        variant: "destructive",
      });
    },
  });

  const toggleBlockClient = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet");
      }

      const { data, error } = await supabase
        .from("clients")
        .update({ blocked })
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients", userId] });
      toast({
        title: variables.blocked ? "Cliente bloqueado" : "Cliente desbloqueado",
        description: variables.blocked 
          ? "O cliente foi bloqueado com sucesso." 
          : "O cliente foi desbloqueado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de bloqueio.",
        variant: "destructive",
      });
    },
  });

  const activeClients = clients.filter(c => !c.name.toUpperCase().includes("CANCELADO"));
  const billableClients = activeClients.filter(c => !c.bonus);
  const totalGross = billableClients.reduce((sum, client) => sum + Number(client.value_paid), 0);
  const totalProfit = billableClients.reduce((sum, client) => sum + (Number(client.value_paid) - FIXED_EXPENSE), 0);

  return {
    clients,
    isLoading,
    isOnline,
    addClient,
    deleteClient,
    updateClient,
    toggleVirtualChip,
    toggleBlockClient,
    totalGross,
    totalProfit,
    fixedExpense: FIXED_EXPENSE,
    refetch,
  };
};
