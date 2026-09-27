import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Катушка растворимого пластика: обод, намотка в цвет материала, ступица и
 * подпись материала под ней.
 */
function Spool({ cx, cy, label, color }: { cx: number; cy: number; label: string; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="16" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="11.5" fill="none" stroke={color} strokeWidth="5" strokeOpacity="0.55" />
      <circle cx={cx} cy={cy} r="4" fill="#475569" stroke="#94a3b8" />
      <text x={cx} y="74" fontSize="9" fill={color} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/**
 * Ванна с деталью: рамка-ёмкость, деталь и растворяемая часть, рядом пузырьки.
 * Подпись под ванной — чем растворяют и сколько это занимает.
 */
function Bath({
  x,
  color,
  caption,
}: {
  x: number;
  color: string;
  caption: string;
}) {
  return (
    <g>
      <rect x={x} y="96" width="132" height="44" rx="4" fill={color} fillOpacity="0.12" stroke={color} />
      <rect x={x + 32} y="112" width="58" height="14" fill="#475569" stroke="#94a3b8" />
      <rect
        x={x + 68}
        y="112"
        width="20"
        height="14"
        fill="#0c4a6e"
        stroke={color}
        strokeDasharray="4 3"
      />
      <circle cx={x + 96} cy="106" r="2" fill="#7dd3fc" />
      <circle cx={x + 104} cy="122" r="1.6" fill="#7dd3fc" />
      <text x={x + 66} y="156" fontSize="9" fill={color} textAnchor="middle">
        {caption}
      </text>
    </g>
  );
}

/**
 * Растворимые поддержки: две катушки по краям (PVA и HIPS), между ними схема
 * двух сопел над деталью — одно печатает модель, второе растворимую поддержку,
 * а ниже две ванны: вода 40 °C растворяет PVA, лимонен — HIPS.
 *
 * Ровно по content урока: «Фото: PVA и HIPS, процесс растворения в воде и
 * лимонене. Схема двойного экструдера» и по списку комбинаций: «PLA + PVA —
 * вода 40 °C, 2–4 часа», «ABS + HIPS — лимонен, 4–8 часов».
 *
 * От «Пяти пластиков» в модуле E1 отличается предметом кадра: там ряд катушек с
 * подписями свойств и цветом филамента, здесь две катушки растворимых
 * материалов, схема двух сопел и две ванны — главное в кадре не свойства
 * пластика, а растворение поддержки.
 */
export function ProHH2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Растворимые поддержки: катушки PVA и HIPS, схема двух сопел — одно печатает модель, второе растворимую поддержку, и две ванны: в воде 40 градусов PVA растворяется за 2–4 часа, в лимонене HIPS — за 4–8 часов"
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
          растворимые поддержки: PVA — вода, HIPS — лимонен
        </text>

        {/* Схема двух сопел над деталью */}
        <polygon points="36,26 44,26 42,40 38,40" fill="#cbd5e1" />
        <polygon points="56,26 64,26 62,40 58,40" fill="#cbd5e1" />
        <rect x="30" y="40" width="34" height="12" fill="#475569" stroke="#94a3b8" />
        <rect x="64" y="40" width="14" height="12" fill="#0c4a6e" stroke="#38bdf8" strokeDasharray="4 3" />
        <text x="54" y="68" fontSize="9" fill="#94a3b8" textAnchor="middle">
          два сопла
        </text>
        <text x="54" y="82" fontSize="9" fill="#94a3b8" textAnchor="middle">
          модель + поддержка
        </text>

        {/* Катушки растворимых материалов */}
        <Spool cx={140} cy={42} label="PVA" color="#7dd3fc" />
        <Spool cx={248} cy={42} label="HIPS" color="#a3e635" />

        {/* Две ванны с растворением */}
        <Bath x={24} color="#38bdf8" caption="вода 40 °C · 2–4 ч" />
        <Bath x={164} color="#a3e635" caption="лимонен · 4–8 ч" />

        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          двойной экструдер или смена филамента
        </text>
      </svg>
    </VisualWrapper>
  );
}
