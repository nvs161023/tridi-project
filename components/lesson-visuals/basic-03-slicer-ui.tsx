import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 3 · image «Интерфейс слайсера» (Модуль 1: Знакомство).
 *
 * Из описания блока: скриншот Orca Slicer — в центре модель на виртуальном столе,
 * слева настройки (высота слоя, заполнение, поддержки, температура), справа
 * кнопка «Нарезать», внизу предпросмотр слоёв.
 */
const SETTINGS = ["высота слоя", "заполнение", "поддержки", "температура"];

export function Basic03SlicerUi({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно Orca Slicer: панель настроек, модель на столе, кнопка «Нарезать» и предпросмотр слоёв"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <rect x="6" y="8" width="308" height="164" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="6" y="8" width="308" height="18" rx="6" fill="#1e293b" />
        {[18, 28, 38].map((x) => (
          <circle key={x} cx={x} cy="17" r="3" fill="#475569" />
        ))}
        <text x="50" y="21" fontSize="9" fill="#e2e8f0">
          Orca Slicer
        </text>

        <rect x="14" y="34" width="76" height="92" rx="3" fill="#0b1220" stroke="#334155" />
        <text x="20" y="46" fontSize="8" fill="#cbd5e1">
          Настройки
        </text>
        {SETTINGS.map((name, i) => (
          <g key={name}>
            <text x="20" y={58 + i * 16} fontSize="6.5" fill="#94a3b8">
              {name}
            </text>
            <rect
              x="20"
              y={61 + i * 16}
              width="64"
              height="10"
              rx="2"
              fill="#1e293b"
              stroke="#334155"
            />
            <circle cx={34 + i * 12} cy={66 + i * 16} r="2.5" fill="#3b82f6" />
          </g>
        ))}

        <text x="100" y="44" fontSize="7.5" fill="#93c5fd">
          модель на виртуальном столе
        </text>
        <polygon points="80,124 200,124 240,100 120,100" fill="#101c33" stroke="#3b82f6" />
        <rect x="150" y="76" width="44" height="24" fill="#1d4ed8" stroke="#3b82f6" />
        <polygon points="150,76 164,64 208,64 194,76" fill="#2563eb" stroke="#3b82f6" />
        <polygon points="194,76 208,64 208,88 194,100" fill="#1e40af" stroke="#3b82f6" />

        <rect x="252" y="54" width="56" height="20" rx="4" fill="#1d4ed8" stroke="#3b82f6" />
        <text x="280" y="68" fontSize="8.5" fill="#f8fafc" textAnchor="middle">
          Нарезать
        </text>

        <rect x="14" y="136" width="294" height="32" rx="3" fill="#0b1220" stroke="#334155" />
        <text x="22" y="154" fontSize="7.5" fill="#94a3b8">
          предпросмотр слоёв
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="106"
            y1={142 + i * 5}
            x2="300"
            y2={142 + i * 5}
            stroke={i === 2 ? "#3b82f6" : "#334155"}
            strokeWidth={i === 2 ? 2 : 1}
          />
        ))}
      </svg>
    </VisualWrapper>
  );
}
