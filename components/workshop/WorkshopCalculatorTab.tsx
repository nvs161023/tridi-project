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
 *
 * На `lg:` обе части стоят в одной панели: настройки — 1/3, расчёт — 2/3.
 * На мобильном это одна колонка, поэтому ширина и отступы общие.
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
    <div className="space-y-4">
      {isMissingTable ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Настройки пока не сохраняются: в базе нет таблицы workshop_settings.
          Расчёт работает со значениями по умолчанию — примените миграцию
          supabase/workshop_settings.sql.
        </p>
      ) : null}

      <div
        data-calculator-layout
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_-48px_rgba(59,130,246,0.45)] backdrop-blur-md"
      >
        <div className="grid lg:grid-cols-3">
          <div
            data-calculator-settings
            className="border-b border-white/10 p-5 sm:p-7 lg:border-r lg:border-b-0"
          >
            <WorkshopSettingsForm settings={settings} onSaved={setSettings} />
          </div>
          <div
            data-calculator-panel
            className="p-5 sm:p-7 lg:col-span-2"
          >
            <CostCalculator settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
}
