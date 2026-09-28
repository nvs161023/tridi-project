import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Program = {
  name: string;
  /** Левый край лицевой стороны коробки. */
  x: number;
  /** Верх лицевой стороны: коробки стоят разной высоты. */
  top: number;
  /** Что за программой — слова из блока «Программы и цены» того же урока. */
  lines: string[];
  /** Миниатюра рабочего поля на лицевой стороне коробки. */
  art: "sketch" | "tree" | "code" | "sculpt";
};

/**
 * Четыре программы из content блока «Интерфейсы»: Fusion 360, FreeCAD, OpenSCAD
 * и Blender. Названия и подписи — из списка «Программы и цены» и «Что для чего»
 * того же урока: числа сложности урок не даёт, поэтому их в кадре нет.
 */
const PROGRAMS: Program[] = [
  { name: "Fusion 360", x: 10, top: 62, lines: ["инженерные", "бесплатно*"], art: "sketch" },
  { name: "FreeCAD", x: 86, top: 72, lines: ["бесплатный", "открытый"], art: "tree" },
  { name: "OpenSCAD", x: 162, top: 56, lines: ["точные", "геометрии"], art: "code" },
  { name: "Blender", x: 238, top: 68, lines: ["органические", "бесплатный"], art: "sculpt" },
];

const BOX_W = 64;
/** Сдвиг верхней грани вправо — коробки стоят в перспективе. */
const SKEW = 10;
/** Прилавок: лицевые стороны стоят на этой линии. */
const BASE = 146;
/** Окно с миниатюрой интерфейса — одно и то же место у всех коробок. */
const WINDOW_Y = 76;
const WINDOW_H = 30;
const NAME_Y = 119;
const LINE_Y = [131, 143];

/**
 * Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что и в проверке
 * читаемости, поэтому вылет строки виден сразу и на глаз, и в отчёте проверки.
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Миниатюра рабочего поля на лицевой стороне коробки: у каждой программы своя
 * примета — эскиз с размерами, дерево модели, строки кода или лепка формы.
 */
function renderArt(art: Program["art"], x: number) {
  if (art === "sketch") {
    return (
      <g>
        <rect x={x + 20} y="87" width="20" height="12" rx="1.5" fill="#475569" stroke="#94a3b8" strokeWidth="0.7" />
        <circle cx={x + 44} cy="93" r="4.5" fill="#475569" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1={x + 12} y1="87" x2={x + 12} y2="99" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={x + 10} y1="87" x2={x + 14} y2="87" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={x + 10} y1="99" x2={x + 14} y2="99" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={x + 20} y1="101" x2={x + 40} y2="101" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={x + 20} y1="99" x2={x + 20} y2="103" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1={x + 40} y1="99" x2={x + 40} y2="103" stroke="#38bdf8" strokeWidth="0.8" />
      </g>
    );
  }

  if (art === "tree") {
    return (
      <g>
        <rect x={x + 8} y="83" width="2.6" height="2.6" fill="#94a3b8" />
        <rect x={x + 13} y="83.5" width="14" height="1.8" fill="#64748b" />
        <rect x={x + 12} y="89" width="2.6" height="2.6" fill="#94a3b8" />
        <rect x={x + 17} y="89.5" width="12" height="1.8" fill="#64748b" />
        <rect x={x + 16} y="95" width="2.6" height="2.6" fill="#94a3b8" />
        <rect x={x + 21} y="95.5" width="14" height="1.8" fill="#64748b" />
        <rect x={x + 20} y="101" width="2.6" height="2.6" fill="#94a3b8" />
        <rect x={x + 25} y="101.5" width="10" height="1.8" fill="#64748b" />
        <rect x={x + 38} y="87" width="16" height="12" fill="#475569" stroke="#94a3b8" strokeWidth="0.7" />
        <polygon
          points={`${x + 38},87 ${x + 42},83 ${x + 58},83 ${x + 54},87`}
          fill="#64748b"
          stroke="#94a3b8"
          strokeWidth="0.7"
        />
        <polygon
          points={`${x + 54},87 ${x + 58},83 ${x + 58},95 ${x + 54},99`}
          fill="#475569"
          stroke="#94a3b8"
          strokeWidth="0.7"
        />
      </g>
    );
  }

  if (art === "code") {
    return (
      <g>
        <rect x={x + 8} y="81" width="22" height="2" fill="#34d399" />
        <rect x={x + 10} y="86" width="14" height="2" fill="#34d399" />
        <rect x={x + 8} y="91" width="26" height="2" fill="#34d399" />
        <rect x={x + 12} y="96" width="10" height="2" fill="#34d399" />
        <rect x={x + 10} y="101" width="18" height="2" fill="#34d399" />
        <ellipse cx={x + 44} cy="83" rx="6" ry="2.4" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.7" />
        <line x1={x + 38} y1="83" x2={x + 38} y2="99" stroke="#38bdf8" strokeWidth="0.7" />
        <line x1={x + 50} y1="83" x2={x + 50} y2="99" stroke="#38bdf8" strokeWidth="0.7" />
        <ellipse cx={x + 44} cy="99" rx="6" ry="2.4" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.7" />
      </g>
    );
  }

  return (
    <g>
      <circle cx={x + 26} cy="91" r="11" fill="#334155" stroke="#f59e0b" strokeWidth="0.9" />
      <ellipse cx={x + 26} cy="91" rx="5" ry="11" fill="none" stroke="#f59e0b" strokeOpacity="0.6" strokeWidth="0.7" />
      <ellipse cx={x + 26} cy="91" rx="11" ry="4.5" fill="none" stroke="#f59e0b" strokeOpacity="0.6" strokeWidth="0.7" />
      <path d={`M ${x + 42},83 Q ${x + 50},87 ${x + 44},91`} fill="none" stroke="#fbbf24" strokeWidth="0.9" />
      <path d={`M ${x + 46},95 Q ${x + 52},99 ${x + 46},103`} fill="none" stroke="#fbbf24" strokeWidth="0.9" />
    </g>
  );
}

/**
 * Четыре программы стоят на прилавке четырьмя упаковками разной высоты: на
 * лицевой стороне каждой — окно с миниатюрой рабочего поля (у OpenSCAD строки
 * кода, у FreeCAD дерево модели, у Fusion 360 эскиз с размерами, у Blender лепка
 * формы), под окном — название и две строки из урока: для чего программа и по
 * какой цене. Никаких «окон в ряд» и никакой шкалы сложности: чисел сложности
 * урок не даёт, поэтому сложность в кадре не нарисована.
 *
 * Ровно по content урока: «Скриншоты: Fusion 360, FreeCAD, OpenSCAD, Blender.
 * Под каждым — сложность», по спискам «Программы и цены» и «Что для чего» и по
 * предупреждению «Fusion 360 бесплатен только для личного» — отсюда звёздочка и
 * нижняя строка про подписку.
 *
 * От пяти окон слайсеров F-F1-image-0 отличается тем, что там пять маленьких
 * окон в один ряд внутри панели, а здесь четыре объёмные коробки с прилавком и
 * тенью перспективы. От «четырёх дорожек» L-L1-image-0 — отсутствием времени и
 * дистанции до первой модели: сравниваются упаковки, а не путь к модели. От
 * диорамы предметов L-L2-image-0 — тем, что предметы кадра не модели, а сами
 * программы.
 */
export function ProUU2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре программы стоят на прилавке четырьмя упаковками разной высоты: Fusion 360 — окно с эскизом и размерами, инженерные, бесплатно для личного; FreeCAD — дерево модели и тело, бесплатный, открытый; OpenSCAD — строки кода и цилиндр, точные геометрии; Blender — лепка формы и кисть, органические, бесплатный. Внизу: для личного использования бесплатно, для продажи — подписка"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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
          Четыре программы и их рабочие окна
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          что за интерфейсом и для чего программа
        </text>

        {PROGRAMS.map((program) => (
          <g key={program.name}>
            {/* Верхняя и боковая грани — коробка стоит в перспективе */}
            <polygon
              points={`${program.x},${program.top} ${program.x + SKEW},${program.top - 8} ${program.x + BOX_W + SKEW},${program.top - 8} ${program.x + BOX_W},${program.top}`}
              fill="#64748b"
              stroke="#94a3b8"
              strokeWidth="0.8"
            />
            <polygon
              points={`${program.x + BOX_W},${program.top} ${program.x + BOX_W + SKEW},${program.top - 8} ${program.x + BOX_W + SKEW},${BASE - 8} ${program.x + BOX_W},${BASE}`}
              fill="#475569"
              stroke="#94a3b8"
              strokeWidth="0.8"
            />
            <rect
              x={program.x}
              y={program.top}
              width={BOX_W}
              height={BASE - program.top}
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="0.9"
            />

            {/* Окно с миниатюрой рабочего поля */}
            <rect
              x={program.x + 4}
              y={WINDOW_Y}
              width={BOX_W - 8}
              height={WINDOW_H}
              rx="2"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="0.8"
            />
            {renderArt(program.art, program.x)}

            {/* Название и две строки из урока */}
            <text
              x={centerX(program.x + BOX_W / 2, program.name, 7.5)}
              y={NAME_Y}
              fontSize="7.5"
              fill="#e2e8f0"
            >
              {program.name}
            </text>
            {program.lines.map((line, lineIndex) => (
              <text
                key={`line-${program.name}-${line}`}
                x={centerX(program.x + BOX_W / 2, line, 7.5)}
                y={LINE_Y[lineIndex]}
                fontSize="7.5"
                fill="#94a3b8"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        {/* Прилавок: две тёмные плиты, чтобы подписи не липли к светлым линиям */}
        <rect x="8" y={BASE} width="304" height="7" fill="#334155" />
        <rect x="8" y={BASE + 7} width="304" height="5" fill="#1e293b" />

        <text x="8" y="172" fontSize="7.5" fill="#94a3b8">
          *для личного использования — бесплатно, для продажи — подписка
        </text>
      </svg>
    </VisualWrapper>
  );
}

