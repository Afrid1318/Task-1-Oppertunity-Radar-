const STORAGE_KEY = "opportunity-radar-target-service";

export const DEFAULT_TARGET_SERVICE =
  "B2B SaaS platform for sales automation, CRM integration, and lead intelligence";

export function getTargetService(): string {
  if (typeof window === "undefined") return DEFAULT_TARGET_SERVICE;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TARGET_SERVICE;
}

export function setTargetService(value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value);
}
