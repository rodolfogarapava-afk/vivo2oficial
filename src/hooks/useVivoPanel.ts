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
  notInPanel: Array<{ name: string; phone: string }>;
}

const digits = (value?: string | null) => (value ?? "").replace(/\D/g, "");

const panelName = (line: PanelLine) => {
  const clean = formatClientName(line.name);
  return clean.length > 0 ? clean : "LIVRE";
};

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
  ): SyncPlan => {
    const byPhone = new Map<string, { id: string; name: string; phone: string }>();
    for (const c of clients) byPhone.set(digits(c.phone), c);

    const panelPhones = new Set<string>();
    const toAdd: PanelLine[] = [];
    const toUpdate: SyncPlan["toUpdate"] = [];
    let unchanged = 0;

    for (const line of panelLines) {
      const phone = digits(line.phone);
      panelPhones.add(phone);
      const existing = byPhone.get(phone);
      const name = panelName(line);
      if (!existing) {
        toAdd.push({ ...line, phone, name });
      } else if (existing.name.trim().toUpperCase() !== name.toUpperCase()) {
        toUpdate.push({ id: existing.id, from: existing.name, to: name, phone, blocked: line.blocked });
      } else {
        unchanged += 1;
      }
    }

    const notInPanel = clients
      .filter((c) => !panelPhones.has(digits(c.phone)))
      .map((c) => ({ name: c.name, phone: c.phone }));

    return { toAdd, toUpdate, unchanged, notInPanel };
  };

  const applyPlan = async (plan: SyncPlan, userId: string) => {
    setIsApplying(true);
    try {
      if (plan.toAdd.length > 0) {
        const rows = plan.toAdd.map((line) => ({
          user_id: userId,
          name: panelName(line),
          phone: line.phone,
          value_paid: 0,
          due_day: 10,
          blocked: line.blocked,
          company: "omega",
        }));
        const { error } = await supabase.from("clients").insert(rows);
        if (error) throw error;
      }

      for (const item of plan.toUpdate) {
        const { error } = await supabase
          .from("clients")
          .update({ name: item.to, blocked: item.blocked, user_id: userId })
          .eq("id", item.id);
        if (error) throw error;
      }

      toast({
        title: "Painel sincronizado!",
        description: `${plan.toAdd.length} linha(s) adicionada(s) e ${plan.toUpdate.length} atualizada(s).`,
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

  return { isLoading, isApplying, lines, fetchLines, buildPlan, applyPlan };
};
