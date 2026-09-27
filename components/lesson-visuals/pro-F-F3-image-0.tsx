import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре части модели: лежат лесенкой, у каждой на срезе по два шипа. */
const parts = [
  { x: 22, y: 64 },
  { x: 44, y: 58 },
  { x: 66, y: 52 },
  { x: 88, y: 46 },
];

/**
 * Пример из урока: модель разрезали на четыре части, напечатали и собрали. Слева
 * четыре части лесенкой — на срезах видны шипы, справа собранная деталь со
 * швами на местах стыков.
 *
 * Ровно по content урока: «модель, разделённая на 4 части. Шипы для соединения.
 * Собранная деталь», по шагу «Добавь шипы (Plug/Connector)» и по совету: «для
 * функциональных деталей — шип-паз + клей».
 *
 * От «Типов соединений» в этом же уроке отличается предметом: там пять разрезов
 * замков крупно, здесь одна модель и её сборка. От «Разноцветной модели» из
 * следующего урока — тем, что части одинакового цвета: речь про разрез, а не
 * про цвет.
 */
export function ProFF3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пример: модель разрезана на четыре части — на срезах шипы и ответные гнёзда, части напечатаны отдельно и собраны в одну деталь со швами на местах стыков"
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
          модель разрезали на четыре части и собрали
        </text>

        <text x="24" y="34" fontSize="10" fontWeight="bold" fill="#93c5fd">
          4 части и шипы
        </text>
        {parts.map((part, index) => (
          <g key={`part-${part.x}`}>
            <rect x={part.x} y={part.y} width="16" height="30" rx="2" fill="#475569" stroke="#94a3b8" />
            <line x1={part.x + 4} y1={part.y + 6} x2={part.x + 12} y2={part.y + 6} stroke="#64748b" />
            <line x1={part.x + 4} y1={part.y + 24} x2={part.x + 12} y2={part.y + 24} stroke="#64748b" />
            <rect x={part.x + 16} y={part.y + 8} width="4" height="7" rx="1" fill="#e2e8f0" />
            <rect x={part.x + 16} y={part.y + 18} width="4" height="7" rx="1" fill="#e2e8f0" />
            {index < 3 ? (
              <rect x={part.x + 20} y={part.y + 8} width="2" height="7" fill="#0f172a" />
            ) : null}
          </g>
        ))}

        <line x1="166" y1="76" x2="196" y2="76" stroke="#38bdf8" strokeWidth="1.4" />
        <polygon points="196,72 204,76 196,80" fill="#38bdf8" />

        <text x="260" y="34" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          собранная деталь
        </text>
        <rect x="232" y="62" width="56" height="34" rx="2" fill="#475569" stroke="#cbd5e1" />
        {[246, 260, 274].map((x) => (
          <line key={`seam-${x}`} x1={x} y1="63" x2={x} y2="95" stroke="#34d399" strokeDasharray="4 3" />
        ))}

        <text x="12" y="134" fontSize="10" fill="#e2e8f0">
          для функциональных — шип-паз и клей
        </text>
        <text x="12" y="152" fontSize="9" fill="#94a3b8">
          модель больше стола — значит режем
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          зазор меньше 0,2 мм — не влезет
        </text>
      </svg>
    </VisualWrapper>
  );
}
