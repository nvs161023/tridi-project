import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять калибровок из content урока: PID — температура, E-steps — сколько пластика
 * выдавливается, Flow — точная подача, Linear Advance — давление в сопле,
 * Input Shaper — вибрации.
 *
 * Формат — одна ЛЕНТА-КОНВЕЙЕР, а не пять плиток в ряд: у каждой станции номер,
 * короткое имя и одна строка «что она настраивает», между станциями шеврон, а
 * внизу мысль урока — «шаг опирается на предыдущий». Плитки «пять в ряд» в курсе
 * заняты (таблица филаментов, пять покрытий стола, пять катушек, пять слайсеров),
 * поэтому здесь конвейер: звенья идут по порядку слева направо.
 *
 * От «Где найти калибровки» (F1 и базовый урок 8) отличается тем, что там окна и
 * меню слайсеров, а здесь нет ни одного окна — только порядок работ.
 */
const stations = [
  { cx: 36, name: "PID", note: "температура", accent: "#f87171" },
  { cx: 92, name: "E-steps", note: "подача", accent: "#fbbf24" },
  { cx: 148, name: "Flow", note: "поток", accent: "#34d399" },
  { cx: 204, name: "LA", note: "давление", accent: "#38bdf8" },
  { cx: 260, name: "IS", note: "вибрации", accent: "#a78bfa" },
];

/**
 * «Пять калибровок» — лента-конвейер из пяти пронумерованных станций.
 */
export function ProII1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять калибровок по порядку: PID настраивает температуру, E-steps — подачу пластика, Flow — точную подачу, Linear Advance — давление в сопле, Input Shaper — вибрации; шаг опирается на предыдущий"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          пять калибровок — по порядку, слева направо
        </text>
        <text x="12" y="34" fontSize="10" fill="#e2e8f0">
          каждый шаг опирается на предыдущий
        </text>

        {/* Лента конвейера: пять станций на общей дорожке */}
        <rect x="8" y="66" width="304" height="44" rx="12" fill="#0f172a" stroke="#475569" />

        {stations.map((station, index) => (
          <g key={station.name}>
            {index < stations.length - 1 ? (
              <polyline
                points={`${station.cx + 20},78 ${station.cx + 27},86 ${station.cx + 20},94`}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
              />
            ) : null}

            <rect
              x={station.cx - 13}
              y="72"
              width="26"
              height="26"
              rx="8"
              fill="#1e293b"
              stroke={station.accent}
            />
            <text
              x={station.cx}
              y="91"
              fontSize="12"
              fontWeight="bold"
              fill={station.accent}
              textAnchor="middle"
            >
              {index + 1}
            </text>

            <text
              x={station.cx}
              y="128"
              fontSize="10"
              fontWeight="bold"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {station.name}
            </text>
            <text x={station.cx} y="146" fontSize="9" fill="#94a3b8" textAnchor="middle">
              {station.note}
            </text>
          </g>
        ))}

        <text x="12" y="175" fontSize="9.5" fill="#6ee7b7">
          сбойный шаг вернёт тебя назад — порядок важнее скорости
        </text>
      </svg>
    </VisualWrapper>
  );
}
