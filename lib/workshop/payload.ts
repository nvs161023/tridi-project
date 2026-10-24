/**
 * Строки для записи в таблицы Мастерской.
 *
 * Отдельные функции, потому что имена колонок и чисел должны совпадать: форма
 * присылает camelCase, база ждёт snake_case. Здесь единственное место перевода
 * — если колонка переименуется, TypeScript подсветит поле сразу, а не база
 * ответит PGRST204 уже в проде.
 */
import type { FilamentDraft } from "@/lib/workshop/filaments";
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

/** Что уходит в `from("workshop_filaments").insert(...)`. */
export type WorkshopFilamentPayload = {
  user_id: string;
  brand: string;
  type: string;
  color: string;
  total_weight_g: number;
  remaining_weight_g: number;
  price_per_kg: number;
  min_threshold_g: number;
  purchase_url: string | null;
};

/**
 * Новая катушка. Пустая ссылка превращается в null: в базе это «ссылки нет», а
 * не пустая строка, иначе кнопка «Купить» вела бы на пустоту.
 */
export function createFilamentPayload(
  userId: string,
  draft: FilamentDraft,
): WorkshopFilamentPayload {
  return {
    user_id: userId,
    brand: draft.brand,
    type: draft.type,
    color: draft.color,
    total_weight_g: draft.totalWeightG,
    remaining_weight_g: draft.remainingWeightG,
    price_per_kg: draft.pricePerKg,
    min_threshold_g: draft.minThresholdG,
    purchase_url: draft.purchaseUrl || null,
  };
}
