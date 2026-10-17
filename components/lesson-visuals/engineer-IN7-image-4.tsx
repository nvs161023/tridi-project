import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PIPELINE = [
  "облако 1 млн точек",
  "фильтр шума",
  "склейка по меткам",
  "мелкие дыры закрыть",
  "упрощение до 200–300 тыс.",
  "STL или 3MF на выходе",
];

const CASE_ROWS = ["42 кадра", "1,2 млн точек", "260 тыс. после", "отверстия 3,1 мм", "замером, не сканом"];

/**
 * Кадр блока 27 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_pointcloud_mesh.png`: конвейер обработки от облака на
 * миллион точек до файла STL или 3MF, шаги из блоков 24 и 26. Справа кейс из
 * блока 25 — 42 кадра, 1,2 млн точек, после упрощения 260 тысяч, а отверстия
 * всё равно замеряют инструментом.
 */
export function EngineerIN7Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Конвейер обработки облака точек: облако на миллион точек, фильтр шума, склейка по меткам, закрытие мелких дыр, упрощение до 200–300 тысяч полигонов, выгрузка в STL или 3MF. Кейс: 42 кадра дали 1,2 миллиона точек, после упрощения осталось 260 тысяч, но отверстия 3,1 миллиметра всё равно замеряют инструментом. Порядок важен: шум, склейка, упрощение"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          конвейер обработки: от 1 млн точек к 260 тыс.
        </text>

        {/* Шаги конвейера */}
        <line x1="22" y1="32" x2="22" y2="134" stroke="#334155" strokeWidth="1.2" />
        {PIPELINE.map((step, i) => {
          const cy = 32 + i * 20;
          const accent = i === PIPELINE.length - 1 ? "#fbbf24" : "#38bdf8";
          return (
            <g key={step}>
              <circle cx="22" cy={cy} r="6.5" fill="#0f172a" stroke={accent} strokeWidth="1.2" />
              <text x="22" y={cy + 4} fontSize="10" fontWeight="700" fill={accent} textAnchor="middle">
                {i + 1}
              </text>
              <text x="36" y={cy + 4} fontSize="10" fill={i === PIPELINE.length - 1 ? "#fbbf24" : "#cbd5e1"}>
                {step}
              </text>
            </g>
          );
        })}

        {/* Кейс из блока 25 */}
        <rect x="192" y="26" width="116" height="106" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="202" y="42" fontSize="10" fill="#94a3b8">
          кейс: накладка
        </text>
        {CASE_ROWS.map((row, i) => (
          <text key={row} x="202" y={58 + i * 14} fontSize="10" fill={i === CASE_ROWS.length - 1 ? "#fca5a5" : "#e2e8f0"} fontWeight={i === 0 ? 700 : 400}>
            {row}
          </text>
        ))}

        <text x="12" y="154" fontSize="10" fill="#cbd5e1">
          порядок важен: шум → склейка → упрощение
        </text>
        <text x="12" y="170" fontSize="10" fill="#94a3b8">
          STL — геометрия, 3MF — ещё и цвет
        </text>
      </svg>
    </VisualWrapper>
  );
}
