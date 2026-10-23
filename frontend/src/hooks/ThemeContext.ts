import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark"; // actual applied theme
}

export const ThemeContext = createContext<ThemeContextType | null>(null);
