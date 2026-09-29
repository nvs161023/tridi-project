import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Каждая группа гнёзд набрана одинаковым блоком-колодкой. */
const BLOCK = { width: 62, height: 16 };

/** Шесть групп гнёзд: цвет колодки и подписи — по назначению. */
const GROUPS = [
  { id: "motors", label: "моторы X Y Z E", color: "#60a5fa", slots: 4, x: 26, y: 54 },
  { id: "heat", label: "нагрев: hotend, bed", color: "#f87171", slots: 2, x: 122, y: 54 },
  { id: "sensors", label: "датчики: термистор", color: "#38bdf8", slots: 2, x: 218, y: 54 },
  { id: "fans", label: "вентиляторы", color: "#a78bfa", slots: 2, x: 26, y: 100 },
  { id: "endstops", label: "концевики X Y Z", color: "#34d399", slots: 3, x: 122, y: 100 },
  { id: "drivers", label: "драйверы TMC2209", color: "#fbbf24", slots: 4, x: 218, y: 100 },
];

/** Гнёзда узких разъёмов: по одной ячейке на пин. */
const XH_PINS = [38, 48, 58, 68];
const PH_PINS = [114, 123, 132];

/** Гнёзда Molex: два ряда по три пина. */
const MOLEX_PINS = [
  { x: 246, y: 129.5 },
  { x: 260, y: 129.5 },
  { x: 274, y: 129.5 },
  { x: 246, y: 135.5 },
  { x: 260, y: 135.5 },
  { x: 274, y: 135.5 },
];

/**
 * Плата принтера — ОДНА плата плашмя. Сверху шесть групп гнёзд-колодок
 * (моторы, нагрев, датчики, вентиляторы, концевики, питание), снизу четыре
 * разъёма, каждый узнаётся по своей форме: JST-XH, JST-PH, XT60 и Molex.
 */
export function ProC2C21Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Плата принтера плашмя: шесть групп гнёзд-колодок — моторы X Y Z E, драйверы TMC2209, нагрев хотэнда и стола, датчики с термистором, вентиляторы и концевики X Y Z, а внизу четыре разъёма, каждый со своей формой: JST-XH, JST-PH, XT60 и Molex."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Плата принтера: гнёзда и разъёмы
        </text>

        {/* Одна плата плашмя */}
        <rect x="12" y="22" width="296" height="152" rx="10" fill="#0f172a" stroke="#22c55e" strokeWidth="1.2" />

        {GROUPS.map((group) => {
          const slotWidth = (BLOCK.width - 4 * (group.slots + 1)) / group.slots;
          return (
            <g key={group.id}>
              <text x={group.x} y={group.y - 12} fontSize="8" fill={group.color}>
                {group.label}
              </text>
              <rect
                x={group.x}
                y={group.y}
                width={BLOCK.width}
                height={BLOCK.height}
                rx="2"
                fill="#334155"
                stroke={group.color}
                strokeWidth="1.2"
              />
              {Array.from({ length: group.slots }, (_, index) => {
                const x = group.x + 4 + index * (slotWidth + 4);
                return (
                  <g key={`${group.id}-${index}`}>
                    <rect
                      x={x}
                      y={group.y + 3}
                      width={slotWidth}
                      height={BLOCK.height - 6}
                      fill="#0f172a"
                      stroke="#94a3b8"
                      strokeWidth="0.8"
                    />
                    <line
                      x1={x + slotWidth * 0.32}
                      y1={group.y + 5}
                      x2={x + slotWidth * 0.32}
                      y2={group.y + BLOCK.height - 5}
                      stroke="#94a3b8"
                      strokeWidth="0.9"
                    />
                    <line
                      x1={x + slotWidth * 0.68}
                      y1={group.y + 5}
                      x2={x + slotWidth * 0.68}
                      y2={group.y + BLOCK.height - 5}
                      stroke="#94a3b8"
                      strokeWidth="0.9"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* Разъём JST-XH: широкий корпус с защёлкой сверху */}
        <rect x="52" y="120" width="8" height="4" rx="1" fill="#334155" stroke="#e2e8f0" />
        <rect x="34" y="124" width="44" height="18" rx="2.5" fill="#334155" stroke="#e2e8f0" strokeWidth="1.2" />
        {XH_PINS.map((x) => (
          <rect key={`xh-${x}`} x={x} y="130" width="6" height="6" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
        ))}
        <text x="56" y="156" fontSize="8" fill="#e2e8f0" textAnchor="middle">
          JST-XH
        </text>

        {/* Разъём JST-PH: тот же вид, но корпус уже и на три пина */}
        <rect x="122" y="124" width="6" height="4" rx="1" fill="#334155" stroke="#cbd5e1" />
        <rect x="110" y="128" width="32" height="14" rx="2" fill="#334155" stroke="#cbd5e1" strokeWidth="1.2" />
        {PH_PINS.map((x) => (
          <rect key={`ph-${x}`} x={x} y="132" width="6" height="5" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
        ))}
        <text x="126" y="156" fontSize="8" fill="#cbd5e1" textAnchor="middle">
          JST-PH
        </text>

        {/* Разъём XT60: трапеция с двумя силовыми контактами-пулями */}
        <polygon points="168,124 224,124 228,142 164,142" fill="#334155" stroke="#fbbf24" strokeWidth="1.2" />
        <rect x="174" y="130" width="16" height="8" rx="4" fill="#0f172a" stroke="#fbbf24" strokeWidth="1" />
        <rect x="198" y="130" width="16" height="8" rx="4" fill="#0f172a" stroke="#fbbf24" strokeWidth="1" />
        <text x="196" y="156" fontSize="8" fill="#fbbf24" textAnchor="middle">
          XT60
        </text>

        {/* Разъём Molex: два ряда по три пина и ключ справа */}
        <rect x="252" y="122" width="10" height="4" rx="1" fill="#334155" stroke="#f472b6" />
        <rect x="240" y="126" width="52" height="16" rx="2" fill="#334155" stroke="#f472b6" strokeWidth="1.2" />
        {MOLEX_PINS.map((pin) => (
          <rect
            key={`molex-${pin.x}-${pin.y}`}
            x={pin.x}
            y={pin.y}
            width="10"
            height="4.5"
            fill="#0f172a"
            stroke="#94a3b8"
            strokeWidth="0.7"
          />
        ))}
        <rect x="286" y="130" width="4" height="8" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.7" />
        <text x="266" y="156" fontSize="8" fill="#f472b6" textAnchor="middle">
          Molex
        </text>
      </svg>
    </VisualWrapper>
  );
}
