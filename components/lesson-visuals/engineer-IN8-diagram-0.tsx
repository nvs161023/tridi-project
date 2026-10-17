import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { title: "меш", note: "STL со скана", accent: "#94a3b8" },
  { title: "чистка", note: "20–30 минут", accent: "#38bdf8" },
  { title: "тело", note: "BRep и грани", accent: "#34d399" },
  { title: "параметры", note: "L · W · H · t", accent: "#a78bfa" },
  { title: "проверка", note: "4 прохода", accent: "#fbbf24" },
  { title: "STEP", note: "и 3MF", accent: "#f472b6" },
];

/**
 * Кадр блока 3 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Макет из описания `IN8_mesh_to_cad.png`: конвейер из шести шагов в две строки
 * по три — меш, чистка, тело, параметры, проверка, STEP. Подписи шагов взяты из
 * блоков 2, 5, 15, 23, 27 и 28, внизу — правило урока из блока 2.
 */
export function EngineerIN8Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь от меша к детали в шесть шагов: меш со скана, чистка за 20–30 минут, тело BRep, параметры L, W, H и t, проверка в четыре прохода, экспорт STEP и 3MF. Упрощение идёт с миллиона до ста тысяч треугольников. Скан — калька: деталь начинается в CAD"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          путь от меша к детали: шесть шагов
        </text>

        <defs>
          <marker id="in8-0-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {STEPS.map((step, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 12 + col * 100;
          const y = 26 + row * 48;
          return (
            <g key={step.title}>
              <rect x={x} y={y} width="88" height="40" rx="7" fill="#0f172a" fillOpacity="0.5" stroke="#334155" />
              <rect x={x} y={y} width="88" height="2.5" rx="1.2" fill={step.accent} fillOpacity="0.85" />
              <text x={x + 7} y={y + 16} fontSize="10" fontWeight="700" fill={step.accent}>
                {step.title}
              </text>
              <text x={x + 7} y={y + 31} fontSize="10" fill="#cbd5e1">
                {step.note}
              </text>
            </g>
          );
        })}

        {/* Стрелки внутри строк */}
        <path d="M100 46 h8" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-0-arrow)" />
        <path d="M200 46 h8" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-0-arrow)" />
        <path d="M100 94 h8" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-0-arrow)" />
        <path d="M200 94 h8" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-0-arrow)" />
        {/* Переход на вторую строку */}
        <path d="M256 66 V70 H56 V74" fill="none" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-0-arrow)" />

        <text x="12" y="128" fontSize="10" fill="#cbd5e1">
          чистка 20–30 минут · упрощение 1 млн → 100 тыс
        </text>
        <text x="12" y="144" fontSize="10" fill="#cbd5e1">
          тело — BRep: грани, дуги и единицы
        </text>

        <rect x="12" y="152" width="296" height="20" rx="6" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.4" />
        <text x="22" y="165" fontSize="10" fill="#fbbf24">
          скан — калька: деталь начинается в CAD
        </text>
      </svg>
    </VisualWrapper>
  );
}
