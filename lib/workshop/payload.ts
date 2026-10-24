/**
 * Строка для upsert в workshop_settings.
 *
 * Отдельная функция, потому что имена колонок и чисел должны совпадать: форма
 * присылает camelCase, база ждёт snake_case. Здесь это единственное место
 * перевода — если колонка переименуется, TypeScript подсветит поле сразу, а не
 * база ответит PGRST204 уже в проде.
 */
import type { WorkshopSettings } from "@/lib/workshop/settings";

/** Что уходит в `from("workshop_settings").upsert(...)`. */
export type WorkshopSettingsPayload = {
  user_id: string;
  electricity_cost_kwh: number;
  printer_power_w: number;
  depreciation_cost_hour: number;
  labor_cost_hour: number;
};

export function createWorkshopSettingsPayload(
  userId: string,
  settings: WorkshopSettings,
): WorkshopSettingsPayload {
  return {
    user_id: userId,
    electricity_cost_kwh: settings.electricityCostKwh,
    printer_power_w: settings.printerPowerW,
    depreciation_cost_hour: settings.depreciationCostHour,
    labor_cost_hour: settings.laborCostHour,
  };
}
