import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Деталь — синий периметр и оранжевое заполнение, как в кадре предпросмотра. */
const PERIMETER = "#3b82f6";
const INFILL = "#f59e0b";
const RAFT = "#475569";

/** Три полосы по 38 px: 24…62, 65…103, 106…144, сноска в две строки ниже. */
const ROW_TOP = 24;
const ROW_HEIGHT = 38;
const ROW_GAP = 3;

/** Строки внутри полосы: название сверху, назначение и уточнение под ним. */
const NAME_Y = 16;
const DETAIL_Y = 30;

/** Текстовые столбцы: назначение, его значение и уточнение. */
const NAME_X = 68;
const VALUE_X = 134;
const NOTE_X = 210;

/** Деталь в виде сверху: 24 × 24 px, вокруг неё и рисуется первый слой. */
const PART_X = 30;
const PART_Y = 7;

type FirstLayerKind = "skirt" | "brim" | "raft";

type FirstLayerRow = {
  name: string;
  purpose: string;
  note: string;
  kind: FirstLayerKind;
};

/**
 * Три строки ровно по подписям блоков 35 и 33: юбка — для диагностики,
 * кайма 5-8 мм — для адгезии, плот — для кривого стола.
 */
const FIRST_LAYERS: FirstLayerRow[] = [
  { name: "Юбка (skirt)", purpose: "диагностика", note: "без касания", kind: "skirt" },
  { name: "Кайма (brim)", purpose: "адгезия", note: "ширина 5–8 мм", kind: "brim" },
  { name: "Плот (raft)", purpose: "кривой стол", note: "под деталью", kind: "raft" },
];

/**
 * Вид сверху на стол: что печатается вокруг детали. Юбка — один пунктирный
 * контур в стороне, кайма — три сплошных контура вплотную, плот — подстилка
 * под деталью со штриховкой первых слоёв.
 */
function FirstLayer({ kind, top }: { kind: FirstLayerKind; top: number }) {
  if (kind === "skirt") {
    return (
      <rect
        x="25"
        y={top + 2}
        width="34"
        height="34"
        rx="2"
        fill="none"
        stroke={PERIMETER}
        strokeDasharray="3 3"
        strokeOpacity="0.85"
      />
    );
  }

  if (kind === "brim") {
    return (
      <g>
        {[6, 4, 2].map((offset) => (
          <rect
            key={offset}
            x={PART_X - offset}
            y={top + PART_Y - offset}
            width={24 + offset * 2}
            height={24 + offset * 2}
            rx="2"
            fill="none"
            stroke={PERIMETER}
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      <rect x="25" y={top + 2} width="34" height="34" rx="2" fill={RAFT} fillOpacity="0.5" stroke="#64748b" />
      {[6, 14, 22, 30].map((dy) => (
        <line key={dy} x1="25" y1={top + 2 + dy} x2="59" y2={top + 2 + dy} stroke="#64748b" strokeOpacity="0.7" />
      ))}
    </g>
  );
}

/**
 * Кадр блока 35 урока L4 «Юбка, кайма и плот: что выбирать».
 *
 * Три полосы — вид сверху на стол. Деталь везде одна и та же: синий контур и
 * оранжевая штриховка заполнения, как в кадре предпросмотра. Меняется только
 * то, что печатается рядом с ней: юбка идёт отдельным пунктирным контуром и
 * детали не касается, кайма встаёт вплотную тремя контурами на 5-8 мм, плот
 * ложится подстилкой под деталь и выходит из-под неё со всех сторон.
 *
 * Назначения — из подписи блока 35: юбка для диагностики, кайма для адгезии,
 * плот для кривого стола. Ширина каймы и сноска — из блока 33: кайма 5-8 мм
 * для узких и высоких деталей, плот нужен для кривых столов и ABS, но
 * оставляет шершавую нижнюю плоскость.
 */
export function Basic4Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Вид сверху на три варианта первого слоя: юбка идёт отдельным пунктирным контуром и детали не касается, кайма шириной 5-8 мм встаёт вплотную к детали, плот ложится подстилкой под деталь. Юбка нужна для диагностики, кайма для адгезии узких и высоких деталей, плот для кривых столов и ABS, но он оставляет шершавую нижнюю плоскость"
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
          Юбка, кайма и плот: что выбирать
        </text>

        {/* Три полосы: первый слой вокруг детали и его назначение */}
        {FIRST_LAYERS.map((layer, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={layer.name}>
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
              <FirstLayer kind={layer.kind} top={top} />
              <rect x={PART_X} y={top + PART_Y} width="24" height="24" rx="2" fill="#334155" stroke={PERIMETER} />
              <path
                d={`M32 ${top + 15} l 6 -6 M32 ${top + 27} l 18 -18 M40 ${top + 31} l 12 -12`}
                fill="none"
                stroke={INFILL}
                strokeOpacity="0.5"
              />

              <text x={NAME_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={PERIMETER}>
                {layer.name}
              </text>
              <text x={NAME_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                назначение
              </text>
              <text x={VALUE_X} y={top + DETAIL_Y} fontSize="10" fill="#e2e8f0">
                {layer.purpose}
              </text>
              <text x={NOTE_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {layer.note}
              </text>
            </g>
          );
        })}

        {/* Сноска из блока 33: когда нужны кайма и плот */}
        <rect x="12" y="148" width="296" height="28" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="159" fontSize="10" fill="#94a3b8">
          кайма — для узких и высоких деталей · 5–8 мм
        </text>
        <text x="22" y="171" fontSize="10" fill="#94a3b8">
          плот — для ABS и кривых столов · низ шершавый
        </text>
      </svg>
    </VisualWrapper>
  );
}
