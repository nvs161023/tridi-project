import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 26 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_walls_fill.png`: сечение детали на изгибе.
 * Крайние волокна держат нагрузку, в середине напряжение почти ноль; поэтому
 * работают периметры. Цифры — из блока 25: 4–6 стенок и 15–25% заполнения.
 */
export function EngineerIN2Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Стенки и заполнение на изгибе. Сжатие сверху и растяжение снизу берут на себя периметры, в середине сечения напряжение близко к нулю. Поэтому силовой детали нужно четыре-шесть периметров и заполнение 15–25 процентов. Заполнение держит форму и сжатие, но тонкую стенку оно не спасёт"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <pattern id="in2-walls-infill" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="1" strokeOpacity="0.45" />
          </pattern>
          <linearGradient id="in2-walls-stress" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f87171" stopOpacity="0.3" />
            <stop offset="0.35" stopColor="#f87171" stopOpacity="0" />
            <stop offset="0.65" stopColor="#60a5fa" stopOpacity="0" />
            <stop offset="1" stopColor="#60a5fa" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          на изгибе работают периметры
        </text>

        <rect
          x="12"
          y="24"
          width="160"
          height="116"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <rect x="34" y="34" width="100" height="76" fill="#0f172a" stroke="#3b82f6" strokeWidth="3.5" />
        <rect x="41" y="41" width="86" height="62" fill="none" stroke="#60a5fa" strokeWidth="2" />
        <rect
          x="47"
          y="47"
          width="74"
          height="50"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        <rect x="50" y="50" width="68" height="44" fill="url(#in2-walls-infill)" />
        <rect x="34" y="34" width="100" height="76" fill="url(#in2-walls-stress)" />
        <text x="84" y="50" fontSize="10" fill="#fecaca" textAnchor="middle">
          сжатие
        </text>
        <text x="84" y="68" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          σ ≈ 0
        </text>
        <line
          x1="28"
          y1="72"
          x2="140"
          y2="72"
          stroke="#cbd5e1"
          strokeOpacity="0.55"
          strokeDasharray="3 2"
        />
        <text x="84" y="98" fontSize="10" fill="#bfdbfe" textAnchor="middle">
          растяжение
        </text>

        <text x="182" y="50" fontSize="22" fontWeight="700" fill="#60a5fa">
          4–6
        </text>
        <text x="182" y="67" fontSize="10" fill="#94a3b8">
          периметров
        </text>
        <text x="182" y="94" fontSize="20" fontWeight="700" fill="#f59e0b">
          15–25%
        </text>
        <text x="182" y="112" fontSize="10" fill="#94a3b8">
          заполнения
        </text>
        <text x="182" y="124" fontSize="10" fill="#cbd5e1">
          крайние волокна
        </text>
        <text x="182" y="136" fontSize="10" fill="#cbd5e1">
          держат изгиб
        </text>

        <line x1="12" y1="146" x2="308" y2="146" stroke="#334155" />
        <text x="12" y="159" fontSize="10" fill="#94a3b8">
          заполнение держит форму и сжатие
        </text>
        <text x="12" y="173" fontSize="10" fill="#fcd34d">
          тонкую стенку не спасёт заполнение
        </text>
      </svg>
    </VisualWrapper>
  );
}
