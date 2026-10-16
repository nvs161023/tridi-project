import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три полосы по 38 px: 22…60, 63…101, 104…142. */
const ROW_TOP = 22;
const ROW_H = 38;
const ROW_GAP = 3;

/** Значок слева, текст с 68, ценность прижата к правой колонке. */
const ICON_X = 20;
const ICON_TOP = 10;
const NAME_X = 68;
const VALUE_X = 216;
const NAME_Y = 16;
const DETAIL_Y = 30;

/** Панель-вывод под полосами: 146…176. */
const NOTE_TOP = 146;
const NOTE_H = 30;
const NOTE_Y = 11;

type Option = {
  name: string;
  color: string;
  value: string;
  detail: string;
  kind: "skirt" | "brim" | "raft";
};

/**
 * Три инструмента из подписи блока 27: юбка +30 секунд, кайма 5 мм даёт 900 →
 * 1600 мм² за +2 минуты, плот — ×2,5 материала и +6 минут. Описания — из блока 25:
 * юбка стоит вокруг детали и ни с чем не соединена, кайма приклеена и добавляет
 * площади, плот — площадка из 3–5 слоёв под деталью.
 */
const OPTIONS: Option[] = [
  {
    name: "Юбка",
    color: "#3b82f6",
    value: "+30 с",
    detail: "контур 3–5 мм, ни с чем не соединён",
    kind: "skirt",
  },
  {
    name: "Кайма",
    color: "#10b981",
    value: "900 → 1600 мм²",
    detail: "полоса 5 мм, приклеена, +2 мин",
    kind: "brim",
  },
  {
    name: "Плот",
    color: "#f59e0b",
    value: "×2,5",
    detail: "3–5 слоёв под деталью, +6 мин",
    kind: "raft",
  },
];

/** Панель-вывод из блока 26: чем кайма помогает на самом деле. */
const NOTES = [
  "кайма не улучшает адгезию — она добавляет площадь",
  "и уменьшает плечо усадки",
];

/** Значок: отдельный контур, приклеенная полоса и площадка под деталью. */
function Option({ kind, top, color }: { kind: Option["kind"]; top: number; color: string }) {
  if (kind === "skirt") {
    return (
      <g>
        <rect
          x={ICON_X}
          y={top + ICON_TOP}
          width="22"
          height="18"
          rx="2"
          fill="none"
          stroke={color}
          strokeDasharray="3 2"
        />
        <rect x={ICON_X + 7} y={top + ICON_TOP + 5} width="8" height="8" fill="#475569" stroke="#94a3b8" />
      </g>
    );
  }

  if (kind === "brim") {
    return (
      <g>
        <rect x={ICON_X} y={top + ICON_TOP} width="22" height="18" rx="2" fill="none" stroke={color} />
        <rect x={ICON_X + 7} y={top + ICON_TOP + 5} width="8" height="8" fill="#475569" stroke="#94a3b8" />
        <line x1={ICON_X} y1={top + ICON_TOP + 9} x2={ICON_X + 7} y2={top + ICON_TOP + 9} stroke={color} />
        <line x1={ICON_X + 15} y1={top + ICON_TOP + 9} x2={ICON_X + 22} y2={top + ICON_TOP + 9} stroke={color} />
        <line x1={ICON_X + 11} y1={top + ICON_TOP} x2={ICON_X + 11} y2={top + ICON_TOP + 5} stroke={color} />
        <line x1={ICON_X + 11} y1={top + ICON_TOP + 13} x2={ICON_X + 11} y2={top + ICON_TOP + 18} stroke={color} />
      </g>
    );
  }

  return (
    <g>
      <rect x={ICON_X} y={top + ICON_TOP + 12} width="22" height="3" fill={color} fillOpacity="0.5" stroke={color} />
      <rect x={ICON_X} y={top + ICON_TOP + 9} width="22" height="3" fill={color} fillOpacity="0.5" stroke={color} />
      <rect x={ICON_X + 7} y={top + ICON_TOP - 2} width="8" height="8" fill="#475569" stroke="#94a3b8" />
    </g>
  );
}

/**
 * Кадр блока 27 урока L5 «Юбка, кайма и плот на одной детали».
 *
 * Компоновка — три полосы: значок, название, ценность справа и одна строка о том,
 * чем этот инструмент является. Сверху вниз: юбка +30 секунд (контур вокруг, ни
 * с чем не соединён), кайма 5 мм даёт 900 → 1600 мм² при +2 минутах и цене ×2,5
 * материала у плота с его 3–5 слоями и +6 минутами. Ниже панель-вывод из блока 26:
 * кайма помогает не адгезией, а площадью и меньшим плечом усадки.
 *
 * Числа — из подписи блока 27 (300 с, 900 → 1600 мм², +2 мин, ×2,5, +6 мин)
 * и текста блока 25 (юбка 3–5 мм, кайма 5–8 мм, плот 3–5 слоёв). Ценность каймы
 * дана в той же паре 900 → 1600, что и в подписи: это площадь первого слоя.
 */
export function Basic5Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Юбка, кайма и плот на одной детали: юбка стоит вокруг детали и ни с чем не соединена, стоит лишние 30 секунд; кайма 5 мм приклеена к детали и поднимает площадь первого слоя с 900 до 1600 мм² за 2 минуты; плот даёт 3–5 слоёв под деталью, ×2,5 материала и +6 минут. Кайма помогает не адгезией, а площадью и меньшим плечом усадки"
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
          Три инструмента, три цены
        </text>

        {/* Полосы: значок, название, ценность и пояснение */}
        {OPTIONS.map((option, index) => {
          const top = ROW_TOP + index * (ROW_H + ROW_GAP);

          return (
            <g key={option.name}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <Option kind={option.kind} top={top} color={option.color} />
              <text x={NAME_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={option.color}>
                {option.name}
              </text>
              <text x={VALUE_X} y={top + NAME_Y} fontSize="11" fontWeight="700" fill="#e2e8f0">
                {option.value}
              </text>
              <text x={NAME_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {option.detail}
              </text>
            </g>
          );
        })}

        {/* Панель-вывод: чем кайма помогает на самом деле */}
        <rect
          x="12"
          y={NOTE_TOP}
          width="296"
          height={NOTE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text key={note} x="22" y={NOTE_TOP + NOTE_Y + index * 11} fontSize="10" fill="#94a3b8">
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
