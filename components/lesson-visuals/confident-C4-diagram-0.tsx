import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Маршруты: строки 26…150, высота 36, центры 44, 88 и 132; стрелка от 246. */
const ROW_Y = [26, 70, 114];
const ROW_H = 36;
const ROW_W = 232;
const CHIP_CX = 36;
const TEXT_X = 56;
const ARROW_X = ROW_W + 14;

type Route = { label: string; note: string; extra: string; color: string; target: [number, number] };

/** Маршруты и точки контакта на фигуре — блок 4; кожа, пары и глаза — блоки 5, 6, 8, 9, 15. */
const ROUTES: Route[] = [
  {
    label: "Слизистые и глаза",
    note: "брызги при промывке: закрытые очки",
    extra: "открытые брызги почти не держат",
    color: "#3b82f6",
    target: [273, 48],
  },
  {
    label: "Дыхание",
    note: "пары тяжелее воздуха, они внизу",
    extra: "открытая банка пахнет постоянно",
    color: "#f59e0b",
    target: [270, 92],
  },
  {
    label: "Кожа — главный вход",
    note: "смола, ИПС и ацетон сушат кожу",
    extra: "сухость → трещины → боль",
    color: "#f87171",
    target: [262, 128],
  },
];

const NOTES = [
  "Сначала убери контакт — перчатки последний слой",
  "Сенсибилизация копится месяцами: решает привычка",
];

/** Стрелка от строки к точке контакта: линия в разметке, здесь треугольник на конце. */
function arrowHead(tipX: number, tipY: number, fromX: number, fromY: number) {
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tipX - 6 * ux;
  const baseY = tipY - 6 * uy;
  return `${tipX},${tipY} ${baseX + 3 * uy},${baseY - 3 * ux} ${baseX - 3 * uy},${baseY + 3 * ux}`;
}

/**
 * Кадр блока 4 урока C4 «Три пути химии в тело».
 *
 * Три маршрута из описания кадра `C4_exposure_routes.png` и блоков 5, 6, 8, 9,
 * 11, 15: брызги при промывке летят на слизистые и глаза, поэтому минимум —
 * закрытые очки, а открытые брызги почти не держат (блок 15); пары тяжелее
 * воздуха и опускаются вниз, открытая банка со спиртом пахнет постоянно
 * (блок 8), а знак «восклицательный знак» помечает раздражение кожи, глаз и
 * дыхания (блок 9); кожа — главный вход, потому что смола, ИПС и ацетон
 * снимают защитный слой, сухость переходит в трещины и боль, через царапину
 * вещество входит быстрее (блоки 5, 6). Нижние строки — блоки 11 и 7: сначала
 * убирают контакт, перчатки остаются последним слоем, а сенсибилизация копится
 * месяцами, потому что решает привычка, а не случай.
 */
export function ConfidentC4Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три пути химии в тело. Слизистые и глаза: брызги при промывке закрывают закрытыми очками, открытые брызги почти не держат. Дыхание: пары тяжелее воздуха, они опускаются вниз, открытая банка со спиртом пахнет постоянно. Кожа — главный вход: смола, ИПС и ацетон сушат кожу, сухость переходит в трещины и боль. Сначала убери контакт: перчатки — последний слой, а не первый. Сенсибилизация копится месяцами, решает привычка, а не случай"
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
          Три пути химии в тело
        </text>

        {/* Фигура справа: глаза, грудь и кисть — точки контакта */}
        <g fill="#94a3b8" fillOpacity="0.16" stroke="#64748b" strokeOpacity="0.7">
          <circle cx="282" cy="46" r="9" />
          <line x1="282" y1="55" x2="282" y2="64" />
          <rect x="270" y="64" width="24" height="40" rx="8" />
          <polyline points="272,76 263,104 262,128" fill="none" />
          <polyline points="292,76 301,104 302,128" fill="none" />
          <polyline points="278,104 273,148" fill="none" />
          <polyline points="286,104 291,148" fill="none" />
        </g>

        {/* Три маршрута: от строки к своей точке на фигуре */}
        {ROUTES.map((route, index) => {
          const center = ROW_Y[index] + ROW_H / 2;
          const [tipX, tipY] = route.target;
          return (
            <g key={route.label}>
              <rect
                x="12"
                y={ROW_Y[index]}
                width={ROW_W}
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <circle
                cx={CHIP_CX}
                cy={center}
                r="10"
                fill={route.color}
                fillOpacity="0.16"
                stroke={route.color}
                strokeOpacity="0.6"
              />
              <text
                x={CHIP_CX}
                y={center + 4}
                fontSize="10"
                fontWeight="700"
                fill={route.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TEXT_X} y={center - 6} fontSize="11" fontWeight="700" fill={route.color}>
                {route.label}
              </text>
              <text x={TEXT_X} y={center + 5} fontSize="10" fill="#cbd5e1">
                {route.note}
              </text>
              <text x={TEXT_X} y={center + 15} fontSize="10" fill="#94a3b8">
                {route.extra}
              </text>
              <line
                x1={ARROW_X}
                y1={center}
                x2={tipX - 5}
                y2={tipY}
                stroke={route.color}
                strokeOpacity="0.6"
              />
              <polygon
                points={arrowHead(tipX - 4, tipY, ARROW_X, center)}
                fill={route.color}
                fillOpacity="0.85"
              />
              <circle cx={tipX} cy={tipY} r="3" fill={route.color} fillOpacity="0.85" />
            </g>
          );
        })}

        {/* Порядок защиты и привычка: базовая линия ≤ 172, иначе низ строки
            упирается в рамку карточки на узких экранах */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={159 + index * 11}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
