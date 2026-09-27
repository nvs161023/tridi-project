import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кронштейн: в зоне крепления — цилиндр-модификатор, поэтому там 60% заполнения,
 * а в остальной детали 15%: прочность та же, печатается на 40% быстрее.
 *
 * Ровно по content урока: «Скриншот: кронштейн, в месте крепления — цилиндр-
 * модификатор с 60% заполнения. Экономия времени 40%, прочность та же» и по
 * списку «Что можно менять»: «Заполнение: 60% в нагрузке, 15% в остальном».
 *
 * От «Видов поддержек» и «Настроек поддержек» в этом же модуле отличается тем,
 * что это целая деталь, а не схема: кронштейн с подсвеченной зоной нагрузки и
 * двумя подписями про заполнение. От «Примеров ориентации» в модуле F — тем,
 * что там одна деталь в трёх положениях и считается объём поддержек, здесь одна
 * деталь и одна зона с другим заполнением.
 */
export function ProHH3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пример с кронштейном: в зоне крепления стоит цилиндр-модификатор, поэтому там 60 процентов заполнения, а в остальной детали 15 процентов — прочность та же, а печать быстрее на 40 процентов"
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
          кронштейн: модификатор в зоне нагрузки
        </text>

        <rect x="236" y="26" width="72" height="20" rx="4" fill="#0f172a" stroke="#475569" />
        <text x="272" y="39" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          −40% времени
        </text>

        {/* Кронштейн: стойка крепления и полка */}
        <rect x="60" y="44" width="14" height="70" fill="#475569" stroke="#94a3b8" />
        <rect x="60" y="102" width="92" height="14" fill="#475569" stroke="#94a3b8" />

        {/* Зона крепления с цилиндром-модификатором */}
        <rect
          x="56"
          y="48"
          width="24"
          height="46"
          fill="#fbbf24"
          fillOpacity="0.18"
          stroke="#fbbf24"
          strokeDasharray="4 3"
        />
        <rect x="66" y="60" width="14" height="20" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" />
        <ellipse cx="73" cy="60" rx="7" ry="2.6" fill="#38bdf8" fillOpacity="0.35" />
        <ellipse cx="73" cy="80" rx="7" ry="2.6" fill="#38bdf8" fillOpacity="0.35" />

        <line x1="80" y1="60" x2="150" y2="60" stroke="#fbbf24" strokeOpacity="0.6" />
        <text x="156" y="63" fontSize="9" fill="#fbbf24">
          зона крепления
        </text>

        <rect x="12" y="128" width="8" height="8" fill="#fbbf24" />
        <text x="26" y="136" fontSize="9" fill="#fbbf24">
          нагрузка — 60% заполнения
        </text>

        <rect x="12" y="150" width="8" height="8" fill="#6ee7b7" />
        <text x="26" y="158" fontSize="9" fill="#6ee7b7">
          остальное — 15% заполнения
        </text>

        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          модификатор только в зоне нагрузки
        </text>
      </svg>
    </VisualWrapper>
  );
}
