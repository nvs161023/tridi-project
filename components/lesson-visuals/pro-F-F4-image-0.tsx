import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три части модели по цветам: каждая печатается своим филаментом. */
const parts = [
  { loose: 42, glued: 42, color: "#38bdf8", bright: "#7dd3fc" },
  { loose: 68, glued: 60, color: "#fbbf24", bright: "#fcd34d" },
  { loose: 94, glued: 78, color: "#f87171", bright: "#fca5a5" },
];

/**
 * Разноцветная модель без AMS: одна деталь разобрана на три части по цветам,
 * каждая печатается своим пластиком, потом части склеиваются. Слева разобранное
 * состояние с шипами на стыках, справа собранная деталь.
 *
 * Ровно по content урока: «модель, разделённая на части по цветам. Каждая часть
 * печатается отдельно. Сборка», по тексту «Без AMS нельзя печатать разными
 * цветами в одной модели — разделить модель на части по цветам, напечатать
 * отдельно, склеить» и по совету: «для точной сборки добавляй шипы 2–3 мм».
 *
 * От «Пяти катушек пластиков» из модуля E1 отличается предметом: там катушки с
 * паспортами материалов и речь про выбор пластика, здесь ОДНА деталь, разобранная
 * на три цветные части, и речь про обход отсутствия AMS.
 */
export function ProFF4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разноцветная модель без AMS: деталь разобрана на три части по цветам — синюю, жёлтую и красную, на стыках шипы 2–3 мм, каждая часть печатается своим пластиком и части склеиваются в одну деталь"
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
          одна модель — три цвета
        </text>

        <text x="38" y="30" fontSize="10" fontWeight="bold" fill="#93c5fd">
          три части
        </text>
        {parts.map((part) => (
          <rect
            key={`loose-${part.loose}`}
            x="38"
            y={part.loose}
            width="52"
            height="18"
            rx="3"
            fill={part.color}
            fillOpacity="0.55"
            stroke={part.color}
          />
        ))}
        <rect x="52" y="61" width="5" height="6" rx="1" fill="#e2e8f0" />
        <rect x="71" y="61" width="5" height="6" rx="1" fill="#e2e8f0" />
        <rect x="52" y="87" width="5" height="6" rx="1" fill="#e2e8f0" />
        <rect x="71" y="87" width="5" height="6" rx="1" fill="#e2e8f0" />

        <line x1="116" y1="76" x2="146" y2="76" stroke="#38bdf8" strokeWidth="1.4" />
        <polygon points="146,72 154,76 146,80" fill="#38bdf8" />
        <text x="135" y="60" fontSize="9" fill="#7dd3fc" textAnchor="middle">
          склеить
        </text>

        <text x="200" y="30" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          собранная деталь
        </text>
        {parts.map((part) => (
          <rect
            key={`glued-${part.glued}`}
            x="174"
            y={part.glued}
            width="52"
            height="18"
            fill={part.color}
            fillOpacity="0.55"
            stroke={part.bright}
          />
        ))}

        <text x="12" y="134" fontSize="10" fill="#e2e8f0">
          без AMS — печатаем по частям и клеим
        </text>
        <text x="12" y="152" fontSize="9" fill="#94a3b8">
          для точной сборки — шипы 2–3 мм
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          PETG клеим эпоксидкой, не суперклеем
        </text>
      </svg>
    </VisualWrapper>
  );
}
