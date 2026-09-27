import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Annealing: слева термопрофиль во времени, справа деталь до и после наложением
 * контуров, внизу плашка с итогом.
 *
 * Ровно по content урока: «Нагрев детали в духовке при 80 °C (PLA) или 100 °C
 * (PETG) 30 минут, потом медленное остывание… прочность растёт. Минус — усадка
 * 1–2 %» и по подписи блока: «График: температура vs время. Фото: деталь до и
 * после. Прочность +30 %».
 *
 * От «графика резонансов» (I-I1-image-1: частоты, два острых пика до и после
 * Input Shaper) отличается тем, что здесь профиль во времени — нагрев, полка
 * выдержки и плавный спуск без пиков. От «шкалы эксплуатационных температур»
 * (E2-E2-3: PLA 60°, PETG 80°, ABS 100° и так далее) — тем, что шкалы материалов
 * нет, есть один режим 80 °C и усадка. От «нагрева плиты PEI» (B-B2-animation:
 * расширение и сжатие в анимации) — тем, что это статичный кадр, а усадка
 * показана наложением контуров и зазором, а не движением.
 */
export function ProKK1Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Annealing: слева график температуры во времени — нагрев до 80 градусов, выдержка 30 минут и медленное остывание; справа деталь до и после наложением контуров, пунктирный контур больше, сплошной меньше — усадка 1–2 процента, прочность растёт на 30 процентов"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Annealing: 80 °C, 30 мин, медленное остывание
        </text>

        {/* Термопрофиль тремя отрезками: нагрев, полка выдержки, спуск. Отрезками,
            а не одной ломаной: bbox одной ломаной накрыл бы подпись «30 мин» под
            полкой, и проверка наездов считала бы это пересечением. */}
        <rect x="14" y="30" width="140" height="96" rx="4" fill="#0f172a" stroke="#475569" />
        <line x1="22" y1="38" x2="22" y2="120" stroke="#475569" />
        <line x1="22" y1="120" x2="148" y2="120" stroke="#475569" />
        <polyline
          points="26,118 50,62"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="50" y1="62" x2="88" y2="62" stroke="#fbbf24" strokeWidth="2" />
        <polyline
          points="88,62 142,112"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text x="52" y="52" fontSize="7.5" fill="#fbbf24">
          80 °C
        </text>
        <text x="56" y="78" fontSize="7.5" fill="#94a3b8">
          30 мин
        </text>
        <text x="14" y="142" fontSize="7.5" fill="#94a3b8">
          медленное остывание
        </text>

        {/* Деталь до и после: пунктир — до, сплошной — после */}
        <rect
          x="178"
          y="40"
          width="88"
          height="88"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.6"
          strokeDasharray="5 4"
        />
        <rect
          x="181"
          y="43"
          width="82"
          height="82"
          fill="#334155"
          fillOpacity="0.35"
          stroke="#38bdf8"
          strokeWidth="1.6"
        />
        <text x="158" y="144" fontSize="7.5" fill="#94a3b8">
          до — пунктир, после — сплошной
        </text>

        {/* Плашка с итогом */}
        <rect x="158" y="154" width="152" height="22" rx="6" fill="#0f172a" stroke="#34d399" />
        <text x="166" y="168" fontSize="7.5" fill="#e2e8f0">
          прочность +30 %, усадка 1–2 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
