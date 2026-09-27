import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Строки карточек: настройка слева, значение справа. */
const modifierRows = [
  { y: 135, label: "Заполнение", value: "60%" },
  { y: 149, label: "Стенки", value: "4" },
  { y: 163, label: "Температура", value: "220 °C" },
];

const modelRows = [
  { y: 135, label: "Заполнение", value: "20%" },
  { y: 149, label: "Стенки", value: "3" },
  { y: 163, label: "Температура", value: "210 °C" },
];

/**
 * Модификаторы в Orca: сверху деталь в разрезе с полупрозрачным цилиндром-
 * модификатором внутри, под ней две карточки настроек — слева то, что задано
 * внутри модификатора, справа то, что действует на остальную модель.
 *
 * Ровно по content урока: «Скриншот: модель, внутри — цилиндр-модификатор.
 * Слева — настройки: заполнение 60%, стенки 4, температура 220 °C. Остальная
 * модель — 20%, 3 стенки, 210 °C».
 *
 * От десяти панелей слайсера в других модулях отличается тем, что окна в кадре
 * нет: разрез детали сверху и две карточки настроек вместо окна. От карточки
 * «настройки поддержек» в этом же модуле — предметом: там разрез нависания с
 * зазором Z, здесь зона внутри детали и два набора настроек.
 */
export function ProHH3Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Модификаторы в Orca: деталь в разрезе сверху с полупрозрачным цилиндром-модификатором внутри, ниже две карточки — модификатор с заполнением 60 процентов, четырьмя стенками и температурой 220 градусов и модель с заполнением 20 процентов, тремя стенками и температурой 210 градусов"
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
          модификатор задаёт свои настройки зоне детали
        </text>

        {/* Деталь в разрезе: вид сверху */}
        <rect x="24" y="26" width="130" height="62" fill="#334155" stroke="#94a3b8" />

        {/* Полупрозрачный цилиндр-модификатор внутри детали */}
        <circle cx="100" cy="57" r="24" fill="#38bdf8" fillOpacity="0.18" stroke="#38bdf8" />
        <circle
          cx="100"
          cy="57"
          r="16"
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.45"
          strokeDasharray="4 3"
        />
        <circle cx="100" cy="57" r="8" fill="#0c4a6e" stroke="#38bdf8" strokeOpacity="0.6" />

        <text x="176" y="50" fontSize="9" fill="#7dd3fc">
          цилиндр-модификатор
        </text>
        <text x="176" y="66" fontSize="9" fill="#94a3b8">
          часть модели прочнее
        </text>

        {/* Карточка модификатора */}
        <rect x="24" y="96" width="132" height="78" rx="6" fill="#0f172a" stroke="#38bdf8" />
        <text x="32" y="111" fontSize="9" fontWeight="bold" fill="#7dd3fc">
          Модификатор
        </text>
        {modifierRows.map((row) => (
          <g key={`modifier-${row.label}`}>
            <text x="32" y={row.y} fontSize="10" fill="#94a3b8">
              {row.label}
            </text>
            <text x="148" y={row.y} fontSize="10" fill="#e2e8f0" textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}

        {/* Карточка модели */}
        <rect x="164" y="96" width="132" height="78" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="172" y="111" fontSize="9" fontWeight="bold" fill="#cbd5e1">
          Модель
        </text>
        {modelRows.map((row) => (
          <g key={`model-${row.label}`}>
            <text x="172" y={row.y} fontSize="10" fill="#94a3b8">
              {row.label}
            </text>
            <text x="288" y={row.y} fontSize="10" fill="#e2e8f0" textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
