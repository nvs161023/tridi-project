import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: «борода» 12…158, чисто 162…308, 22…102. */
const PANEL_TOP = 22;
const PANEL_H = 80;
const PANEL_X = [12, 162];
const PANEL_CENTER = [85, 235];

/** Башенки 20 × 20 × 50 мм на расстоянии 30 мм. */
const TOWER_A_OFFSET = 30;
const TOWER_B_OFFSET = 86;
const TOWER_W = 14;
const TOWER_TOP = 40;
const TOWER_H = 44;
const GROUND_Y = TOWER_TOP + TOWER_H;
const STRING_Y = [46, 52, 58, 64, 70, 76, 82];

const LEAD = "сушка → температура −5 °C → ретракт";
const LEAD_NOTE = "тест: башня струн 20 × 20 × 50 при 30 мм, 10–15 мин";
const NOTES = ["прямой тракт +0,2 мм · Bowden +1 мм", "откат 30–40 мм/с · z-hop 0,2–0,4 мм"];

type State = { title: string; color: string; strings: boolean; note: string };

/** Проблема 5: паутина от влаги и ретракта, башня струн как проверка. */
const STATES: State[] = [
  {
    title: "паутина между башнями",
    color: "#f87171",
    strings: true,
    note: "борода нитей на переездах",
  },
  {
    title: "после сушки и ретракта",
    color: "#10b981",
    strings: false,
    note: "стенки чистые, нитей нет",
  },
];

/**
 * Кадр блока 13 урока L7 «Паутина: от струн до чистых стенок».
 *
 * Две башенки 20 × 20 × 50 мм на расстоянии 30 мм: слева между ними висят нити,
 * справа стенки чистые. Снизу порядок лечения — сушка, температура шагами по
 * 5 °C, ретракт с цифрами урока 4 и короткий тест на 10–15 минут.
 *
 * Числа — из проблемы 5: откат +0,2 мм прямым трактом и +1 мм для Bowden,
 * скорость отката 30–40 мм/с, подъём по Z 0,2–0,4 мм, 10–15 минут и 3 г.
 */
export function Basic7Diagram4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Паутина между деталями: слева между двумя башенками 20 на 20 на 50 мм на расстоянии 30 мм висят тонкие нити, справа после сушки и настройки ретракта стенки чистые. Порядок лечения: сушка материала, температура вниз шагами по 5 градусов, затем ретракт — для прямого тракта длина отката плюс 0,2 мм, для Bowden плюс 1 мм, скорость отката 30–40 миллиметров в секунду, подъём по Z 0,2–0,4 мм. Проверка — башня струн: 10–15 минут и 3 грамма пластика"
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
          Паутина: от струн до чистых стенок
        </text>

        {/* Башенки и нити между ними */}
        {STATES.map((state, index) => {
          const x0 = PANEL_X[index];
          const center = PANEL_CENTER[index];
          const left = x0 + TOWER_A_OFFSET;
          const right = x0 + TOWER_B_OFFSET;

          return (
            <g key={state.title}>
              <rect
                x={x0}
                y={PANEL_TOP}
                width="146"
                height={PANEL_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text
                x={center}
                y="34"
                fontSize="10"
                fontWeight="700"
                fill={state.color}
                textAnchor="middle"
              >
                {state.title}
              </text>
              {[left, right].map((x) => (
                <rect
                  key={x}
                  x={x}
                  y={TOWER_TOP}
                  width={TOWER_W}
                  height={TOWER_H}
                  rx="2"
                  fill="#3b82f6"
                  fillOpacity="0.25"
                  stroke="#3b82f6"
                />
              ))}
              {state.strings &&
                STRING_Y.map((y) => (
                  <line
                    key={y}
                    x1={left + TOWER_W}
                    y1={y}
                    x2={right}
                    y2={y + 4}
                    stroke="#f59e0b"
                    strokeOpacity="0.85"
                  />
                ))}
              <line x1={x0 + 22} y1={GROUND_Y} x2={x0 + 124} y2={GROUND_Y} stroke="#475569" />
              {[x0 + 30, x0 + 60, x0 + 90].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={GROUND_Y + 2}
                  x2={x - 5}
                  y2={GROUND_Y + 7}
                  stroke="#475569"
                />
              ))}
              <text x={center} y="96" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {state.note}
              </text>
            </g>
          );
        })}

        {/* Порядок лечения: по одной ручке за печать */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height="20"
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}

      </svg>
    </VisualWrapper>
  );
}
