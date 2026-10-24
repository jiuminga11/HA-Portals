import { isAxiosError } from "axios";
import zh from "../locales/security.zh.json";
import en from "../locales/security.en.json";

export function isRevisionConflict(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409
    && error.response.data?.detail === "revision_conflict";
}
export function conflictMessage(locale: "zh" | "en"): string {
  return (locale === "en" ? en : zh).conflict;
}
