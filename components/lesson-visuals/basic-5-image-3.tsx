import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две полосы по 48 px: 24…72, 75…123. */
const ROW_TOP = 24;
const ROW_H = 48;
const ROW_GAP = 3;

/** Вид сверху на дорожки, текст с 76, значение в правой колонке. */
const VIEW_X = 20;
const VIEW_Y = 11;
const VIEW_W = 44;
const VIEW_H = 26;
const TEXT_X = 76;
const VALUE_X = 216;
const NAME_Y = 20;
const DETAIL_Y = 36;

/** Панели-вывода под полосами: 126…147 и 150…171. */
const NOTE_TOP = 126;
const NOTE_H = 21;
const NOTE_STEP = 24;
const NOTE_TEXT_Y = 14;

type Square = {
  name: string;
  color: string;
  value: string;
  detail: string;
  kind: "good" | "bad";
};

/**
 * Два квадрата из подписи блока 31 и текста шагов блока 30: слева линии сомкнуты,
 * справа круглые. Разница 0,04 мм по Z — это два шага по 0,02 мм. Ширина линии
 * около 0,55 мм, и такой контур должен дать ровные 20 мм.
 */
const SQUARES: Square[] = [
  {
    name: "Хорошо",
    color: "#10b981",
    value: "0,55 мм",
    detail: "линии сомкнуты, ровная матовая полоса",
    kind: "good",
  },
  {
    name: "Плохо",
    color: "#f59e0b",
    value: "0,04 мм",
    detail: "круглые линии, просветы: 2 шага",
    kind: "bad",
  },
];

/** Панели-вывода: сам тест и что означает разница в 0,04 мм. */
const NOTES = [
  "квадрат 20 на 20 мм в один слой, тест 10 минут",
  "линия 0,55 мм · разница 0,04 мм = 2 шага по 0,02",
];

/** Вид сверху: дорожки встык или круглые линии с просветами между ними. */
function SquareView({ kind, top, color }: { kind: Square["kind"]; top: number; color: string }) {
  const rows = [0, 1, 2, 3, 4, 5];

  if (kind === "good") {
    return (
      <g>
        {rows.map((row) => (
          <rect
            key={row}
            x={VIEW_X + row * (VIEW_W / rows.length)}
            y={top + VIEW_Y}
            width={VIEW_W / rows.length}
            height={VIEW_H}
            fill={color}
            fillOpacity="0.45"
            stroke="#34d399"
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      {[9, 22, 35].map((offset) => (
        <circle
          key={offset}
          cx={VIEW_X + offset}
          cy={top + VIEW_Y + VIEW_H / 2}
          r="4.5"
          fill={color}
          fillOpacity="0.4"
          stroke="#fbbf24"
        />
      ))}
    </g>
  );
}

/**
 * Кадр блока 31 урока L5 «Хороший и плохой тест-квадрат».
 *
 * Компоновка — две полосы: слева вид сверху на дорожки первого слоя, справа
 * название, значение и одна строка о том, что видно. У хорошего квадрата линии
 * сомкнуты в ровную матовую полосу, у плохого — круглые и между ними просветы
 * до стола. Ниже две панели-вывода: сам тест (квадрат 20 на 20 мм в один слой,
 * 10 минут) и расшифровка разницы.
 *
 * Числа — из блоков 30 и 31: квадрат 20 на 20 мм высотой 0,2 мм, линия около
 * 0,55 мм, разница 0,04 мм по Z равна двум шагам правки по 0,02 мм.
 */
export function Basic5Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Хороший и плохой тест-квадрат первого слоя: у хорошего линии сомкнуты в ровную матовую полосу шириной около 0,55 мм, у плохого линии круглые и между ними просветы до стола. Разница между ними 0,04 мм по Z, это два шага правки Z-offset по 0,02 мм. Квадрат 20 на 20 мм печатается в один слой за 10 минут"
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
          Квадрат 20 на 20, вид сверху
        </text>

        {/* Две полосы: вид сверху, название, значение и пояснение */}
        {SQUARES.map((square, index) => {
          const top = ROW_TOP + index * (ROW_H + ROW_GAP);

          return (
            <g key={square.name}>
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
              <SquareView kind={square.kind} top={top} color={square.color} />
              <text x={TEXT_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={square.color}>
                {square.name}
              </text>
              <text x={VALUE_X} y={top + NAME_Y} fontSize="11" fontWeight="700" fill="#e2e8f0">
                {square.value}
              </text>
              <text x={TEXT_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {square.detail}
              </text>
            </g>
          );
        })}

        {/* Панели-вывода: сам тест и расшифровка разницы */}
        {NOTES.map((note, index) => {
          const top = NOTE_TOP + index * NOTE_STEP;

          return (
            <g key={note}>
              <rect
                x="12"
                y={top}
                width="296"
                height={NOTE_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x="22" y={top + NOTE_TEXT_Y} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
