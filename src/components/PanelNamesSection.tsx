import { useEffect, useState } from "react";
import { Loader2, Save, Store } from "lucide-react";
import { usePanelNames } from "@/hooks/usePanelNames";
import { useToast } from "@/hooks/use-toast";

interface PanelNamesSectionProps {
  userId?: string;
}

export const PanelNamesSection = ({ userId }: PanelNamesSectionProps) => {
  const { toast } = useToast();
  const { myLabel, others, loading, saveLabel } = usePanelNames(userId);
  const [mine, setMine] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setMine(myLabel ?? "RAIO TELECOM");
  }, [myLabel]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const panel of others) if (next[panel.userId] === undefined) next[panel.userId] = panel.label;
      return next;
    });
  }, [others]);

  const save = async (targetUserId: string, label: string) => {
    setSaving(targetUserId);
    try {
      await saveLabel(targetUserId, label);
      toast({ title: "Nome salvo!", description: label.trim().toUpperCase() });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar o nome.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">Painéis / Revenda</h3>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Meu painel</label>
        <div className="flex gap-2">
          <input
            value={mine}
            onChange={(e) => setMine(e.target.value)}
            maxLength={40}
            className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => userId && save(userId, mine)}
            disabled={!userId || saving === userId}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-purple-600 to-purple-800 text-white disabled:opacity-60"
          >
            {saving === userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {loading && others.length === 0 ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
        </div>
      ) : others.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma revenda ligada ainda. Quando alguém criar o painel de revenda, o nome aparece aqui para você definir.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Revendas</p>
          {others.map((panel) => (
            <div key={panel.userId} className="flex gap-2">
              <input
                value={drafts[panel.userId] ?? panel.label}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [panel.userId]: e.target.value }))}
                maxLength={40}
                className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => save(panel.userId, drafts[panel.userId] ?? panel.label)}
                disabled={saving === panel.userId}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 text-white disabled:opacity-60"
              >
                {saving === panel.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        O botão azul do topo mostra o nome do outro painel: no seu painel aparece o nome da revenda, e na revenda
        aparece o nome do seu painel.
      </p>
    </div>
  );
};
