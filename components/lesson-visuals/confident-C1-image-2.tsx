import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три карточки защиты: 12…104, 110…202 и 208…308, высота 20…92. */
const CARD_Y = 20;
const CARD_H = 72;
const CARD_X = [12, 110, 208];
const CARD_W = [92, 92, 100];

type Guard = { name: string; lines: string[]; color: string };

/** Что против чего — блоки 18 и 19. */
const GUARDS: Guard[] = [
  {
    name: "медмаска",
    lines: ["UFP проходят", "свободно: нет", "класса и", "прилегания"],
    color: "#f87171",
  },
  {
    name: "FFP2",
    lines: ["частицы: ABS,", "ASA, композиты,", "шлифовка пыли", "и уборка"],
    color: "#10b981",
  },
  {
    name: "FFP3",
    lines: ["когда выше", "концентрация:", "длинная печать", "без вытяжки"],
    color: "#3b82f6",
  },
];

const RULES = [
  "ресурс — по часам,",
  "а не по запаху",
  "подгонка — по размеру,",
  "ладонь на выдохе",
  "хранение — в пакете",
  "сначала вытяжка",
];

/**
 * Кадр блока 29 урока C1 «Респираторы и фильтры».
 *
 * Три карточки: обычная медицинская маска не защищает от ультрадисперсных частиц
 * (блок 18), для UFP нужен респиратор FFP2 или FFP3, а против органики — слой с
 * углём класса A1 или A2 (блоки 18 и 19). Картридж A2P3 значит «газ плюс частица»
 * и держит два слоя сразу. Правила — из блока 19: ресурс считают по часам работы,
 * а не по запаху, респиратор подбирают по размеру и проверяют прилегание ладонью
 * на выдохе, хранят в закрытом пакете; сначала вытяжка, потом респиратор.
 */
export function ConfidentC1Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Респираторы и фильтры: что и когда. Обычная медицинская маска не годится: ультрадисперсные частицы проходят через неё свободно, у неё нет ни класса, ни прилегания. FFP2 нужен против частиц — ABS, ASA, композиты, шлифовка пыли и уборка. FFP3 — когда концентрация выше: длинная печать, комната без вытяжки. Против органики работает слой A1 или A2, а маркировка A2P3 значит газ плюс частица: в одном картридже уголь и противоаэрозольный слой. Ресурс картриджа считают по часам работы, а не по запаху, подгоняют по размеру и проверяют ладонью на выдохе, хранят в закрытом пакете. Сначала вытяжка, потом респиратор"
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
          Респираторы и фильтры: что и когда
        </text>

        {GUARDS.map((guard, index) => {
          const x = CARD_X[index];
          return (
            <g key={guard.name}>
              <rect
                x={x}
                y={CARD_Y}
                width={CARD_W[index]}
                height={CARD_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={guard.color}
                strokeOpacity="0.6"
              />
              <text x={x + 10} y={CARD_Y + 16} fontSize="12" fontWeight="700" fill={guard.color}>
                {guard.name}
              </text>
              {guard.lines.map((line, lineIndex) => (
                <text
                  key={line}
                  x={x + 10}
                  y={CARD_Y + 30 + lineIndex * 11}
                  fontSize="10"
                  fill="#94a3b8"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Разрез картриджа A2P3: уголь и противоаэрозольный слой */}
        <rect
          x="12"
          y="98"
          width="296"
          height="72"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="20" y="112" fontSize="10" fontWeight="700" fill="#e2e8f0">
          разрез картриджа A2P3
        </text>
        <line x1="14" y1="140" x2="22" y2="140" stroke="#64748b" />
        <path d="M22 140 L18 137 L18 143 Z" fill="#64748b" />
        <rect
          x="24"
          y="128"
          width="60"
          height="24"
          rx="4"
          fill="#f59e0b"
          fillOpacity="0.18"
          stroke="#f59e0b"
          strokeOpacity="0.7"
        />
        <text x="30" y="143" fontSize="10" fill="#f59e0b">
          уголь
        </text>
        <rect
          x="84"
          y="128"
          width="60"
          height="24"
          rx="4"
          fill="#3b82f6"
          fillOpacity="0.18"
          stroke="#3b82f6"
          strokeOpacity="0.7"
        />
        <text x="90" y="143" fontSize="10" fill="#3b82f6">
          частицы
        </text>
        <path d="M152 140 L148 137 L148 143 Z" fill="#64748b" />
        <text x="20" y="164" fontSize="10" fill="#94a3b8">
          A2P3 — газ плюс частица
        </text>

        {/* Как носить и когда менять */}
        {RULES.map((rule, index) => (
          <text key={rule} x="164" y={110 + index * 11} fontSize="10" fill="#94a3b8">
            {rule}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
