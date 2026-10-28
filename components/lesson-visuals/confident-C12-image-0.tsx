import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Стол и деталь: линия стола на y=128, деталь 106…128. */
const BED_Y = 128;

/** Слои детали: четыре линии внутри стенок. */
const LAYER_Y = [112, 118, 124];

/**
 * Кадр блока 21 урока C12 «Камера над столом».
 *
 * Макет из описания кадра `C12_camera_place.png`: камера стоит над столом под
 * углом, в её поле зрения сопло, первый слой и края детали. Блок 19 объясняет,
 * что камера ловит спагетти и отрыв детали, но не видит температуру в хотэнде.
 */
export function ConfidentC12Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Камера над столом: камера стоит сверху справа, её поле зрения накрывает стол и деталь. Видны сопло с нитью, первый слой и края детали. Камера ловит спагетти и отрыв детали, но температуру внутри хотэнда она не измеряет — для этого нужны датчики принтера"
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
          вид сверху под углом
        </text>

        {/* Поле зрения камеры */}
        <path
          d={`M242 50 L108 ${BED_Y} L300 ${BED_Y} Z`}
          fill="#60a5fa"
          fillOpacity="0.06"
          stroke="#60a5fa"
          strokeOpacity="0.35"
          strokeDasharray="4 3"
        />

        {/* Камера */}
        <rect
          x="232"
          y="24"
          width="42"
          height="26"
          rx="4"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeOpacity="0.8"
        />
        <circle cx="242" cy="37" r="5" fill="#0f172a" stroke="#60a5fa" />
        <text x="228" y="37" fontSize="10" fill="#cbd5e1" textAnchor="end">
          камера
        </text>

        {/* Стол */}
        <line x1="16" y1={BED_Y} x2="304" y2={BED_Y} stroke="#64748b" strokeWidth="2" />
        {[24, 64, 104, 144, 184, 224, 264].map((x) => (
          <line key={x} x1={x} y1={BED_Y} x2={x - 6} y2={BED_Y + 6} stroke="#475569" />
        ))}
        <text x="24" y="146" fontSize="10" fill="#94a3b8">
          стол
        </text>

        {/* Печатающая голова и сопло */}
        <line x1="150" y1="36" x2="150" y2="50" stroke="#f59e0b" strokeOpacity="0.8" />
        <rect
          x="136"
          y="50"
          width="28"
          height="24"
          rx="3"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeOpacity="0.8"
        />
        <polygon points="150,74 144,104 156,104" fill="#94a3b8" fillOpacity="0.8" />
        <text x="176" y="88" fontSize="10" fill="#cbd5e1">
          сопло
        </text>
        <line x1="170" y1="85" x2="158" y2="88" stroke="#64748b" />

        {/* Деталь на столе */}
        <path
          d={`M124 ${BED_Y} L130 106 L196 106 L202 ${BED_Y} Z`}
          fill="#60a5fa"
          fillOpacity="0.12"
          stroke="#60a5fa"
          strokeOpacity="0.7"
        />
        {LAYER_Y.map((y) => (
          <line key={y} x1="128" y1={y} x2="198" y2={y} stroke="#60a5fa" strokeOpacity="0.35" />
        ))}

        <text x="30" y="120" fontSize="10" fill="#cbd5e1">
          первый слой
        </text>
        <line x1="92" y1="116" x2="120" y2="116" stroke="#64748b" />
        <text x="212" y="120" fontSize="10" fill="#cbd5e1">
          края детали
        </text>
        <line x1="196" y1="116" x2="208" y2="116" stroke="#64748b" />

        <text x="12" y="160" fontSize="10" fill="#cbd5e1">
          Видно сопло, первый слой и края детали
        </text>
        <text x="12" y="171" fontSize="10" fill="#94a3b8">
          Температуру внутри хотэнда камера не покажет
        </text>
      </svg>
    </VisualWrapper>
  );
}
