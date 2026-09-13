import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light";

interface ThemeSettings {
  backgroundColor: string;
  mode: ThemeMode;
}

const STORAGE_KEY = "theme-settings";
const THEME_UPDATED_EVENT = "theme-settings-updated";

const DARK_COLORS = [
  { name: "Roxo Escuro Vivo", hsl: "250 55% 6%" },
  { name: "Roxo Vivo", hsl: "280 100% 30%" },
  { name: "Roxo", hsl: "262 83% 58%" },
  { name: "Azul", hsl: "220 80% 45%" },
  { name: "Verde", hsl: "160 70% 35%" },
  { name: "Vermelho", hsl: "0 70% 40%" },
  { name: "Rosa", hsl: "330 70% 45%" },
  { name: "Laranja", hsl: "25 80% 45%" },
  { name: "Ciano", hsl: "190 80% 40%" },
  { name: "Índigo", hsl: "240 70% 45%" },
  { name: "Esmeralda", hsl: "145 70% 35%" },
];

const LIGHT_COLORS = [
  { name: "Branco", hsl: "0 0% 100%" },
  { name: "Areia", hsl: "40 40% 96%" },
  { name: "Lilás Claro", hsl: "265 60% 96%" },
  { name: "Azul Claro", hsl: "210 70% 96%" },
  { name: "Verde Claro", hsl: "150 50% 95%" },
  { name: "Rosa Claro", hsl: "330 60% 96%" },
  { name: "Cinza Claro", hsl: "220 15% 95%" },
  { name: "Ciano Claro", hsl: "190 60% 95%" },
];

const DEFAULT_BG = "250 55% 6%";
const DEFAULT_LIGHT_BG = "0 0% 100%";
const LEGACY_DEFAULTS = ["262 83% 58%", "280 100% 30%"];

const parseHsl = (value: string) => {
  const [h, s, l] = value.split(" ");
  return {
    h: parseFloat(h) || 0,
    s: parseFloat((s || "0%").replace("%", "")) || 0,
    l: parseFloat((l || "0%").replace("%", "")) || 0,
  };
};

const setVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const applyTheme = ({ backgroundColor, mode }: ThemeSettings) => {
  const { h, s, l } = parseHsl(backgroundColor);
  const root = document.documentElement;

  if (mode === "light") {
    root.classList.add("light-mode");
    const cardL = Math.max(l - 3, 88);
    setVar("--background", `${h} ${Math.min(s, 40)}% ${Math.max(l, 94)}%`);
    setVar("--foreground", `${h} 25% 12%`);
    setVar("--card", `${h} ${Math.min(s, 30)}% ${cardL + 6 > 100 ? 100 : cardL + 6}%`);
    setVar("--card-foreground", `${h} 25% 12%`);
    setVar("--popover", `0 0% 100%`);
    setVar("--popover-foreground", `${h} 25% 12%`);
    setVar("--primary", `${h} 55% 45%`);
    setVar("--primary-foreground", `0 0% 100%`);
    setVar("--secondary", `${h} 30% 93%`);
    setVar("--secondary-foreground", `${h} 25% 15%`);
    setVar("--muted", `${h} 20% 92%`);
    setVar("--muted-foreground", `${h} 12% 38%`);
    setVar("--border", `${h} 20% 85%`);
    setVar("--input", `${h} 20% 90%`);
    setVar("--ring", `${h} 55% 50%`);
  } else {
    root.classList.remove("light-mode");
    const cardL = Math.min(l + 7, 70);
    setVar("--background", backgroundColor);
    setVar("--foreground", `0 0% 100%`);
    setVar("--card", `${h} ${Math.max(s - 10, 0)}% ${cardL}%`);
    setVar("--card-foreground", `0 0% 100%`);
    setVar("--popover", `${h} ${Math.max(s - 10, 0)}% ${cardL}%`);
    setVar("--popover-foreground", `0 0% 100%`);
    setVar("--primary", `${h} ${Math.max(s - 20, 0)}% ${Math.max(cardL - 5, 5)}%`);
    setVar("--primary-foreground", `0 0% 100%`);
    setVar("--secondary", `${h} ${Math.max(s - 20, 0)}% ${cardL + 5}%`);
    setVar("--secondary-foreground", `0 0% 100%`);
    setVar("--muted", `${h} ${Math.max(s - 25, 0)}% ${cardL + 9}%`);
    setVar("--muted-foreground", `${h} 20% 75%`);
    setVar("--border", `${h} ${Math.max(s - 20, 0)}% ${cardL + 7}%`);
    setVar("--input", `${h} ${Math.max(s - 20, 0)}% ${cardL + 5}%`);
    setVar("--ring", `${h} 70% 50%`);
  }
};

const readSettings = (): ThemeSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<ThemeSettings>;
      const mode: ThemeMode = parsed.mode === "light" ? "light" : "dark";
      let backgroundColor = parsed.backgroundColor || (mode === "light" ? DEFAULT_LIGHT_BG : DEFAULT_BG);
      if (mode === "dark" && LEGACY_DEFAULTS.includes(backgroundColor)) {
        backgroundColor = DEFAULT_BG;
      }
      return { backgroundColor, mode };
    } catch (e) {
      console.error("Error loading theme settings:", e);
    }
  }
  return { backgroundColor: DEFAULT_BG, mode: "dark" };
};

export const useThemeSettings = () => {
  const [settings, setSettings] = useState<ThemeSettings>(readSettings);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  useEffect(() => {
    const handleStorageChange = () => setSettings(readSettings());

    window.addEventListener(THEME_UPDATED_EVENT, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(THEME_UPDATED_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const saveSettings = useCallback((newSettings: ThemeSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      const current = readSettings();
      const backgroundColor = mode === "light" ? DEFAULT_LIGHT_BG : DEFAULT_BG;
      const next = { mode, backgroundColor };
      setSettings(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
      return current;
    },
    []
  );

  return {
    settings,
    saveSettings,
    setMode,
    colors: settings.mode === "light" ? LIGHT_COLORS : DARK_COLORS,
    darkColors: DARK_COLORS,
    lightColors: LIGHT_COLORS,
  };
};
