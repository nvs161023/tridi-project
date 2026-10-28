import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три покрытия — три цвета: гладкий PEI синий, текстура янтарная, G10 изумрудный. */
const SMOOTH = "#3b82f6";
const GRAIN = "#f59e0b";
const G10 = "#10b981";

/** Три полосы по 40 px и зазор 3 px: 24…64, 67…107, 110…150. */
const ROW_TOP = 24;
const ROW_HEIGHT = 40;
const ROW_GAP = 3;

/** Строки полосы: название и температура сверху, пояснение под ними. */
const NAME_Y = 16;
const DETAIL_Y = 31;

/** Плитка покрытия слева, текст с 68, температура в правой колонке. */
const ICON_X = 20;
const TEXT_X = 68;
const TEMP_X = 252;

type Surface = {
  name: string;
  color: string;
  temp: string;
  detail: string;
  texture: "smooth" | "grain" | "weave";
};

/**
 * Три покрытия ровно по подписи блока 10: гладкий PEI 50-60 °C, текстура
 * 60-80 °C, G10 70-90 °C. Кому что даёт — из блока 9 (PLA и PETG без клея на
 * гладком, PETG и ABS заметно лучше на текстуре, G10 держит без клея, но требует
 * обезжиривания) и из блока 8: важно, какой низ нужен детали.
 */
const SURFACES: Surface[] = [
  {
    name: "Гладкий PEI",
    color: SMOOTH,
    temp: "50–60 °C",
    detail: "PLA и PETG без клея, низ глянцевый",
    texture: "smooth",
  },
  {
    name: "Текстурированный PEI",
    color: GRAIN,
    temp: "60–80 °C",
    detail: "шагрень на низу, PETG и ABS держит лучше",
    texture: "grain",
  },
  {
    name: "G10 / FR4",
    color: G10,
    temp: "70–90 °C",
    detail: "PETG и ABS без клея, обезжиривать тщательнее",
    texture: "weave",
  },
];

/** Плитка в полосе: гладкая с бликом, с шагренью и с плетением стеклотекстолита. */
function Plate({ kind, top }: { kind: Surface["texture"]; top: number }) {
  const face = top + 12;

  return (
    <g>
      <rect x={ICON_X} y={face} width="36" height="10" rx="2" fill="#334155" stroke="#64748b" />

      {kind === "smooth" ? (
        <line x1={ICON_X + 3} y1={face + 3} x2={ICON_X + 29} y2={face + 3} stroke="#cbd5e1" strokeOpacity="0.55" />
      ) : null}

      {kind === "grain" ? (
        <path
          d={`M${ICON_X + 1} ${face} q3 -3 6 0 q3 3 6 0 q3 -3 6 0 q3 3 6 0 q3 -3 6 0 q3 3 5 0`}
          fill="none"
          stroke="#94a3b8"
        />
      ) : null}

      {kind === "weave" ? (
        <g stroke="#94a3b8" strokeOpacity="0.75">
          {[9, 18, 27].map((dx) => (
            <line key={`v${dx}`} x1={ICON_X + dx} y1={face} x2={ICON_X + dx} y2={face + 10} />
          ))}
          <line x1={ICON_X} y1={face + 5} x2={ICON_X + 36} y2={face + 5} />
        </g>
      ) : null}
    </g>
  );
}

/**
 * Кадр блока 10 урока L5 «Столы под задачу».
 *
 * Компоновка — три полосы сверху вниз: слева плитка покрытия, справа название,
 * температура и то, кому это покрытие нужно. Порядок от холодного стола к
 * горячему: гладкий PEI 50-60 °C, текстура 60-80 °C, G10 70-90 °C — цифры из
 * подписи блока 10. Пояснения — из блоков 8 и 9. Сноска — из блока 8: настройки
 * нельзя переносить между покрытиями, зазор с одного стола на другом станет
 * скребком или свободным.
 */
export function Basic5Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три покрытия стола под задачу: гладкий PEI при 50–60 градусах, PLA и PETG без клея, низ детали глянцевый; текстурированный PEI при 60–80 градусах, шагрень переносится на низ, PETG и ABS держит лучше гладкого; стеклотекстолит G10 при 70–90 градусах, PETG и ABS без клея, но обезжиривать надо тщательнее. Один стол — один набор настроек: зазор, температура и Z-offset"
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
          Столы под задачу
        </text>

        {/* Три полосы: плитка, название, температура и пояснение */}
        {SURFACES.map((surface, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={surface.name}>
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
              <Plate kind={surface.texture} top={top} />
              <text x={TEXT_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={surface.color}>
                {surface.name}
              </text>
              <text x={TEMP_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill="#e2e8f0">
                {surface.temp}
              </text>
              <text x={TEXT_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {surface.detail}
              </text>
            </g>
          );
        })}

        {/* Сноска из блока 8 */}
        <rect x="12" y="156" width="296" height="20" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
        <text x="22" y="164" fontSize="10" fill="#94a3b8">
          один стол — один набор настроек
        </text>
        <text x="22" y="172" fontSize="10" fill="#94a3b8">
          зазор, температура, Z-offset
        </text>
      </svg>
    </VisualWrapper>
  );
}
