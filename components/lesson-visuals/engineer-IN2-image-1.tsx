import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 8 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_stress_table.png`: формула напряжения и один
 * расчёт на числах урока. 50 кг дают 500 Н, полка 30 × 5 мм — сечение 150 мм²,
 * напряжение 500 ÷ 150 ≈ 3,3 МПа. Допустимое взято из блока 9: 45 МПа ÷ запас 3.
 */
export function EngineerIN2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Напряжение равно силе, делённой на площадь. Один мегапаскаль равен одному ньютону на квадратный миллиметр, один килограмм даёт около десяти ньютонов. Пример: груз 50 кг — это 500 Н, сечение полки 30 на 5 мм — 150 мм², напряжение 500 делить на 150 примерно 3,3 МПа. Допустимое напряжение 15 МПа: предел 45 МПа делить на запас 3"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          одна формула на все нагрузки
        </text>

        <rect
          x="12"
          y="24"
          width="148"
          height="86"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="26" y="58" fontSize="20" fontWeight="700" fill="#e2e8f0">
          σ = F ÷ A
        </text>
        <text x="26" y="75" fontSize="10" fill="#cbd5e1">
          F — сила, Н
        </text>
        <text x="26" y="89" fontSize="10" fill="#cbd5e1">
          A — площадь, мм²
        </text>
        <text x="26" y="104" fontSize="10" fontWeight="700" fill="#60a5fa">
          1 МПа = 1 Н/мм²
        </text>

        <rect
          x="164"
          y="24"
          width="144"
          height="86"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="172" y="38" fontSize="10" fill="#94a3b8">
          пример: полка 30 × 5
        </text>
        <text x="172" y="54" fontSize="10" fill="#e2e8f0">
          груз 50 кг → 500 Н
        </text>
        <text x="172" y="68" fontSize="10" fill="#e2e8f0">
          сечение 150 мм²
        </text>
        <line x1="172" y1="76" x2="300" y2="76" stroke="#334155" />
        <text x="172" y="90" fontSize="10" fill="#cbd5e1">
          500 Н ÷ 150 мм²
        </text>
        <text x="172" y="104" fontSize="10" fontWeight="700" fill="#10b981">
          σ ≈ 3,3 МПа
        </text>

        <rect
          x="12"
          y="116"
          width="296"
          height="54"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="22" y="132" fontSize="10" fill="#e2e8f0">
          1 кг ≈ 10 Н · 1 кгс ≈ 9,8 Н
        </text>
        <text x="22" y="147" fontSize="10" fill="#94a3b8">
          держи ньютоны и миллиметры — получишь МПа
        </text>
        <text x="22" y="163" fontSize="10" fill="#fcd34d">
          прочность 45 МПа ÷ запас 3 = 15 МПа
        </text>
      </svg>
    </VisualWrapper>
  );
}
