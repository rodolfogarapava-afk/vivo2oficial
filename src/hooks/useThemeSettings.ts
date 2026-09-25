import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light";
export type NeonLayout = "blue" | "red";

interface ThemeSettings {
  backgroundColor: string;
  mode: ThemeMode;
  buttonColor?: string;
  clientCardPurple?: number;
  clientCardText?: "black" | "white";
  clientCardStyleVersion?: number;
  neonLayout?: NeonLayout;
}

const STORAGE_KEY = "theme-settings";
const THEME_UPDATED_EVENT = "theme-settings-updated";
const CLIENT_CARD_STYLE_VERSION = 2;

const BUTTON_COLORS = [
  { name: "Padrão", hsl: "" },
  { name: "Verde", hsl: "145 65% 38%" },
  { name: "Azul", hsl: "215 80% 48%" },
  { name: "Roxo", hsl: "265 70% 50%" },
  { name: "Rosa", hsl: "330 70% 50%" },
  { name: "Vermelho", hsl: "0 70% 48%" },
  { name: "Laranja", hsl: "25 85% 48%" },
  { name: "Ciano", hsl: "190 80% 42%" },
  { name: "Âmbar", hsl: "42 90% 48%" },
  { name: "Grafite", hsl: "220 12% 30%" },
];


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
  { name: "Creme", hsl: "45 70% 95%" },
  { name: "Pêssego", hsl: "20 70% 94%" },
  { name: "Menta", hsl: "165 55% 94%" },
  { name: "Amarelo Claro", hsl: "50 85% 94%" },
  { name: "Laranja Claro", hsl: "30 85% 94%" },
  { name: "Coral Claro", hsl: "5 70% 95%" },
  { name: "Lavanda", hsl: "250 55% 95%" },
  { name: "Uva Claro", hsl: "285 50% 95%" },
  { name: "Céu", hsl: "200 80% 94%" },
  { name: "Turquesa Claro", hsl: "180 55% 94%" },
  { name: "Oliva Claro", hsl: "80 40% 94%" },
  { name: "Gelo", hsl: "220 40% 97%" },
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

const applyTheme = ({ backgroundColor, mode, buttonColor, clientCardPurple = 0, clientCardText = "black", neonLayout = "blue" }: ThemeSettings) => {
  const { h, s, l } = parseHsl(backgroundColor);
  const root = document.documentElement;
  const cardPurple = Math.min(100, Math.max(0, clientCardPurple));
  const mix = cardPurple / 100;

  root.classList.toggle("neon-layout-blue", neonLayout === "blue");
  root.classList.toggle("neon-layout-red", neonLayout === "red");

  setVar("--client-card-bg", `270 ${Math.round(78 * mix)}% ${Math.round(100 - 62 * mix)}%`);
  setVar("--client-card-foreground", clientCardText === "white" ? "0 0% 100%" : "0 0% 4%");

  if (buttonColor) {
    root.classList.add("custom-buttons");
    setVar("--btn", buttonColor);
  } else {
    root.classList.remove("custom-buttons");
  }



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

  if (neonLayout === "red") {
    setVar("--background", "355 82% 5%");
    setVar("--card", "355 82% 8%");
    setVar("--primary", "354 92% 45%");
    setVar("--border", "0 100% 50%");
    setVar("--ring", "0 100% 56%");
    setVar("--client-card-bg", "355 76% 17%");
    setVar("--client-card-border", "13 100% 55%");
    setVar("--client-card-deep", "357 91% 30%");
    setVar("--client-card-muted", "28 100% 72%");
    setVar("--client-card-highlight", "32 100% 52%");
    setVar("--client-card-shadow", "0 100% 27%");
    setVar("--client-card-glow", "0 100% 55%");
  } else {
    setVar("--background", "221 82% 5%");
    setVar("--card", "221 82% 8%");
    setVar("--primary", "214 100% 48%");
    setVar("--border", "194 100% 46%");
    setVar("--ring", "194 100% 52%");
    setVar("--client-card-bg", "216 78% 17%");
    setVar("--client-card-border", "184 100% 55%");
    setVar("--client-card-deep", "235 88% 38%");
    setVar("--client-card-muted", "194 100% 82%");
    setVar("--client-card-highlight", "190 100% 52%");
    setVar("--client-card-shadow", "205 100% 30%");
    setVar("--client-card-glow", "185 100% 55%");
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
      const needsActivatedCardUpdate = parsed.clientCardStyleVersion !== CLIENT_CARD_STYLE_VERSION;
      const settings: ThemeSettings = {
        backgroundColor,
        mode,
        buttonColor: parsed.buttonColor || "",
        clientCardPurple: needsActivatedCardUpdate
          ? 75
          : Math.min(100, Math.max(0, Number(parsed.clientCardPurple) || 0)),
        clientCardText: needsActivatedCardUpdate || parsed.clientCardText === "white" ? "white" : "black",
        clientCardStyleVersion: CLIENT_CARD_STYLE_VERSION,
        neonLayout: parsed.neonLayout === "red" ? "red" : "blue",
      };
      if (needsActivatedCardUpdate) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
      return settings;
    } catch (e) {
      console.error("Error loading theme settings:", e);
    }
  }
  return {
    backgroundColor: DEFAULT_BG,
    mode: "dark",
    buttonColor: "",
    clientCardPurple: 75,
    clientCardText: "white",
    clientCardStyleVersion: CLIENT_CARD_STYLE_VERSION,
    neonLayout: "blue",
  };

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
    const current = readSettings();
    const next = { ...current, ...newSettings };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setButtonColor = useCallback((buttonColor: string) => {
    const current = readSettings();
    const next = { ...current, buttonColor };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setClientCardPurple = useCallback((clientCardPurple: number) => {
    const current = readSettings();
    const next = { ...current, clientCardPurple: Math.min(100, Math.max(0, clientCardPurple)) };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setClientCardText = useCallback((clientCardText: "black" | "white") => {
    const current = readSettings();
    const next = { ...current, clientCardText };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setNeonLayout = useCallback((neonLayout: NeonLayout) => {
    const current = readSettings();
    const next = { ...current, mode: "dark" as ThemeMode, backgroundColor: DEFAULT_BG, neonLayout };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      const current = readSettings();
      const backgroundColor = mode === "light" ? DEFAULT_LIGHT_BG : DEFAULT_BG;
      const next = { ...current, mode, backgroundColor };
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
    setButtonColor,
    setClientCardPurple,
    setClientCardText,
    setNeonLayout,
    colors: settings.mode === "light" ? LIGHT_COLORS : DARK_COLORS,
    darkColors: DARK_COLORS,
    lightColors: LIGHT_COLORS,
    buttonColors: BUTTON_COLORS,
  };

};
