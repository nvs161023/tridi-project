import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три лупы на одной детали: центр, программа и что она делает с дефектом. */
const LENSES = [
  { cx: 58, program: "MeshLab", action: "зашивает дыры" },
  { cx: 160, program: "Meshmixer", action: "чистит шум" },
  { cx: 262, program: "Netfabb", action: "срезает лишнее" },
];

/** Выноски от дефекта на детали к его лупе. */
const LEADS: [number, number, number, number][] = [
  [123, 64, 58, 86],
  [162, 64, 160, 86],
  [202, 64, 262, 86],
];

/**
 * Центрирование подписи под лупой: ширину считаем по 0.55em — той же оценкой,
 * что и проверка читаемости (text-anchor в кадрах курса не используем).
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Программы обработки: одна деталь и три лупы над её дефектами. В каждой лупе
 * слева дефект, справа исправленное состояние, поэтому содержимое читается как
 * «до / после»: зашитая дыра (MeshLab), убранный шум (Meshmixer), срезанный лишний
 * объём (Netfabb). Каждая лупа подписана своей программой — видно, какая программа
 * за что отвечает.
 *
 * Ровно по content урока: «Скриншоты: MeshLab, Meshmixer, Netfabb. Под каждым —
 * что делает».
 *
 * От окон программ в F и D отличается тем, что интерфейсов в кадре нет вовсе:
 * три скриншота чужих окон были бы неотличимы от уже нарисованных панелей. От
 * K-K2-image-0 («объект и зоны с мазками») — тем, что там зоны показывают места
 * обработки, а здесь каждая лупа показывает именно результат: дефект и то же место
 * после исправления.
 */
export function ProNN3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три лупы на одной детали: слева от каждой лупы дефект, справа исправленное место — лупа MeshLab зашивает дыры, лупа Meshmixer чистит шум, лупа Netfabb срезает лишний объём"
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
          Программы: три лупы на детали
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          слева — до, справа — после
        </text>

        {/* Деталь с тремя дефектами: дыра, рябь от шума и наплыв лишнего объёма */}
        <rect x="96" y="40" width="128" height="24" rx="3" fill="#475569" stroke="#64748b" />
        <polygon points="117,45 127,44 130,50 126,57 117,55" fill="#0f172a" />
        <polyline
          points="150,44 154,40 158,44 162,40 166,44 170,40 174,44"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1"
        />
        <polygon points="192,42 196,34 204,32 210,38 212,42" fill="#64748b" stroke="#94a3b8" strokeWidth="0.8" />

        {/* Выноски от дефектов к лупам */}
        {LEADS.map(([x1, y1, x2, y2]) => (
          <line
            key={`lead-${x1}-${x2}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#94a3b8"
            strokeWidth="0.9"
            strokeDasharray="3 3"
          />
        ))}

        {/* Ободья луп и граница «до | после» внутри каждой */}
        {LENSES.map((lens) => (
          <g key={`lens-${lens.program}`}>
            <circle cx={lens.cx} cy="112" r="26" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.6" />
            <line
              x1={lens.cx}
              y1="96"
              x2={lens.cx}
              y2="128"
              stroke="#475569"
              strokeDasharray="2 3"
            />
          </g>
        ))}

        {/* Лупа MeshLab: дыра и заплатка на её месте */}
        <g>
          <polygon points="44,108 52,105 55,111 51,118 43,116" fill="#0f172a" stroke="#f87171" strokeWidth="0.7" />
          <rect x="63" y="106" width="13" height="11" fill="#475569" stroke="#93c5fd" strokeWidth="0.8" />
          <line x1="63" y1="106" x2="76" y2="117" stroke="#93c5fd" strokeWidth="0.7" />
          <line x1="76" y1="106" x2="63" y2="117" stroke="#93c5fd" strokeWidth="0.7" />
        </g>

        {/* Лупа Meshmixer: рябь шума и ровная кромка */}
        <g>
          <polyline
            points="145,116 148,108 151,116 154,108 157,116"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1"
          />
          <rect x="164" y="110" width="9" height="4" fill="none" stroke="#475569" />
          <line x1="164" y1="112" x2="173" y2="112" stroke="#93c5fd" strokeWidth="1.2" />
        </g>

        {/* Лупа Netfabb: наплыв и аккуратно срезанный край */}
        <g>
          <polygon points="247,116 249,106 255,101 261,105 263,116" fill="#64748b" stroke="#94a3b8" strokeWidth="0.7" />
          <rect x="265" y="108" width="9" height="8" fill="#475569" stroke="#93c5fd" strokeWidth="0.8" />
        </g>

        {/* Подписи: программа и что она делает */}
        {LENSES.map((lens) => (
          <g key={`label-${lens.program}`}>
            <text
              x={centerX(lens.cx, lens.program, 10)}
              y="154"
              fontSize="10"
              fill="#e2e8f0"
            >
              {lens.program}
            </text>
            <text
              x={centerX(lens.cx, lens.action, 7.5)}
              y="169"
              fontSize="7.5"
              fill="#94a3b8"
            >
              {lens.action}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
