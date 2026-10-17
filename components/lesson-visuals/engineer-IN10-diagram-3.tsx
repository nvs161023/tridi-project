import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CALIBRATIONS = [
  {
    name: "BED_MESH_CALIBRATE",
    accent: "#38bdf8",
    lines: ["карта высот стола", "лист · сопло · пружины"],
  },
  {
    name: "PID_CALIBRATE",
    accent: "#fbbf24",
    lines: ["коэффициенты нагрева", "сопло · стол · термопара"],
  },
  {
    name: "SHAPER_CALIBRATE",
    accent: "#a78bfa",
    lines: ["гасит резонансы осей", "переезд · ремни"],
  },
];

/**
 * Кадр блока 21 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_calibration_map.png`: что от чего зависит и что обнуляет
 * старые значения. Три макроса и сроки их годности — блок 18, условия и
 * SAVE_CONFIG — блок 19, калибровка на горячем столе — блок 20.
 */
export function EngineerIN10Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта калибровок: BED_MESH_CALIBRATE строит карту высот стола и сбрасывается после смены листа, сопла или пружин; PID_CALIBRATE подбирает коэффициенты нагрева отдельно для сопла и стола и сбрасывается после замены нагревателя или термопары; SHAPER_CALIBRATE гасит резонансы осей и сбрасывается после переезда принтера или смены ремней. Калибровать на рабочей температуре, сохранять через SAVE_CONFIG, проверять тестовым первым слоем"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          карта калибровок: три макроса
        </text>

        {CALIBRATIONS.map((item, i) => {
          const y = 22 + i * 40;
          return (
            <g key={item.name}>
              <rect x="12" y={y} width="296" height="36" rx="6" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
              <rect x="12" y={y} width="3" height="36" rx="1.5" fill={item.accent} fillOpacity="0.85" />
              <text x="22" y={y + 20} fontSize="10" fontWeight="700" fill={item.accent}>
                {item.name}
              </text>
              <text x="146" y={y + 14} fontSize="10" fill="#e2e8f0">
                {item.lines[0]}
              </text>
              <text x="146" y={y + 29} fontSize="10" fill="#94a3b8">
                {item.lines[1]}
              </text>
            </g>
          );
        })}

        <rect x="12" y="142" width="296" height="32" rx="6" fill="#34d399" fillOpacity="0.08" stroke="#34d399" strokeOpacity="0.3" />
        <text x="22" y="155" fontSize="10" fill="#e2e8f0">
          калибруй на рабочей температуре
        </text>
        <text x="22" y="169" fontSize="10" fill="#94a3b8">
          SAVE_CONFIG · тестовый первый слой
        </text>
      </svg>
    </VisualWrapper>
  );
}
