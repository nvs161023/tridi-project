"use client";

import { useState } from "react";

import { CostCalculator } from "@/components/workshop/CostCalculator";
import { WorkshopSettingsForm } from "@/components/workshop/WorkshopSettingsForm";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Вкладка «Калькулятор».
 *
 * Настройки хранятся здесь, а не внутри формы: после сохранения форма отдаёт
 * новые значения наверх, и калькулятор сразу считает по ним. Без этого
 * приходилось бы перезагружать страницу, чтобы увидеть эффект нового тарифа.
 */

type WorkshopCalculatorTabProps = {
  initialSettings: WorkshopSettings;
  isMissingTable: boolean;
};

export function WorkshopCalculatorTab({
  initialSettings,
  isMissingTable,
}: WorkshopCalculatorTabProps) {
  const [settings, setSettings] = useState(initialSettings);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {isMissingTable ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100 lg:col-span-2"
        >
          <span aria-hidden>⚠️ </span>
          Настройки пока не сохраняются: в базе нет таблицы workshop_settings.
          Расчёт работает со значениями по умолчанию — примените миграцию
          supabase/workshop_settings.sql.
        </p>
      ) : null}

      <WorkshopSettingsForm settings={settings} onSaved={setSettings} />
      <CostCalculator settings={settings} />
    </div>
  );
}
