import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Акцент кадра: высота слоя — синий базового курса. */
const ACCENT = "#3b82f6";

/**
 * Три кубика 20 мм ровно в порядке подписи блока 9: 0,1 мм — 200 слоёв —
 * 1 ч 05 мин, 0,2 мм — 100 слоёв — 35 мин, 0,3 мм — 67 слоёв — 24 мин.
 * `hatch` — сколько пикселей приходится на один слой в схематичном кубике 30 px:
 * так густая штриховка сама показывает, что слоёв больше.
 */
const CUBES: { height: string; layers: number; time: string; hatch: number }[] = [
  { height: "0,1 мм", layers: 200, time: "1 ч 05 мин", hatch: 2 },
  { height: "0,2 мм", layers: 100, time: "35 мин", hatch: 3.75 },
  { height: "0,3 мм", layers: 67, time: "24 мин", hatch: 5 },
];

/** Три полосы по 40 px и зазор 3 px: 24…64, 67…107, 110…150. */
const ROW_TOP = 24;
const ROW_HEIGHT = 40;
const ROW_GAP = 3;

/** Строки внутри полосы: высота слоя сверху, счётчик и время под ней. */
const HEIGHT_Y = 16;
const DETAIL_Y = 31;

/** Столбцы: высота и счётчик слоёв слева, время печати справа. */
const INFO_X = 68;
const LAYERS_VALUE_X = 104;
const TIME_X = 150;
const TIME_VALUE_X = 192;

/**
 * Кубик 20 мм со штриховкой по слоям: передняя грань 30 × 30 px, сверху и справа
 * косые грани, чтобы кубик читался как объёмный.
 */
function CubeIcon({ top, step }: { top: number; step: number }) {
  const lines: number[] = [];

  for (let y = top + 6 + step; y < top + 36; y += step) lines.push(y);

  return (
    <g>
      <polygon points={`20,${top + 6} 28,${top + 2} 58,${top + 2} 50,${top + 6}`} fill="#334155" />
      <polygon
        points={`50,${top + 6} 58,${top + 2} 58,${top + 32} 50,${top + 36}`}
        fill="#1e293b"
        fillOpacity="0.75"
      />
      <rect x="20" y={top + 6} width="30" height="30" fill="#0f172a" fillOpacity="0.35" />
      {lines.map((y) => (
        <line key={y} x1="20" y1={y} x2="50" y2={y} stroke={ACCENT} strokeOpacity="0.6" />
      ))}
      <rect x="20" y={top + 6} width="30" height="30" fill="none" stroke="#475569" />
    </g>
  );
}

/**
 * Кадр блока 9 урока L4 «0,1 / 0,2 / 0,3 мм: вид, слои и время».
 *
 * Компоновка — три полосы сверху вниз: тонкий слой, средний и толстый. Слева
 * кубик 20 мм, у которого штриховка задана высотой слоя: 200 слоёв идут густо,
 * 100 — реже, 67 — совсем редко. Полосы идут именно так, потому что по подписи
 * блока время печати падает вместе с числом слоёв: 1 ч 05 мин, 35 и 24.
 *
 * Числа — из подписи блока 9: высоты 0,1 / 0,2 / 0,3 мм, слоёв 200 / 100 / 67,
 * время 1 ч 05 мин / 35 / 24, пластика 8 г. Размер кубика 20 мм — оттуда же,
 * сопло 0,4 мм — из блока 8, где те же ориентиры даны именно для сопла 0,4 мм.
 * Сопла 0,6 и 0,25 мм в кадр не брали: это отдельный список блока 8.
 */
export function Basic4Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три кубика 20 мм напечатаны с высотой слоя 0,1, 0,2 и 0,3 мм: у тонкого слоя 200 слоёв и время печати 1 ч 05 мин, у среднего 100 слоёв и 35 мин, у толстого 67 слоёв и 24 мин. Пластика уходит 8 г, ориентиры даны для сопла 0,4 мм"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          Высота слоя: вид, слои и время
        </text>

        {/* Три полосы: кубик со штриховкой и три пары «подпись — значение» */}
        {CUBES.map((cube, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={cube.height}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_HEIGHT}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <CubeIcon top={top} step={cube.hatch} />

              <text x={INFO_X} y={top + HEIGHT_Y} fontSize="12" fontWeight="700" fill={ACCENT}>
                {cube.height}
              </text>
              <text x={INFO_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                слоёв
              </text>
              <text x={LAYERS_VALUE_X} y={top + DETAIL_Y} fontSize="10" fill="#e2e8f0">
                {cube.layers}
              </text>
              <text x={TIME_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                время
              </text>
              <text x={TIME_VALUE_X} y={top + DETAIL_Y} fontSize="10" fill="#e2e8f0">
                {cube.time}
              </text>
            </g>
          );
        })}

        {/* Сноска: размер кубика, сопло и расход пластика */}
        <rect x="12" y="156" width="296" height="16" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="168" fontSize="10" fill="#94a3b8">
          кубик 20 мм · сопло 0,4 мм · пластика 8 г у всех
        </text>
      </svg>
    </VisualWrapper>
  );
}
