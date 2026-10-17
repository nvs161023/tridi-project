import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно панели: 12…308 по X, 18…138 по Y, заголовок 16. */
const WIN_Y = 18;
const WIN_H = 120;
const BAR_H = 16;
const VALUE_X = 304;

type Tile = { label: string; value: string };

/** Два температурных поля панели. */
const TILES: Tile[] = [
  { label: "Сопло", value: "210 / 210 °C" },
  { label: "Стол", value: "60 / 60 °C" },
];

/**
 * Кадр блока 6 урока C12 «Панель управления в браузере».
 *
 * Макет из описания кадра `C12_web_ui.png`: температуры сопла и стола, прогресс
 * детали, кнопки паузы и отмены, окно камеры. Блок 4 перечисляет, что умеет
 * веб-панель, блок 5 объясняет, что OctoPrint ставится на Raspberry Pi.
 */
export function ConfidentC12Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Панель управления в браузере: окно OctoPrint в состоянии печати. Слева температуры сопла 210 и стола 60, в центре прогресс детали 46 процентов и время 1:12 из 2:35, кнопки паузы и отмены. Справа окно камеры с отметкой LIVE. Панель показывает состояние принтера и принимает команды из браузера"
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          панель на плате, экран в браузере
        </text>

        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.9"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          OctoPrint
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#34d399" textAnchor="end">
          печатает
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Температуры */}
        {TILES.map((tile, index) => {
          const y = 38 + index * 38;
          return (
            <g key={tile.label}>
              <rect
                x="16"
                y={y}
                width="82"
                height="34"
                rx="5"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke="#475569"
                strokeOpacity="0.7"
              />
              <text x="22" y={y + 12} fontSize="10" fill="#94a3b8">
                {tile.label}
              </text>
              <text x="22" y={y + 26} fontSize="10" fontWeight="700" fill="#fcd34d">
                {tile.value}
              </text>
            </g>
          );
        })}

        {/* Прогресс детали */}
        <text x="104" y="50" fontSize="10" fill="#94a3b8">
          Деталь 3 из 8
        </text>
        <text x="104" y="68" fontSize="10" fontWeight="700" fill="#fcd34d">
          46 %
        </text>
        <rect x="104" y="74" width="92" height="6" rx="3" fill="#334155" />
        <rect x="104" y="74" width="42" height="6" rx="3" fill="#10b981" />
        <text x="104" y="92" fontSize="10" fill="#cbd5e1">
          1:12 из 2:35
        </text>

        {/* Кнопки управления */}
        <rect
          x="104"
          y="100"
          width="44"
          height="16"
          rx="4"
          fill="transparent"
          stroke="#60a5fa"
          strokeOpacity="0.7"
        />
        <text x="126" y="111" fontSize="10" fill="#60a5fa" textAnchor="middle">
          Пауза
        </text>
        <rect
          x="152"
          y="100"
          width="40"
          height="16"
          rx="4"
          fill="transparent"
          stroke="#f87171"
          strokeOpacity="0.7"
        />
        <text x="172" y="111" fontSize="10" fill="#f87171" textAnchor="middle">
          Отмена
        </text>

        {/* Окно камеры */}
        <rect
          x="202"
          y="38"
          width="102"
          height="74"
          rx="5"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <text x="208" y="50" fontSize="10" fill="#94a3b8">
          камера
        </text>
        <rect x="206" y="54" width="94" height="46" fill="#1e293b" fillOpacity="0.7" />
        <line x1="210" y1="92" x2="296" y2="92" stroke="#64748b" />
        <rect x="238" y="80" width="26" height="12" fill="#60a5fa" fillOpacity="0.2" stroke="#60a5fa" strokeOpacity="0.7" />
        <polygon points="251,64 245,80 257,80" fill="#94a3b8" />
        <text x="294" y="105" fontSize="10" fontWeight="700" fill="#f87171" textAnchor="end">
          LIVE
        </text>

        <text x="12" y="152" fontSize="10" fill="#cbd5e1">
          Температуры, прогресс и камера — на одном экране
        </text>
        <text x="12" y="166" fontSize="10" fill="#94a3b8">
          Пауза и отмена работают из браузера
        </text>
      </svg>
    </VisualWrapper>
  );
}
