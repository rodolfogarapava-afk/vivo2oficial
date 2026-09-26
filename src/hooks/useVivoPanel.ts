import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatClientName } from "@/lib/formatName";

export const VIVO_PANEL_URL = "https://vivogestao.vivoempresas.com.br/Portal/data/login";

export interface PanelLine {
  group: string;
  groupId: number | null;
  name: string;
  phone: string;
  blocked: boolean;
}

export interface SyncPlan {
  toAdd: PanelLine[];
  toUpdate: Array<{ id: string; from: string; to: string; phone: string; blocked: boolean }>;
  unchanged: number;
  inReseller: number;
  notInPanel: Array<{ name: string; phone: string }>;
}

const digits = (value?: string | null) => (value ?? "").replace(/\D/g, "");

const panelName = (line: PanelLine) => {
  const clean = formatClientName(line.name);
  return clean.length > 0 ? clean : "LIVRE";
};

const isPlaceholder = (name: string) => !name.trim() || /^((REV\s+)?LIVRE|\d+)\b/i.test(name.trim());

export const useVivoPanel = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [lines, setLines] = useState<PanelLine[] | null>(null);

  const fetchLines = async (): Promise<PanelLine[] | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vivo-gestao", {
        body: { action: "sync" },
      });
      if (error) throw error;
      const result = (data as { lines?: PanelLine[]; error?: string }) ?? {};
      if (result.error) throw new Error(result.error);
      const fetched = (result.lines ?? []).filter((l) => digits(l.phone).length >= 10);
      setLines(fetched);
      if (fetched.length === 0) {
        toast({
          title: "Nenhuma linha encontrada",
          description: "O painel da Vivo não retornou linhas agora. Tente de novo em alguns minutos.",
          variant: "destructive",
        });
      }
      return fetched;
    } catch (err) {
      toast({
        title: "Não foi possível ler o painel",
        description: err instanceof Error ? err.message : "Tente novamente mais tarde.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const buildPlan = (
    panelLines: PanelLine[],
    clients: Array<{ id: string; name: string; phone: string }>,
    resellerPhones: Set<string> = new Set(),
  ): SyncPlan => {
    const byPhone = new Map<string, { id: string; name: string; phone: string }>();
    for (const c of clients) byPhone.set(digits(c.phone), c);

    const panelPhones = new Set<string>();
    const toAdd: PanelLine[] = [];
    const toUpdate: SyncPlan["toUpdate"] = [];
    let unchanged = 0;
    let inReseller = 0;

    for (const line of panelLines) {
      const phone = digits(line.phone);
      if (phone.length < 10 || panelPhones.has(phone)) continue;
      panelPhones.add(phone);
      const existing = byPhone.get(phone);
      const name = panelName(line);
      if (resellerPhones.has(phone)) {
        inReseller += 1;
      } else if (!existing) {
        toAdd.push({ ...line, phone, name });
      } else if (isPlaceholder(existing.name) && !isPlaceholder(name) && existing.name.trim().toUpperCase() !== name.toUpperCase()) {
        toUpdate.push({ id: existing.id, from: existing.name, to: name, phone, blocked: line.blocked });
      } else {
        unchanged += 1;
      }
    }

    const notInPanel = clients
      .filter((c) => !panelPhones.has(digits(c.phone)))
      .map((c) => ({ name: c.name, phone: c.phone }));

    return { toAdd, toUpdate, unchanged, inReseller, notInPanel };
  };

  const getResellerPhones = async (userId: string): Promise<Set<string>> => {
    const { data: links, error: linksError } = await supabase.from("panel_links")
      .select("partner_user_id").eq("owner_user_id", userId);
    if (linksError) throw linksError;
    const phones = new Set<string>();
    for (const link of links ?? []) {
      const { data, error } = await supabase.rpc("list_panel_clients", { p_panel_user: link.partner_user_id });
      if (error) throw error;
      for (const client of data ?? []) phones.add(digits(client.phone));
    }
    return phones;
  };

  const checkPlan = async (panelLines: PanelLine[], userId: string): Promise<SyncPlan> => {
    const { data: clients, error } = await supabase.from("clients")
      .select("id, name, phone").eq("user_id", userId);
    if (error) throw error;
    return buildPlan(panelLines, clients ?? [], await getResellerPhones(userId));
  };

  const applyPlan = async (userId: string, panelLines: PanelLine[]) => {
    setIsApplying(true);
    try {
      // The automatic sync or a reseller may have saved a number since the preview was shown.
      const fresh = await checkPlan(panelLines, userId);
      let added = 0;
      for (const line of fresh.toAdd) {
        const row = {
          user_id: userId,
          name: panelName(line),
          phone: line.phone,
          value_paid: 0,
          due_day: 10,
          blocked: line.blocked,
          company: "omega",
        };
        const { error } = await supabase.from("clients").insert(row);
        // Another sync may have inserted the same phone concurrently.
        if (error?.code === "23505") continue;
        if (error) throw error;
        added += 1;
      }

      for (const item of fresh.toUpdate) {
        const { error } = await supabase
          .from("clients")
          .update({ name: item.to, blocked: item.blocked })
          .eq("id", item.id).eq("user_id", userId);
        if (error) throw error;
      }

      toast({
        title: "Painel sincronizado!",
        description: `${added} linha(s) adicionada(s) e ${fresh.toUpdate.length} atualizada(s).`,
      });
      return true;
    } catch (err) {
      toast({
        title: "Erro ao sincronizar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsApplying(false);
    }
  };

  return { isLoading, isApplying, lines, fetchLines, checkPlan, applyPlan };
};
