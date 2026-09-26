import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Ряд пинов гребёнки на платах: восемь контактов с шагом 8 px. */
const pins = [0, 8, 16, 24, 32, 40, 48, 56];

/** Три прошивки из content урока: имя над платой и две подписи под ней. */
const systems = [
  { center: 52, name: "Marlin", first: "расчёт на плате", second: "и ведёт моторы" },
  { center: 160, name: "Klipper", first: "считает хост — Pi", second: "плата ведёт моторы" },
  { center: 268, name: "RepRapFirmware", first: "плата Duet", second: "и макросы" },
];

/**
 * Сравнение прошивок — три «мозга» из content урока, и главное в них то, где
 * считаются движения: Marlin считает на плате принтера, Klipper — на хосте
 * Raspberry Pi, RepRapFirmware — на плате Duet со своими макросами.
 *
 * Панелей и рамок в кадре нет: нарисованы три разных железных предмета — плата
 * принтера, плата Raspberry Pi со стрелкой вниз на плату с драйверами и плата
 * Duet. От «Трёх схем кинематики» из модуля A отличается и предметом, и
 * приёмом: там три одинаковые панели со схемами движения, здесь три платы с
 * разной начинкой и колонки разной высоты.
 */
export function ProB4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение прошивок по месту расчёта: Marlin считает движения на плате принтера, Klipper — на хосте Raspberry Pi и передаёт плате только управление моторами, RepRapFirmware работает на плате Duet и умеет макросы"
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

        {systems.map((system) => (
          <text
            key={system.name}
            x={system.center}
            y="18"
            fontSize="10"
            fontWeight="bold"
            fill="#93c5fd"
            textAnchor="middle"
          >
            {system.name}
          </text>
        ))}

        {/* Marlin: плата принтера — и расчёт, и драйверы на ней */}
        <rect x="14" y="30" width="76" height="48" rx="3" fill="#1e3a5f" stroke="#3b82f6" />
        <rect x="28" y="40" width="30" height="22" fill="#334155" stroke="#94a3b8" />
        <rect x="66" y="38" width="18" height="8" fill="#334155" stroke="#94a3b8" />
        <rect x="66" y="50" width="18" height="8" fill="#334155" stroke="#94a3b8" />
        <rect x="66" y="62" width="18" height="8" fill="#334155" stroke="#94a3b8" />
        <rect x="18" y="66" width="8" height="8" fill="#0f172a" stroke="#64748b" />

        {/* Klipper: Raspberry Pi считает, плата только ведёт моторы */}
        <rect x="126" y="30" width="70" height="16" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
        {pins.map((offset) => (
          <rect
            key={offset}
            x={130 + offset}
            y="32"
            width="5"
            height="6"
            fill="#334155"
            stroke="#94a3b8"
          />
        ))}
        <line x1="160" y1="48" x2="160" y2="54" stroke="#38bdf8" strokeWidth="1.4" />
        <polygon points="157,54 163,54 160,59" fill="#38bdf8" />
        <rect x="126" y="62" width="70" height="16" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="132" y="66" width="12" height="8" fill="#0f172a" stroke="#94a3b8" />
        <rect x="150" y="66" width="12" height="8" fill="#0f172a" stroke="#94a3b8" />
        <rect x="168" y="66" width="12" height="8" fill="#0f172a" stroke="#94a3b8" />

        {/* RepRapFirmware: плата Duet с крупным чипом и разъёмом дисплея */}
        <rect x="230" y="30" width="76" height="48" rx="3" fill="#1e3a5f" stroke="#3b82f6" />
        <rect x="244" y="40" width="32" height="22" fill="#334155" stroke="#94a3b8" />
        <rect x="282" y="40" width="18" height="10" fill="#334155" stroke="#94a3b8" />
        {pins.map((offset) => (
          <rect
            key={`duet-${offset}`}
            x={238 + offset}
            y="68"
            width="5"
            height="6"
            fill="#334155"
            stroke="#94a3b8"
          />
        ))}
        {/* Подписи колонок: где считается движение и что делает плата */}
        {systems.map((system) => (
          <g key={`caption-${system.name}`}>
            <text
              x={system.center}
              y="96"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {system.first}
            </text>
            <text
              x={system.center}
              y="112"
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {system.second}
            </text>
          </g>
        ))}

        <text x="14" y="150" fontSize="10" fill="#94a3b8">
          во всех трёх — G-код, BLTouch и сетка стола
        </text>
        <text x="14" y="168" fontSize="10" fill="#94a3b8">
          разница одна — где считаются движения
        </text>
      </svg>
    </VisualWrapper>
  );
}
