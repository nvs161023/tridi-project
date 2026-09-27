import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Массив на плите: три ряда по четыре, четыре и три детали — одиннадцать всего
 * (в уроке их двадцать, но на кадре 320×180 столько не читается, поэтому больше
 * и не рисуем: смысл в сетке и в зазоре). Зазор 4 мм показан отдельно —
 * увеличенный фрагмент двух краёв и размер между ними.
 */
const rows = [
  { y: 36, xs: [22, 68, 114, 160] },
  { y: 64, xs: [22, 68, 114, 160] },
  { y: 92, xs: [45, 91, 137] },
];

/**
 * Расположение деталей на плите — вид сверху на сетку массивом.
 *
 * Ровно по content урока: «двадцать деталей в сетке. Расстояние 4 мм. Все
 * влезли на стол», по совету «расстояние 3–5 мм, для высоких деталей — 6–8 мм»
 * и по предупреждению «не ставь высокие рядом с низкими — сопло заденет».
 *
 * От «Модели брелока» из базового урока 12 (одна деталь на плите сверху)
 * отличается предметом: там одна деталь и её юбка brim, здесь СЕТКА копий и
 * зазор между ними. От «Заполнения стола» ниже в этом же уроке — тем, что там
 * детали появляются по одной и меняется время, здесь уже готовый массив.
 */
export function ProFF5Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Массив деталей: на плите вид сверху одиннадцать деталей в сетке — три ряда, все с зазором 4 мм; справа увеличенный фрагмент двух краёв с размером 4 мм, внизу подписи про расстояние и про высокие детали рядом с низкими"
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
          массив: детали в сетке с зазором
        </text>

        {/* Плита и сетка копий: три ряда, зазор и по горизонтали, и по вертикали */}
        <rect x="12" y="22" width="200" height="116" rx="6" fill="#0f172a" stroke="#475569" />
        {rows.map((row) =>
          row.xs.map((x) => (
            <g key={`part-${row.y}-${x}`}>
              <rect x={x} y={row.y} width="30" height="16" rx="3" fill="#475569" stroke="#94a3b8" />
              <circle cx={x + 15} cy={row.y + 8} r="3" fill="#1e293b" stroke="#94a3b8" />
            </g>
          )),
        )}

        {/* Увеличенный фрагмент: два края деталей и размер между ними */}
        <rect x="218" y="22" width="90" height="116" rx="6" fill="#0f172a" stroke="#38bdf8" strokeOpacity="0.7" />
        <line x1="60" y1="58" x2="218" y2="58" stroke="#38bdf8" strokeDasharray="4 3" strokeOpacity="0.7" />
        <text x="224" y="44" fontSize="9" fill="#7dd3fc">
          зазор
        </text>
        <text x="264" y="44" fontSize="9" fill="#e2e8f0" textAnchor="middle">
          4 мм
        </text>
        <rect x="224" y="56" width="32" height="40" rx="4" fill="#475569" stroke="#cbd5e1" />
        <rect x="272" y="56" width="32" height="40" rx="4" fill="#475569" stroke="#cbd5e1" />
        <line x1="256" y1="76" x2="272" y2="76" stroke="#38bdf8" strokeWidth="1.3" />
        <polygon points="256,76 262,73 262,79" fill="#38bdf8" />
        <polygon points="272,76 266,73 266,79" fill="#38bdf8" />
        <text x="224" y="132" fontSize="9" fill="#94a3b8">
          между деталями
        </text>

        <text x="12" y="156" fontSize="10" fill="#e2e8f0">
          зазор 3–5 мм — и все влезли
        </text>
        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          высокие рядом с низкими — сопло заденет
        </text>
      </svg>
    </VisualWrapper>
  );
}
