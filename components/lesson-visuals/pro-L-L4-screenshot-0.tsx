import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Вертикали и горизонтали сетки рабочей плоскости. */
const GRID_X = [52, 88, 124, 160, 196, 232, 268, 304];
const GRID_Y = [68, 96, 124];

/** Призрачные позиции летящей фигуры и её конечная точка. */
const GHOSTS = [
  [150, 112],
  [176, 98],
];

/** Дуга перетаскивания от палитры к детали. */
const DRAG_ARC = [
  [116, 128],
  [140, 124],
  [166, 110],
  [190, 94],
  [200, 88],
];

/**
 * Tinkercad, акт перетаскивания: рабочая плоскость с сеткой и осями, примитив
 * летит от палитры по дуге к детали, оставляя призрачный след, и «прилипает»
 * гранью к подсвеченной стороне брелока, который уже собран справа.
 *
 * Ровно по content урока: «Скриншот: простая модель брелока. Drag-and-drop».
 *
 * От basic-13-image-0 (схема экрана Tinkercad: инструменты, рабочая область,
 * панель фигур, кнопка «Экспорт») отличается тем, что интерфейса нет вовсе: ни
 * панелей, ни вкладок, ни кнопок — только жест в крупном плане. От G-G2-screenshot-0
 * (деталь и панель опций) и F-F4-screenshot-0 (рабочая область и панель Bodies)
 * — тем же: здесь нет ни списков, ни настроек.
 */
export function ProLL4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Tinkercad, перетаскивание: рабочая плоскость с сеткой и осями, из палитры слева примитив летит по дуге к детали, оставляя призрачный след, и прилипает гранью к подсвеченной стороне брелока с отверстием под кольцо"
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
          Перетаскивание: фигура к детали
        </text>
        <text x="12" y="30" fontSize="7.5" fill="#94a3b8">
          Tinkercad: рабочая плоскость
        </text>

        {/* Рабочая плоскость с сеткой и осями */}
        <rect x="16" y="40" width="288" height="110" rx="4" fill="#1e293b" />
        {GRID_X.map((x) => (
          <line key={`gx-${x}`} x1={x} y1="40" x2={x} y2="150" stroke="#334155" strokeWidth="1" />
        ))}
        {GRID_Y.map((y) => (
          <line key={`gy-${y}`} x1="16" y1={y} x2="304" y2={y} stroke="#334155" strokeWidth="1" />
        ))}
        <line x1="36" y1="146" x2="96" y2="146" stroke="#f87171" strokeWidth="1.6" />
        <line x1="36" y1="146" x2="36" y2="86" stroke="#34d399" strokeWidth="1.6" />


        {/* Палитра примитивов слева */}
        <polygon points="48,118 58,114 68,118 68,132 58,136 48,132" fill="#64748b" />
        <rect x="76" y="118" width="16" height="14" fill="#64748b" />
        <ellipse cx="84" cy="118" rx="8" ry="3" fill="#94a3b8" />
        <polygon points="100,136 108,116 116,136" fill="#64748b" />

        {/* Летящая фигура: призрачный след и дуга перетаскивания */}
        <polyline
          points={DRAG_ARC.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        {GHOSTS.map(([cx, cy]) => (
          <circle
            key={`ghost-${cx}`}
            cx={cx}
            cy={cy}
            r="8"
            fill="none"
            stroke="#7dd3fc"
            strokeOpacity="0.35"
            strokeWidth="1.2"
          />
        ))}
        <rect x="191" y="84" width="18" height="6" fill="#7dd3fc" />
        <ellipse cx="200" cy="90" rx="9" ry="3.5" fill="#bae6fd" />
        <circle cx="200" cy="84" r="9" fill="#7dd3fc" />

        {/* Брелок: деталь с отверстием и подсвеченной гранью-«магнитом» */}
        <rect x="232" y="88" width="60" height="22" rx="4" fill="#475569" />
        <circle cx="244" cy="99" r="4" fill="#0f172a" />
        <line x1="232" y1="88" x2="232" y2="110" stroke="#34d399" strokeWidth="2.4" />

        <text x="12" y="168" fontSize="7.5" fill="#e2e8f0">
          перетащи фигуру
        </text>
        <text x="96" y="168" fontSize="7.5" fill="#e2e8f0">
          фигура прилипает к грани
        </text>
        <text x="228" y="168" fontSize="7.5" fill="#e2e8f0">
          готовый брелок
        </text>
      </svg>
    </VisualWrapper>
  );
}
