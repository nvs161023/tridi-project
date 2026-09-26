import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Красный — цвет дефекта на миниатюре, тёмно-серый — соседняя годная геометрия. */
const RED = "#f87171";
const SLAB = "#334155";

/** Пять колонок сетки: плитка 52 px, шаг между центрами 62 px. */
const columns = [10, 72, 134, 196, 258];

/** Два ряда: плитка 30 px, под ней две строки подписи (имя дефекта и подсказка). */
const rows = [
  { tileY: 22, nameY: 68, hintY: 83 },
  { tileY: 96, nameY: 142, hintY: 157 },
];

const TILE_WIDTH = 52;

/**
 * Десять дефектов: имя (content урока) и подсказка из блока «Топ-10 и решения».
 * Порядок чтения: 5 плиток в верхнем ряду, 5 в нижнем.
 */
const defects = [
  { kind: "detach", name: "не прилипло", hint: "помой стол" },
  { kind: "strings", name: "паутинки", hint: "ретракт" },
  { kind: "layers", name: "не склеены", hint: "+5–10 °C" },
  { kind: "overhang", name: "свисает", hint: "поддержки" },
  { kind: "waves", name: "волны", hint: "ускорение" },
  { kind: "gaps", name: "пропуски", hint: "сушка" },
  { kind: "cracks", name: "трещины", hint: "охлаждение" },
  { kind: "corners", name: "неровные углы", hint: "Jerk 8–12" },
  { kind: "thin", name: "тонкий слой", hint: "Z-offset +" },
  { kind: "thick", name: "толстый слой", hint: "Z-offset −" },
];

/** Мини-профиль дефекта: своя картинка внутри плитки 52×30 (x, y — её левый верх). */
function defectGlyph(kind: string, x: number, y: number) {
  switch (kind) {
    case "detach":
      return (
        <>
          <line x1={x + 8} y1={y + 27} x2={x + 44} y2={y + 27} stroke="#475569" strokeWidth="2" />
          <path d={`M${x + 10},${y + 22} q 16,-9 32,-1`} fill="none" stroke={RED} strokeWidth="2.5" />
          <path
            d={`M${x + 26},${y + 11} l 0,-4 m -3,3 l 3,-3 l 3,3`}
            fill="none"
            stroke={RED}
            strokeWidth="1.8"
          />
        </>
      );
    case "strings":
      return (
        <>
          <rect x={x + 9} y={y + 6} width="8" height="20" rx="2" fill={SLAB} />
          <rect x={x + 35} y={y + 6} width="8" height="20" rx="2" fill={SLAB} />
          <line x1={x + 17} y1={y + 8} x2={x + 35} y2={y + 20} stroke={RED} strokeWidth="1.2" />
          <line x1={x + 17} y1={y + 15} x2={x + 35} y2={y + 13} stroke={RED} strokeWidth="1.2" />
          <line x1={x + 17} y1={y + 22} x2={x + 35} y2={y + 18} stroke={RED} strokeWidth="1.2" />
        </>
      );
    case "layers":
      return (
        <>
          <rect x={x + 9} y={y + 5} width="34" height="5" rx="1" fill={SLAB} />
          <rect x={x + 9} y={y + 12} width="34" height="5" rx="1" fill={SLAB} />
          <rect x={x + 9} y={y + 19} width="34" height="5" rx="1" fill={SLAB} />
          <line x1={x + 9} y1={y + 11} x2={x + 43} y2={y + 11} stroke={RED} strokeWidth="1.5" />
          <line x1={x + 9} y1={y + 18} x2={x + 43} y2={y + 18} stroke={RED} strokeWidth="1.5" />
        </>
      );
    case "overhang":
      return (
        <>
          <rect x={x + 9} y={y + 5} width="34" height="5" rx="1" fill={SLAB} />
          <rect x={x + 29} y={y + 10} width="14" height="14" fill="#1e293b" stroke="#475569" />
          <path
            d={`M${x + 13},${y + 10} q 3,12 10,10 q 7,-2 4,-10`}
            fill="none"
            stroke={RED}
            strokeWidth="2.5"
          />
        </>
      );
    case "waves":
      return (
        <>
          <line
            x1={x + 8}
            y1={y + 16}
            x2={x + 41}
            y2={y + 16}
            stroke="#475569"
            strokeDasharray="3 3"
          />
          <path
            d={`M${x + 8},${y + 16} q 5.5,-10 11,0 t 11,0 t 11,0`}
            fill="none"
            stroke={RED}
            strokeWidth="2.5"
          />
        </>
      );


    case "gaps":
      return (
        <>
          <rect x={x + 7} y={y + 11} width="38" height="8" rx="2" fill={SLAB} />
          <rect x={x + 13} y={y + 11} width="3" height="8" fill={RED} />
          <rect x={x + 24} y={y + 11} width="3" height="8" fill={RED} />
          <rect x={x + 35} y={y + 11} width="3" height="8" fill={RED} />
        </>
      );
    case "cracks":
      return (
        <>
          <line x1={x + 9} y1={y + 6} x2={x + 43} y2={y + 6} stroke="#475569" strokeWidth="1.5" />
          <line x1={x + 9} y1={y + 12} x2={x + 43} y2={y + 12} stroke="#475569" strokeWidth="1.5" />
          <line x1={x + 9} y1={y + 18} x2={x + 43} y2={y + 18} stroke="#475569" strokeWidth="1.5" />
          <line x1={x + 9} y1={y + 24} x2={x + 43} y2={y + 24} stroke="#475569" strokeWidth="1.5" />
          <polyline
            points={`${x + 26},${y + 5} ${x + 21},${y + 11} ${x + 27},${y + 17} ${x + 22},${y + 23} ${x + 26},${y + 27}`}
            fill="none"
            stroke={RED}
            strokeWidth="2"
          />
        </>
      );
    case "corners":
      return (
        <>
          <rect
            x={x + 11}
            y={y + 6}
            width="30"
            height="18"
            rx="9"
            fill="none"
            stroke={RED}
            strokeWidth="2.5"
          />
          <polygon points={`${x + 44},${y + 5} ${x + 38},${y + 9} ${x + 44},${y + 13}`} fill={RED} />
        </>
      );
    case "thin":
      return (
        <>
          <line x1={x + 8} y1={y + 24} x2={x + 44} y2={y + 24} stroke="#475569" strokeWidth="2" />
          <rect x={x + 8} y={y + 19} width="36" height="2.5" rx="1" fill={RED} />
          <path
            d={`M${x + 26},${y + 7} l 0,6 m -3,-3 l 3,3 l 3,-3`}
            fill="none"
            stroke={RED}
            strokeWidth="1.8"
          />
        </>
      );
    case "thick":
    default:
      return (
        <>
          <line x1={x + 8} y1={y + 26} x2={x + 44} y2={y + 26} stroke="#475569" strokeWidth="2" />
          <path d={`M${x + 7},${y + 26} q 4,-13 19,-13 q 15,0 19,13 z`} fill={RED} />
        </>
      );
  }
}

/**
 * Карта дефектов — сетка 2×5: десять плиток с мини-профилем и подписью.
 *
 * Ровно по content урока: «10 фото: не прилипло, паутинки, слои не склеены, свисает,
 * волны, пропуски, трещины, неровные углы, тонкий/толстый слой». Вторая строка
 * подписи — подсказка из блока «Топ-10 и решения» того же урока: что менять.
 *
 * От остальных визуализаций отличается форматом: это единственная сетка в базовом
 * курсе. Раньше дефект показывали крупно и по одному (разрезы первого слоя в уроке
 * 4), здесь все десять сразу — плитками, чтобы искать похожий на свой брак.
 */
export function Basic10Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта дефектов: десять миниатюр — не прилипло, паутинки, слои не склеены, свисает, волны, пропуски, трещины, неровные углы, тонкий и толстый слой, с подсказками что менять"
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

        {defects.map((defect, index) => {
          const x = columns[index % columns.length];
          const row = rows[Math.floor(index / columns.length)];
          const cx = x + TILE_WIDTH / 2;

          return (
            <g key={defect.name}>
              <rect
                x={x}
                y={row.tileY}
                width="52"
                height="30"
                rx="6"
                fill="#0f172a"
                stroke="#334155"
              />
              {defectGlyph(defect.kind, x, row.tileY)}
              <text x={cx} y={row.nameY} fontSize="8" fill="#e2e8f0" textAnchor="middle">
                {defect.name}
              </text>
              <text x={cx} y={row.hintY} fontSize="8" fill="#94a3b8" textAnchor="middle">
                {defect.hint}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
