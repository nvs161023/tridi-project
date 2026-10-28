import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две банки и решётка: банка 20…96 и 126…202, решётка 232…308, тело 41…96. */
const JAR_Y = 41;
const JAR_H = 55;
const JAR_W = 76;
const CAP_Y = 34;
const CAP_H = 7;
const CENTERS = [58, 164, 270];

type Step = { title: string; note: string[]; color: string };

/** Порядок промывки — блок 19; банки, фильтр и сушка — блоки 18, 20. */
const STEPS: Step[] = [
  { title: "Грязная банка", note: ["первичная", "промывка"], color: "#f59e0b" },
  { title: "Чистая банка", note: ["ополаскивание"], color: "#3b82f6" },
  { title: "Решётка сушки", note: ["без полотенца"], color: "#10b981" },
];

const NOTES = [
  "По 2–3 минуты на шаг; банки подпиши маркером",
  "Слив ванночки — через фильтр; крышка важнее формы",
  "Мутнеет, липнет, пахнет — меняй спирт; не в раковину",
];

/**
 * Кадр блока 19 урока C4 «Промывка: две банки по порядку».
 *
 * Порядок из описания кадра `C4_wash.png` и текстов блоков 18 и 20: первая
 * банка грязная, там первичная промывка; вторая чистая, там финальное
 * ополаскивание; банки подписывают маркером, иначе через месяц «какая из них
 * чистая» уже не очевидно. По 2–3 минуты на шаг, слив ванночки — через фильтр,
 * чтобы в банку не попадали куски модели, а крышка важнее формы тары, потому
 * что через щель спирт улетучивается за неделю. Третий шаг — сушка на решётке в
 * проветриваемом месте: полотенцем промытую модель не вытирают, волокна
 * остаются в смоле. Нижние строки — блоки 18 и 21: мутный, липкий и пахнущий
 * сильнее спирт пора менять, а промывку не выливают в раковину — даже немного
 * спирта и смолы уходят в воду и забивают сифон.
 */
export function ConfidentC4Diagram2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Промывка двумя банками по порядку. Первая банка грязная — первичная промывка, вторая чистая — финальное ополаскивание, по 2–3 минуты на шаг, банки подписаны маркером. Слив ванночки — через фильтр, крышка важнее формы тары. Промытую модель сушат на решётке, полотенцем не вытирают: волокна остаются в смоле. Мутный, липкий и сильно пахнущий спирт пора менять, а промывку не выливают в раковину"
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
          Промывка: две банки по порядку
        </text>

        {/* Номера шагов и подписи под ёмкостями */}
        {STEPS.map((step, index) => (
          <g key={step.title}>
            <circle
              cx={CENTERS[index] - 26}
              cy="25"
              r="8"
              fill={step.color}
              fillOpacity="0.16"
              stroke={step.color}
              strokeOpacity="0.6"
            />
            <text
              x={CENTERS[index] - 26}
              y="29"
              fontSize="10"
              fontWeight="700"
              fill={step.color}
              textAnchor="middle"
            >
              {index + 1}
            </text>
            <text
              x={CENTERS[index]}
              y="106"
              fontSize="10"
              fontWeight="700"
              fill={step.color}
              textAnchor="middle"
            >
              {step.title}
            </text>
            {/* Подпись шага переносится по словам и прижимается к нижней строке:
                «первичная промывка» одной строкой выходила за левое поле */}
            {step.note.map((note, noteIndex) => (
              <text
                key={note}
                x={CENTERS[index]}
                y={128 - (step.note.length - 1 - noteIndex) * 9}
                fontSize="10"
                fill="#cbd5e1"
                textAnchor="middle"
              >
                {note}
              </text>
            ))}
          </g>
        ))}

        {/* Две банки: крышка, стекло и спирт внутри */}
        <g fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.7">
          <rect x="26" y={CAP_Y} width="64" height={CAP_H} rx="2" fillOpacity="0.5" />
          <rect x="20" y={JAR_Y} width={JAR_W} height={JAR_H} rx="6" />
          <rect x="132" y={CAP_Y} width="64" height={CAP_H} rx="2" fillOpacity="0.5" />
          <rect x="126" y={JAR_Y} width={JAR_W} height={JAR_H} rx="6" />
        </g>

        {/* Грязный спирт: муть и осевшая смола */}
        <rect
          x="25"
          y="70"
          width="66"
          height="21"
          rx="3"
          fill="#f59e0b"
          fillOpacity="0.22"
          stroke="#f59e0b"
          strokeOpacity="0.5"
        />
        <circle cx="42" cy="80" r="2" fill="#f59e0b" fillOpacity="0.55" />
        <circle cx="62" cy="85" r="1.5" fill="#f59e0b" fillOpacity="0.45" />
        <circle cx="78" cy="78" r="1.5" fill="#f59e0b" fillOpacity="0.45" />

        {/* Чистый спирт для ополаскивания */}
        <rect
          x="131"
          y="70"
          width="66"
          height="21"
          rx="3"
          fill="#3b82f6"
          fillOpacity="0.18"
          stroke="#3b82f6"
          strokeOpacity="0.5"
        />

        {/* Решётка сушки: модель, прутья и стекающие капли */}
        <g stroke="#475569" strokeOpacity="0.8">
          <line x1="232" y1="58" x2="308" y2="58" />
          <line x1="232" y1="68" x2="308" y2="68" />
          <line x1="232" y1="78" x2="308" y2="78" />
          <line x1="232" y1="88" x2="308" y2="88" />
          <line x1="236" y1="88" x2="236" y2="98" />
          <line x1="304" y1="88" x2="304" y2="98" />
        </g>
        <rect
          x="258"
          y="42"
          width="28"
          height="14"
          rx="3"
          fill="#94a3b8"
          fillOpacity="0.18"
          stroke="#94a3b8"
          strokeOpacity="0.6"
        />
        <circle cx="266" cy="94" r="1.5" fill="#3b82f6" fillOpacity="0.6" />
        <circle cx="288" cy="94" r="1.5" fill="#3b82f6" fillOpacity="0.6" />

        {/* Порядок: из грязной банки в чистую, потом на решётку */}
        <g stroke="#475569" strokeOpacity="0.75" fill="#475569" fillOpacity="0.75">
          <line x1="100" y1="68" x2="114" y2="68" />
          <polygon points="120,68 113,64.5 113,71.5" stroke="none" />
          <line x1="206" y1="68" x2="220" y2="68" />
          <polygon points="226,68 219,64.5 219,71.5" stroke="none" />
        </g>

        {/* Время, слив и признак старого спирта */}
        <rect
          x="12"
          y="134"
          width="296"
          height="40"
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
            y={147 + index * 11}
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
