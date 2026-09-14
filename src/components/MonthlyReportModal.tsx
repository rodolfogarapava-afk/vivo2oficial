import { createPortal } from "react-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Client } from "@/hooks/useClients";
import {
  useMonthlyReport,
  monthLabel,
  currentMonthKey,
  ReportEntry,
} from "@/hooks/useMonthlyReport";

interface MonthlyReportModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  fixedExpense: number;
  userId?: string;
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const compactMoney = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const SummaryBox = ({
  title,
  value,
  colorClass,
}: {
  title: string;
  value: number;
  colorClass: string;
}) => (
  <div className="flex-1 rounded-xl bg-purple-900/70 border border-purple-700 px-2 py-2 text-center">
    <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wide">{title}</p>
    <p className={`text-sm font-extrabold tabular-nums ${colorClass}`}>{money(value)}</p>
  </div>
);

const ClientRows = ({
  title,
  entries,
  colorClass,
  emptyText,
}: {
  title: string;
  entries: ReportEntry[];
  colorClass: string;
  emptyText: string;
}) => (
  <div className="rounded-xl bg-purple-900/70 border border-purple-700 p-3">
    <h4 className={`mb-2 text-xs font-extrabold uppercase tracking-wide ${colorClass}`}>
      {title} ({entries.length})
    </h4>
    <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 rounded-lg bg-purple-950/40 px-2 py-2 text-white"
        >
          <span className="flex-1 text-left text-sm font-semibold whitespace-normal break-words">
            {entry.name}
          </span>
          <span className="shrink-0 text-xs font-bold text-purple-200 tabular-nums whitespace-nowrap">
            dia {entry.dueDay}
          </span>
          <span className="shrink-0 text-sm font-extrabold tabular-nums whitespace-nowrap">
            {money(entry.value)}
          </span>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="py-3 text-center text-xs text-purple-200">{emptyText}</p>
      )}
    </div>
  </div>
);

export const MonthlyReportModal = ({
  open,
  onClose,
  clients,
  fixedExpense,
  userId,
}: MonthlyReportModalProps) => {
  const {
    monthKey,
    report,
    isLoading,
    reload,
    isCurrentMonth,
    goPrevious,
    goNext,
    goToday,
  } = useMonthlyReport(clients, fixedExpense, userId);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-purple-800 rounded-2xl p-4 w-full max-w-md h-[85dvh] min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-purple-700 shrink-0"
            aria-label="Fechar relatório"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h3 className="flex-1 text-lg font-bold text-white">Ganhos</h3>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => void reload()}
            className="text-white hover:bg-purple-700 shrink-0"
            aria-label="Atualizar relatório"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-purple-900/70 border border-purple-700 px-2 py-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={goPrevious}
            className="text-white hover:bg-purple-700 shrink-0"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="flex-1 text-center text-sm font-extrabold text-white capitalize">
            {monthLabel(monthKey)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={goNext}
            disabled={isCurrentMonth}
            className="text-white hover:bg-purple-700 shrink-0 disabled:opacity-30"
            aria-label="Mês seguinte"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          {!isCurrentMonth && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={goToday}
              className="h-7 shrink-0 px-2 text-xs font-bold text-white hover:bg-purple-700"
            >
              Hoje
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-4 touch-pan-y">
          <div className="flex gap-2">
            <SummaryBox title="Recebido" value={report.received} colorClass="text-green-400" />
            <SummaryBox title="A receber" value={report.pending} colorClass="text-amber-400" />
            <SummaryBox title="Gastos" value={report.expenses} colorClass="text-red-400" />
          </div>

          <div className="rounded-xl bg-purple-900/70 border border-purple-700 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-purple-200">
                <TrendingUp className="h-4 w-4" />
                Lucro do mês
              </span>
              <span
                className={`text-xl font-extrabold tabular-nums ${
                  report.profit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {money(report.profit)}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-purple-200 tabular-nums">
              Previsto {money(report.expected)} • {report.billableCount} linhas pagantes • gasto
              fixo {money(fixedExpense)}
            </p>
          </div>

          <ClientRows
            title="Pago"
            entries={report.paidList}
            colorClass="text-green-400"
            emptyText="Ninguém pagou ainda neste mês."
          />

          <ClientRows
            title="Devendo"
            entries={report.owedList}
            colorClass="text-red-400"
            emptyText="Todos em dia neste mês."
          />

          <div className="rounded-xl bg-purple-900/70 border border-purple-700 p-3">
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-purple-200">
              Últimos {report.history.length} meses
            </h4>
            <div className="grid grid-cols-6 gap-1">
              {report.history.map((point) => (
                <div
                  key={point.key}
                  className={`min-w-0 rounded-lg px-1 py-2 text-center ${
                    point.key === monthKey ? "bg-purple-700" : "bg-purple-950/40"
                  }`}
                >
                  <p className="text-[9px] font-bold text-purple-200 uppercase">{point.label}</p>
                  <p
                    className="text-[10px] font-extrabold text-white tabular-nums"
                    title={money(point.total)}
                  >
                    {compactMoney(point.total)}
                  </p>
                </div>
              ))}
            </div>
            {monthKey > currentMonthKey() && (
              <p className="mt-2 text-[11px] text-purple-200">Mês futuro ainda sem pagamentos.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
