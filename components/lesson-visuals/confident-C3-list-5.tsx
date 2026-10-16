import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Комната: 12…308 и 22…118; датчик над принтером, розетка справа, дверь у стены. */
const RULES = [
  "Датчик слышен, умная розетка снимает питание",
  "Thermal runaway включён, уведомление на телефон",
  "Радиус метра — без горючего; не в спальне",
  "План на случай дыма: кто звонит и кто идёт смотреть",
];

/**
 * Кадр блока 24 урока C3 «Печать, когда тебя нет дома».
 *
 * Комната из описания кадра `C3_unattended.png`: датчик дыма в комнате с
 * принтером, умная розетка, свободный путь к двери и ключ на известном месте.
 * Подписи собраны по списку блока 24: датчик дыма должен быть слышен, умная
 * розетка или таймер выключают питание сами, защита thermal runaway включена в
 * прошивке, уведомление на телефон пишет датчик или камера, есть план на случай
 * дыма, в радиусе метра нет ничего горючего, принтер не в спальне, дома кто-то
 * есть или соседи знают про ночную печать, путь к двери свободен, ключ на
 * известном месте, свет оставлен включённым. Второй слой — блок 25: камера
 * пишет видео и ничего не тушит, а уведомление настраивают на датчик.
 */
export function ConfidentC3List5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Печать, когда тебя нет дома: датчик дыма в комнате должен быть слышен, умная розетка выключает питание сама, защита thermal runaway включена в прошивке, уведомление на телефон пишет датчик. В радиусе метра нет ничего горючего, принтер не в спальне, дома кто-то есть или соседи знают про ночную печать. Путь к двери свободен, ключ лежит на известном месте, свет оставлен включённым — это то, что работает без тебя"
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
          Печать, когда тебя нет дома
        </text>

        {/* Комната: потолок, принтер на столе и дверь у стены */}
        <rect
          x="12"
          y="22"
          width="296"
          height="96"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.6"
        />
        <rect x="12" y="24" width="296" height="5" fill="#475569" fillOpacity="0.25" />

        {/* Датчик дыма на потолке и метр вокруг принтера */}
        <rect
          x="54"
          y="31"
          width="18"
          height="8"
          rx="2.5"
          fill="#3b82f6"
          fillOpacity="0.3"
          stroke="#3b82f6"
          strokeOpacity="0.8"
        />
        <rect x="58" y="39" width="10" height="3" rx="1.5" fill="#3b82f6" fillOpacity="0.5" />
        <text x="63" y="54" fontSize="10" fill="#3b82f6" textAnchor="middle">
          датчик дыма
        </text>
        <rect
          x="24"
          y="58"
          width="80"
          height="40"
          rx="8"
          fill="none"
          stroke="#f87171"
          strokeOpacity="0.4"
          strokeDasharray="4 3"
        />
        <rect
          x="34"
          y="64"
          width="58"
          height="22"
          rx="3"
          fill="#0f172a"
          fillOpacity="0.6"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect x="26" y="86" width="74" height="5" rx="2" fill="#475569" fillOpacity="0.5" />
        <text x="63" y="79" fontSize="10" fill="#94a3b8" textAnchor="middle">
          принтер
        </text>
        <text x="26" y="110" fontSize="10" fill="#f87171">
          1 м вокруг — без горючего
        </text>

        {/* Умная розетка снимает питание сама */}
        <rect
          x="112"
          y="56"
          width="18"
          height="18"
          rx="3"
          fill="#10b981"
          fillOpacity="0.18"
          stroke="#10b981"
          strokeOpacity="0.7"
        />
        <circle cx="117" cy="65" r="1.8" fill="#10b981" fillOpacity="0.7" />
        <circle cx="125" cy="65" r="1.8" fill="#10b981" fillOpacity="0.7" />
        <text x="121" y="86" fontSize="10" fill="#10b981" textAnchor="middle">
          умная розетка
        </text>

        {/* Путь к двери свободен, свет включён, ключ на месте */}
        <line
          x1="176"
          y1="76"
          x2="266"
          y2="76"
          stroke="#10b981"
          strokeOpacity="0.7"
          strokeDasharray="4 3"
        />
        <polygon points="266,72 274,76 266,80" fill="#10b981" fillOpacity="0.8" />
        <text x="218" y="70" fontSize="10" fill="#10b981" textAnchor="middle">
          путь свободен
        </text>
        <text x="196" y="112" fontSize="10" fill="#10b981">
          ключ на месте
        </text>
        <circle cx="144" cy="97" r="3.5" fill="#f59e0b" fillOpacity="0.5" />
        <text x="152" y="100" fontSize="10" fill="#f59e0b">
          свет включён
        </text>

        {/* Дверь в комнату */}
        <rect
          x="272"
          y="56"
          width="24"
          height="52"
          rx="3"
          fill="#0f172a"
          fillOpacity="0.45"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <circle cx="277" cy="82" r="2" fill="#94a3b8" fillOpacity="0.7" />
        <text x="284" y="50" fontSize="10" fill="#94a3b8" textAnchor="middle">
          дверь
        </text>

        {/* Что должно работать без тебя */}
        <rect
          x="12"
          y="122"
          width="296"
          height="48"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {RULES.map((rule, index) => (
          <text
            key={rule}
            x="22"
            y={133 + index * 11}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {rule}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
