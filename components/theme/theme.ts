export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pastavisa-theme";

export function nextTheme(current: string | undefined): Theme {
  return current === "dark" ? "light" : "dark";
}
