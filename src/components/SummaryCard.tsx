import { useState } from "react";
import { CalendarCog, Check } from "lucide-react";
import { ALL_DUE_DAYS, useVisibleDueDays } from "@/lib/dueDays";

export interface DayStat {
  day: number;
  clients: number;
  total: number;
  remaining: number;
}

interface SummaryCardProps {
  totalClients: number;
  totalExpenses: number;
  totalProfit: number;
  totalGross: number;
  onNewClient: () => void;
  days: DayStat[];
  selectedDueDay: number | null;
  onSelectDueDay: (day: number | null) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getDayColors = (_day: number, selected: boolean) => {
  return selected
    ? "bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-[0_4px_0_0_#9a3412] ring-2 ring-white/40"
    : "bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-[0_4px_0_0_#9a3412]";
};

export const SummaryCard = ({
  days,
  selectedDueDay,
  onSelectDueDay,
}: SummaryCardProps) => {
  const { visibleDays, toggleDay } = useVisibleDueDays();
  const [editDays, setEditDays] = useState(false);

  const gridCols =
    days.length <= 2 ? "grid-cols-2" : days.length === 3 ? "grid-cols-3" : days.length === 4 ? "grid-cols-4" : days.length === 5 ? "grid-cols-5" : "grid-cols-6";

  return (
    <div className="mx-3 rounded-2xl border border-purple-900/50 bg-card/40 p-3 backdrop-blur-sm">
      {/* Header: edit visible days */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold tracking-widest text-purple-300/80 uppercase">Vencimentos</p>
        <button
          onClick={() => setEditDays((v) => !v)}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase transition-all ${
            editDays
              ? "bg-purple-600 border-purple-400 text-white"
              : "bg-purple-950/40 border-purple-800/60 text-purple-200"
          }`}
        >
          <CalendarCog className="h-3.5 w-3.5" />
          Datas
        </button>
      </div>

      {editDays && (
        <div className="mb-3 grid grid-cols-6 gap-1.5 rounded-xl border border-purple-800/50 bg-purple-950/30 p-2">
          {ALL_DUE_DAYS.map((day) => {
            const active = visibleDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`relative flex h-9 items-center justify-center rounded-lg text-sm font-extrabold transition-all ${
                  active
                    ? "bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-[0_3px_0_0_#9a3412]"
                    : "bg-purple-900/40 text-purple-400 border border-purple-800/60"
                }`}
              >
                {day}
                {active && (
                  <Check className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 p-0.5 text-white" strokeWidth={4} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Day cards */}
      <div className={`grid ${gridCols} gap-1.5`}>
        {days.map(({ day, clients, total }) => {
          const selected = selectedDueDay === day;
          return (
            <button
              key={day}
              onClick={() => onSelectDueDay(selected ? null : day)}
              className={`flex flex-col items-center justify-between rounded-xl border p-1.5 gap-1 transition-all ${
                selected
                  ? "bg-card border-purple-400 ring-1 ring-purple-400"
                  : "bg-purple-950/30 border-purple-900/40 hover:border-purple-700"
              }`}
            >
              <span className="text-[8px] font-bold text-white truncate w-full text-center">{formatCurrency(total)}</span>
              <div className={`flex items-center justify-center h-11 w-11 rounded-xl font-extrabold text-xl ${getDayColors(day, selected)}`}>
                {day}
              </div>
              <div className="w-full h-px bg-purple-800/50 my-0.5" />
              <p className="text-[8px] font-bold text-purple-300 uppercase leading-none">Clientes</p>
              <span className="text-[11px] font-extrabold text-white leading-none">{clients}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
