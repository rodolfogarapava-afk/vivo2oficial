import { useCallback, useEffect, useState } from "react";

const LIST_KEY = "line_costs_list";
const MAP_KEY = "client_line_costs";
const EVENT = "line-costs-updated";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const getClientLineCost = (clientId: string): number | undefined => {
  const map = read<Record<string, number>>(MAP_KEY, {});
  const v = map[clientId];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

export const setClientLineCost = (clientId: string, cost: number | null) => {
  const map = read<Record<string, number>>(MAP_KEY, {});
  if (cost === null) delete map[clientId];
  else map[clientId] = cost;
  localStorage.setItem(MAP_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(EVENT));
};

export const clientCost = (clientId: string, fallback: number) =>
  getClientLineCost(clientId) ?? fallback;

export const useLineCosts = () => {
  const [list, setList] = useState<number[]>(() => read<number[]>(LIST_KEY, []));
  const [, setTick] = useState(0);

  useEffect(() => {
    const h = () => {
      setList(read<number[]>(LIST_KEY, []));
      setTick((t) => t + 1);
    };
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const save = useCallback((next: number[]) => {
    const clean = Array.from(new Set(next.filter((n) => Number.isFinite(n) && n >= 0))).sort((a, b) => a - b);
    localStorage.setItem(LIST_KEY, JSON.stringify(clean));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const addCost = useCallback((v: number) => save([...read<number[]>(LIST_KEY, []), v]), [save]);
  const removeCost = useCallback((v: number) => save(read<number[]>(LIST_KEY, []).filter((n) => n !== v)), [save]);

  return { list, addCost, removeCost };
};
