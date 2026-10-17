import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const FITS = [
  { name: "скользящая", range: "0,2–0,5 мм", example: "ось, втулка", accent: "#34d399" },
  { name: "переходная", range: "0,05–0,1 мм", example: "крышка", accent: "#38bdf8" },
  { name: "прессовая", range: "натяг винтом", example: "не размером", accent: "#a78bfa" },
];

/**
 * Кадр блока 18 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_tolerance_fit.png`: три ходовые посадки из блока 17
 * (скользящая, переходная и прессовая, где натяг даёт винт), пример записи
 * «8,2 / 8,0» и два ограничения домашней печати: ±0,2 мм и зазор не меньше
 * 0,1 мм.
 */
export function EngineerIN6Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три посадки. Скользящая: зазор от 0,2 до 0,5 миллиметра, ось и втулка. Переходная: 0,05–0,1 миллиметра, крышка. Прессовая: натяг даёт винт, а не размер. Пример: отверстие 8,2 и вал 8,0 дают зазор 0,2 миллиметра. FDM держит ±0,2 миллиметра, зазор меньше 0,1 миллиметра не проектируют"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          три посадки: от свободной до натяга
        </text>

        {FITS.map((fit, i) => {
          const x = 12 + i * 101;
          return (
            <g key={fit.name}>
              <rect x={x} y="24" width="94" height="64" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
              <rect x={x} y="24" width="94" height="2.5" rx="1.2" fill={fit.accent} fillOpacity="0.8" />
              <text x={x + 8} y="42" fontSize="10" fontWeight="700" fill={fit.accent}>
                {fit.name}
              </text>
              <text x={x + 8} y="60" fontSize="11" fontWeight="700" fill="#e2e8f0">
                {fit.range}
              </text>
              <text x={x + 8} y="78" fontSize="10" fill="#94a3b8">
                {fit.example}
              </text>
            </g>
          );
        })}

        {/* Пример записи посадки */}
        <rect x="12" y="96" width="296" height="30" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="22" y="115" fontSize="10" fill="#e2e8f0">
          Ø 8,2 / вал 8,0 → зазор 0,2 мм
        </text>
        <text x="298" y="115" fontSize="10" fill="#94a3b8" textAnchor="end">
          пара чисел
        </text>

        <text x="12" y="146" fontSize="10" fill="#fbbf24">
          FDM держит ±0,2 мм
        </text>
        <text x="150" y="146" fontSize="10" fill="#94a3b8">
          отверстие выходит овальным
        </text>
        <text x="12" y="164" fontSize="10" fill="#cbd5e1">
          зазор меньше 0,1 мм не проектируют
        </text>
      </svg>
    </VisualWrapper>
  );
}
