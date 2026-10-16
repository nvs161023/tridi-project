import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Комната: 12…308 и 22…126; датчик на потолке, принтер на столе, дверь у стены. */
const PLACE = ["Лучшее место —", "над дверью"];

const AWAY = ["не над соплом", "не в боксе", "не у вытяжки"];

const NOTES = [
  "Автономный фотоэлектрический: 1 500–3 000 ₽",
  "TEST раз в месяц, пылесос и батарея раз в год",
  "Сирена слышна из спальни за закрытой дверью",
];

/**
 * Кадр блока 7 урока C3 «Датчик дыма над принтером».
 *
 * Место датчика — описание кадра `C3_detectors.png` и блок 8: потолок в 1–3
 * метрах от принтера, на пути дыма, не прямо над соплом, не в боксе и не у
 * вытяжки, лучшее место — над дверью входа. Какой датчик брать — блок 8:
 * автономный, фотоэлектрический, 1 500–3 000 ₽, батарея на 10 лет, кнопка
 * **TEST** раз в месяц, пылесос или новая батарея раз в год, а сирену должно
 * быть слышно через закрытую дверь.
 */
export function ConfidentC3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Датчик дыма над принтером: автономный фотоэлектрический, 1 500–3 000 ₽, с батареей на 10 лет. Висит на потолке в 1–3 метрах от принтера, на пути дыма: не над соплом, не в боксе и не у вытяжки, а лучшее место — над дверью входа. Кнопка TEST раз в месяц, пылесос и батарея раз в год, а сирену должно быть слышно через закрытую дверь"
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
          Датчик дыма над принтером: где вешать
        </text>

        {/* Комната: потолок, принтер на столе и дверь */}
        <rect
          x="12"
          y="22"
          width="296"
          height="104"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.6"
        />
        <rect x="12" y="24" width="296" height="5" fill="#475569" fillOpacity="0.25" />

        {/* Датчик на потолке: коробочка с батареей и сиреной */}
        <rect
          x="110"
          y="31"
          width="24"
          height="9"
          rx="3"
          fill="#3b82f6"
          fillOpacity="0.3"
          stroke="#3b82f6"
          strokeOpacity="0.8"
        />
        <rect x="114" y="40" width="16" height="3" rx="1.5" fill="#3b82f6" fillOpacity="0.5" />
        <text x="122" y="56" fontSize="10" fill="#3b82f6" textAnchor="middle">
          датчик дыма
        </text>

        {/* Дым идёт вверх, датчик стоит на его пути */}
        <circle cx="216" cy="86" r="4" fill="#cbd5e1" fillOpacity="0.22" />
        <circle cx="222" cy="72" r="3.5" fill="#cbd5e1" fillOpacity="0.2" />
        <circle cx="228" cy="58" r="3" fill="#cbd5e1" fillOpacity="0.18" />
        <line
          x1="122"
          y1="60"
          x2="122"
          y2="74"
          stroke="#10b981"
          strokeOpacity="0.6"
          strokeDasharray="3 3"
        />
        <line
          x1="208"
          y1="60"
          x2="208"
          y2="78"
          stroke="#10b981"
          strokeOpacity="0.6"
          strokeDasharray="3 3"
        />
        <line
          x1="122"
          y1="66"
          x2="208"
          y2="66"
          stroke="#10b981"
          strokeOpacity="0.6"
          strokeDasharray="4 3"
        />
        <text x="165" y="61" fontSize="11" fontWeight="700" fill="#10b981" textAnchor="middle">
          1–3 м
        </text>

        {/* Принтер на столе и сопло под ним */}
        <rect x="148" y="98" width="120" height="6" rx="2" fill="#475569" fillOpacity="0.5" />
        <rect
          x="160"
          y="76"
          width="96"
          height="20"
          rx="3"
          fill="#0f172a"
          fillOpacity="0.6"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <text x="208" y="89" fontSize="10" fill="#94a3b8" textAnchor="middle">
          принтер
        </text>
        <polygon points="204,96 212,96 208,102" fill="#f59e0b" fillOpacity="0.7" />

        {/* Место датчика и запретные точки */}
        {PLACE.map((line, index) => (
          <text key={line} x="22" y={42 + index * 11} fontSize="10" fill="#cbd5e1">
            {line}
          </text>
        ))}
        {AWAY.map((line, index) => (
          <text key={line} x="22" y={68 + index * 12} fontSize="10" fill="#94a3b8">
            {line}
          </text>
        ))}

        {/* Дверь, через которую входят в комнату */}
        <rect
          x="280"
          y="56"
          width="20"
          height="52"
          rx="3"
          fill="#0f172a"
          fillOpacity="0.45"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <circle cx="285" cy="82" r="2" fill="#94a3b8" fillOpacity="0.7" />
        <text x="290" y="48" fontSize="10" fill="#94a3b8" textAnchor="middle">
          дверь
        </text>

        {/* Что проверить у датчика */}
        <rect
          x="12"
          y="132"
          width="296"
          height="38"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={143 + index * 11}
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
