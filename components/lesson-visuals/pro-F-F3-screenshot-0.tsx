import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Cut в Orca — схема инструмента, а не скриншот окна: модель в окне предпросмотра
 * разрезана пунктирной плоскостью, нижняя половина отъехала в сторону, шипы
 * соединителя стоят на её срезе, а в узкой полосе справа подсвечен инструмент Cut.
 *
 * Ровно по content урока: «модель, плоскость разреза, добавленные шипы. Слайсер
 * сам добавляет соединители» и по шагам урока: Cut → Plug → экспорт обеих частей.
 *
 * От схем окна Orca (базовые уроки 3 и 9) и от вкладок Bambu в первой паре этого
 * модуля отличается тем, что окна как такового нет: в кадре только модель,
 * плоскость разреза и шипы, а полоса инструментов обрезана до трёх кнопок.
 */
export function ProFF3Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Cut в Orca: модель в окне разрезана пунктирной плоскостью, нижняя половина отъехала в сторону, на срезе стоят два шипа соединителя, которые слайсер добавил сам, а в узкой полосе инструментов справа подсвечен Cut"
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
          cut: разрез, шипы, экспорт двух частей
        </text>

        {/* Окно предпросмотра: шапка и рабочая область */}
        <rect x="10" y="24" width="216" height="96" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="11" y="25" width="214" height="9" fill="#334155" />
        <line x1="17" y1="29" x2="23" y2="29" stroke="#64748b" strokeWidth="1.5" />
        <line x1="29" y1="29" x2="35" y2="29" stroke="#64748b" strokeWidth="1.5" />

        {/* Модель: верхняя половина на месте, нижняя отъехала вниз-вправо */}
        <rect x="58" y="44" width="60" height="22" fill="#475569" stroke="#94a3b8" />
        <rect x="72" y="76" width="60" height="18" fill="#64748b" stroke="#cbd5e1" />
        <line x1="30" y1="66" x2="200" y2="66" stroke="#38bdf8" strokeDasharray="5 4" />
        {/* Шипы на срезе нижней половины и ответные гнёзда в верхней */}
        <rect x="86" y="70" width="5" height="8" rx="2" fill="#e2e8f0" />
        <rect x="104" y="70" width="5" height="8" rx="2" fill="#e2e8f0" />
        <rect x="86" y="62" width="5" height="5" rx="1" fill="#0f172a" stroke="#94a3b8" />
        <rect x="104" y="62" width="5" height="5" rx="1" fill="#0f172a" stroke="#94a3b8" />
        {/* Стрелка: в какую сторону отъехала нижняя часть */}
        <line x1="136" y1="72" x2="152" y2="80" stroke="#38bdf8" strokeWidth="1.3" />
        <polygon points="152,77 158,82 150,84" fill="#38bdf8" />

        {/* Полоса инструментов: три кнопки, подсвечен Cut */}
        <rect x="236" y="24" width="74" height="96" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="250" y="34" width="20" height="20" rx="3" fill="#334155" stroke="#64748b" />
        <rect x="250" y="60" width="20" height="20" rx="3" fill="#334155" stroke="#38bdf8" />
        <rect x="250" y="86" width="20" height="20" rx="3" fill="#334155" stroke="#64748b" />
        <line x1="254" y1="70" x2="266" y2="70" stroke="#38bdf8" strokeDasharray="3 2" />
        <text x="278" y="74" fontSize="10" fill="#7dd3fc">
          Cut
        </text>

        <text x="12" y="136" fontSize="10" fill="#e2e8f0">
          плоскость разреза — пунктир
        </text>
        <text x="12" y="152" fontSize="9" fill="#94a3b8">
          шипы слайсер добавляет сам
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          Orca и PrusaSlicer: Cut → Plug → экспорт
        </text>
      </svg>
    </VisualWrapper>
  );
}
