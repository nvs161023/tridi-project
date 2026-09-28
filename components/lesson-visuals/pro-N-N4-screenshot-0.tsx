import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Тот же силуэт плиты со скруглённым верхом — гладким контуром, как в BRep. */
const OUTLINE = "M 0,42 L 0,14 Q 0,0 12,0 L 48,0 Q 60,0 60,14 L 60,42 Z";

/**
 * Триангуляция этого же силуэта: пятнадцать треугольников без разрывов и наложений.
 * Вершины контура — семь точек, плюс пять внутренних опорных вершин. Треугольники
 * перечислены по одному, чтобы в кадре читалась именно сетка, как в STL.
 */
const TRIANGLES: [number, number][][] = [
  [[0, 42], [0, 14], [15, 24]],
  [[0, 42], [15, 24], [30, 38]],
  [[0, 42], [30, 38], [60, 42]],
  [[0, 14], [12, 0], [15, 24]],
  [[12, 0], [24, 12], [15, 24]],
  [[12, 0], [30, 0], [24, 12]],
  [[30, 0], [40, 12], [24, 12]],
  [[30, 0], [48, 0], [40, 12]],
  [[48, 0], [60, 14], [40, 12]],
  [[60, 14], [45, 24], [40, 12]],
  [[60, 14], [60, 42], [45, 24]],
  [[60, 42], [30, 38], [45, 24]],
  [[15, 24], [24, 12], [30, 38]],
  [[24, 12], [40, 12], [30, 38]],
  [[40, 12], [45, 24], [30, 38]],
];

/** Одна и та же деталь в двух панелях: слева сеткой, справа гладким телом. */
const MESH = { x: 43, y: 56 };
const SOLID = { x: 200, y: 56 };

/** Швы поверхностей внутри тела: три грани, из которых собран BRep. */
const SEAMS = [20, 40];

/** Засечки размерных линий: короткий штрих под 45° на каждом конце размера. */
const TICKS: [number, number][] = [
  [200, 112],
  [260, 112],
  [272, 56],
  [272, 98],
];

/**
 * Центрирование подписи: ширина символа ≈ 0.55em — та же оценка, что и в проверке
 * читаемости, поэтому вылет строки за панель виден на глаз и в отчёте проверки.
 */
function centerX(cx: number, text: string, size: number): number {
  return Math.round((cx - (text.length * size * 0.55) / 2) * 10) / 10;
}

/**
 * Перевод скана в твёрдое тело — диптих: слева та же деталь, но описанная сеткой
 * треугольников («нет точных размеров»), справа она же гладкими поверхностями с
 * размерными линиями («точные размеры»), между панелями переход «Mesh → BRep»,
 * внизу строкой три другие программы перевода.
 *
 * Ровно по content урока: «Mesh → BRep в Fusion работает не всегда» и по list
 * «Способы»: «SolidWorks: ScanTo3D», «Rhino: Mesh → NURBS», «Geomagic Design X:
 * профессиональный реверс».
 *
 * От F-F4-screenshot-0 отличается построением: там окно Fusion с панелью Bodies и
 * тремя телами — интерфейс программы, здесь интерфейса нет вовсе: две панели с
 * одной деталью и переход между способами её описания. От K-K2-image-0 («объект и
 * зоны с мазками») — тоже: там зоны обработки на одном объекте, здесь две разные
 * формы записи одной геометрии.
 */
export function ProNN4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Перевод скана в CAD, диптих: слева та же деталь описана сеткой треугольников — mesh, у которой нет точных размеров; справа она же твёрдым телом solid с размерными линиями 50 на 25 мм — размеры точные; между панелями переход Mesh в BRep; внизу строкой другие программы перевода: SolidWorks ScanTo3D, Rhino Mesh в NURBS, Geomagic Design X"
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
          Скан в CAD: mesh → solid
        </text>
        <text x="12" y="29" fontSize="7.5" fill="#94a3b8">
          одна и та же деталь: mesh и solid
        </text>

        {/* Панели диптиха: слева сетка, справа твёрдое тело */}
        <rect x="10" y="36" width="126" height="88" rx="8" fill="#1e293b" stroke="#475569" />
        <rect x="184" y="36" width="126" height="88" rx="8" fill="#1e293b" stroke="#475569" />

        <text x={centerX(73, "Mesh (скан)", 10)} y="47" fontSize="10" fill="#e2e8f0">
          Mesh (скан)
        </text>
        <text x={centerX(247, "Solid (BRep)", 10)} y="47" fontSize="10" fill="#e2e8f0">
          Solid (BRep)
        </text>

        {/* Переход между способами описания одной геометрии */}
        <line x1="141" y1="82" x2="175" y2="82" stroke="#94a3b8" strokeWidth="1.2" />
        <polygon points="175,78 181,82 175,86" fill="#94a3b8" />
        <text x={centerX(159, "Mesh →", 9)} y="70" fontSize="9" fill="#e2e8f0">
          Mesh →
        </text>
        <text x={centerX(159, "BRep", 9)} y="100" fontSize="9" fill="#e2e8f0">
          BRep
        </text>

        {/* Левая панель: та же деталь сеткой треугольников */}
        <g transform={`translate(${MESH.x} ${MESH.y})`}>
          {TRIANGLES.map((triangle, index) => (
            <polygon
              key={`tri-${index}`}
              points={triangle.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#475569"
              fillOpacity="0.9"
              stroke="#94a3b8"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Правая панель: та же деталь гладкими контурами и гранями */}
        <g transform={`translate(${SOLID.x} ${SOLID.y})`}>
          <path d={OUTLINE} fill="#475569" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="1.2" />
          {SEAMS.map((x) => (
            <line key={`seam-${x}`} x1={x} y1="0" x2={x} y2="42" stroke="#64748b" strokeWidth="0.7" />
          ))}
        </g>

        {/* Размерные линии: длина 50 и высота 25 — то, чего у сетки нет */}
        <line x1="200" y1="98" x2="200" y2="108" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="260" y1="98" x2="260" y2="108" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="200" y1="112" x2="217" y2="112" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="243" y1="112" x2="260" y2="112" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="260" y1="56" x2="268" y2="56" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="260" y1="98" x2="268" y2="98" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="272" y1="56" x2="272" y2="71" stroke="#94a3b8" strokeWidth="0.7" />
        <line x1="272" y1="85" x2="272" y2="98" stroke="#94a3b8" strokeWidth="0.7" />
        {TICKS.map(([x, y]) => (
          <line
            key={`tick-${x}-${y}`}
            x1={x - 2}
            y1={y + 2}
            x2={x + 2}
            y2={y - 2}
            stroke="#94a3b8"
            strokeWidth="0.7"
          />
        ))}
        <text x="219.7" y="112" fontSize="7.5" fill="#e2e8f0">
          50 мм
        </text>
        <text x="275.5" y="78" fontSize="7.5" fill="#e2e8f0">
          25 мм
        </text>

        {/* Что даёт каждый способ: точных размеров у скана нет */}
        <text x={centerX(73, "нет точных размеров", 7.5)} y="138" fontSize="7.5" fill="#94a3b8">
          нет точных размеров
        </text>
        <text x={centerX(247, "точные размеры", 7.5)} y="138" fontSize="7.5" fill="#94a3b8">
          точные размеры
        </text>

        {/* Другие программы перевода из списка урока */}
        <text x="12" y="160" fontSize="7.5" fill="#94a3b8">
          SolidWorks ScanTo3D • Rhino Mesh → NURBS • Geomagic Design X
        </text>
      </svg>
    </VisualWrapper>
  );
}
