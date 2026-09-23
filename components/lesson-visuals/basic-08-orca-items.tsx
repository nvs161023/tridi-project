import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 8 · image «Меню калибровки в Orca» (Модуль 2: Настройка печати).
 *
 * Из описания блока: скриншот Orca Slicer с открытым меню Calibration и шестью
 * пунктами: Temperature, Flow Rate, Pressure Advance, Max Flow, Retraction,
 * Tolerance — каждый с иконкой тестовой модели.
 */
const ITEMS = [
  { en: "Temperature", ru: "Температура", icon: "bridge" },
  { en: "Flow Rate", ru: "Поток", icon: "wall" },
  { en: "Pressure Advance", ru: "Давление", icon: "corner" },
  { en: "Max Flow", ru: "Макс. поток", icon: "tear" },
  { en: "Retraction", ru: "Ретракт", icon: "towers" },
  { en: "Tolerance", ru: "Допуск", icon: "hole" },
];

function Testicon({ kind, x, y }: { kind: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {kind === "bridge" && (
        <>
          <rect x="2" y="10" width="4" height="8" fill="#3b82f6" />
          <rect x="16" y="10" width="4" height="8" fill="#3b82f6" />
          <rect x="1" y="6" width="20" height="4" fill="#93c5fd" />
        </>
      )}
      {kind === "wall" && (
        <>
          <rect x="10" y="2" width="4" height="16" fill="#3b82f6" />
          <circle cx="12" cy="20" r="2" fill="#93c5fd" />
        </>
      )}
      {kind === "corner" && (
        <>
          <path d="M2 18 V4 H18" fill="none" stroke="#3b82f6" strokeWidth="3" />
          <rect x="16" y="14" width="6" height="6" fill="#93c5fd" />
        </>
      )}
      {kind === "tear" && (
        <>
          <rect x="2" y="4" width="20" height="3" fill="#3b82f6" />
          <rect x="6" y="9" width="5" height="3" fill="#93c5fd" />
          <rect x="14" y="9" width="6" height="3" fill="#93c5fd" />
        </>
      )}
      {kind === "towers" && (
        <>
          <rect x="1" y="8" width="6" height="12" fill="#3b82f6" />
          <rect x="17" y="8" width="6" height="12" fill="#3b82f6" />
          <path d="M7 12 C 12 8 14 16 17 12" fill="none" stroke="#f59e0b" />
        </>
      )}
      {kind === "hole" && (
        <>
          <rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="12" cy="11" r="3.5" fill="none" stroke="#93c5fd" />
        </>
      )}
    </g>
  );
}

export function Basic08OrcaItems({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Меню Calibration в Orca Slicer: Temperature, Flow Rate, Pressure Advance, Max Flow, Retraction, Tolerance"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <rect x="8" y="10" width="304" height="162" rx="5" fill="#0f172a" stroke="#475569" />
        <rect x="8" y="10" width="304" height="18" rx="5" fill="#1e293b" />
        <text x="18" y="23" fontSize="8" fill="#e2e8f0">
          Orca Slicer · меню Calibration
        </text>
        {ITEMS.map((item, i) => {
          const y = 52 + i * 20;
          return (
            <g key={item.en}>
              <rect x="18" y={y - 14} width="284" height="18" rx="2" fill={i === 0 ? "#152036" : "#0b1220"} />
              <Testicon kind={item.icon} x={24} y={y - 14} />
              <text x="58" y={y - 1} fontSize="8" fill="#e2e8f0">
                {item.en}
              </text>
              <text x="176" y={y - 1} fontSize="7.5" fill="#93c5fd">
                {item.ru}
              </text>
            </g>
          );
        })}
        <text x="18" y="166" fontSize="6.5" fill="#64748b">
          каждый пункт — со своей тестовой моделью
        </text>
      </svg>
    </VisualWrapper>
  );
}
