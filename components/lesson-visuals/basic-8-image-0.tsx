import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три слайсера из урока: где искать калибровки. */
const panels = [
  { x: 14, name: "Bambu Studio", accent: "#3b82f6", place: "вкладка" },
  { x: 114, name: "Orca Slicer", accent: "#34d399", place: "значок" },
  { x: 214, name: "FlashPrint", accent: "#f59e0b", place: "Tools →" },
];

/** Три пункта меню в выпадающих списках Bambu и FlashPrint. */
const menuItems = [52, 62, 72];

/** Четыре инструмента на панели Orca (второй — калибровка). */
const tools = [0, 18, 36, 54];

/**
 * Где найти калибровки — три мини-экрана по числу слайсеров из урока.
 *
 * Ровно по content урока: «Bambu: вкладка Calibration. Orca: значок Calibration.
 * FlashPrint: Tools → Calibration». В каждом окошке показан свой способ открыть
 * калибровки: активная вкладка, инструмент с перекрестием и выпадающее меню.
 *
 * От схемы окна Orca (урок 3, зоны интерфейса с цифрами 1–4) отличается тем, что
 * здесь именно три разных места поиска в трёх программах, а не разбор одной.
 */
export function Basic8Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Где найти калибровки: в Bambu Studio вкладка Calibration, в Orca Slicer значок Calibration, в FlashPrint пункт Tools — Calibration"
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

        {panels.map((panel, index) => (
          <g key={panel.name}>
            <text x={panel.x} y="26" fontSize="11" fontWeight="bold" fill={panel.accent}>
              {panel.name}
            </text>

            {/* Окно программы */}
            <rect
              x={panel.x}
              y="38"
              width="92"
              height="68"
              rx="6"
              fill="#0f172a"
              stroke="#475569"
            />

            {/* Bambu: активная вкладка и раскрытый список */}
            {index === 0 ? (
              <>
                <rect x={panel.x + 48} y="46" width="34" height="10" rx="3" fill="#334155" />
                <rect x={panel.x + 6} y="42" width="40" height="14" rx="3" fill={panel.accent} />
                <rect x={panel.x + 8} y="60" width="76" height="42" rx="3" fill="#1e293b" />
                {menuItems.map((y, itemIndex) => (
                  <rect
                    key={y}
                    x={panel.x + 12}
                    y={y + 14}
                    width="68"
                    height="6"
                    rx="3"
                    fill={itemIndex === 1 ? panel.accent : "#334155"}
                  />
                ))}
              </>
            ) : null}

            {/* Orca: инструмент с перекрестием и подпись-подсказка */}
            {index === 1 ? (
              <>
                {tools.map((offset, toolIndex) => (
                  <rect
                    key={offset}
                    x={panel.x + 8 + offset}
                    y="48"
                    width="12"
                    height="12"
                    rx="3"
                    fill={toolIndex === 1 ? panel.accent : "#334155"}
                  />
                ))}
                <circle cx={panel.x + 32} cy="54" r="3" fill="none" stroke="#0f172a" />
                <line x1={panel.x + 32} y1="50" x2={panel.x + 32} y2="58" stroke="#0f172a" />
                <line x1={panel.x + 28} y1="54" x2={panel.x + 36} y2="54" stroke="#0f172a" />
                <polygon
                  points={`${panel.x + 36},66 ${panel.x + 42},72 ${panel.x + 32},72`}
                  fill="#1e293b"
                  stroke={panel.accent}
                />
                <rect
                  x={panel.x + 20}
                  y="72"
                  width="56"
                  height="20"
                  rx="4"
                  fill="#1e293b"
                  stroke={panel.accent}
                />
              </>
            ) : null}

            {/* FlashPrint: меню Tools и выпадающий список */}
            {index === 2 ? (
              <>
                <rect x={panel.x + 6} y="44" width="22" height="10" rx="3" fill="#334155" />
                <rect x={panel.x + 6} y="60" width="76" height="42" rx="3" fill="#1e293b" />
                {menuItems.map((y, itemIndex) => (
                  <rect
                    key={y}
                    x={panel.x + 10}
                    y={y + 14}
                    width="68"
                    height="6"
                    rx="3"
                    fill={itemIndex === 2 ? panel.accent : "#334155"}
                  />
                ))}
              </>
            ) : null}

            {/* Где именно искать */}
            <text x={panel.x} y="122" fontSize="10" fill="#e2e8f0">
              {panel.place}
            </text>
            <text x={panel.x} y="138" fontSize="10" fill={panel.accent}>
              Calibration
            </text>
          </g>
        ))}

        <text x="14" y="162" fontSize="10" fill="#94a3b8">
          Встроены в слайсер: открываешь меню — печатаешь
        </text>
      </svg>
    </VisualWrapper>
  );
}
