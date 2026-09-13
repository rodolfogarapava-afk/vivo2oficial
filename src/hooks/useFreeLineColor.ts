import { useCallback, useEffect, useState } from "react";

export type FreeLineColor = "light" | "dark";

const STORAGE_KEY = "free_line_color";
const EVENT = "free-line-color-updated";

const read = (): FreeLineColor => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const useFreeLineColor = () => {
  const [color, setColorState] = useState<FreeLineColor>(read);

  useEffect(() => {
    const sync = () => setColorState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setColor = useCallback((next: FreeLineColor) => {
    setColorState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { freeLineColor: color, setFreeLineColor: setColor };
};

export const isFreeLine = (name: string) => name.trim().toUpperCase().startsWith("LIVRE");
