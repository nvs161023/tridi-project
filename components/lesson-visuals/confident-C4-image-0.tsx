import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Строки: 24…134, высота 34; иконка 20…44; шкала 222…278 и доля у 308. */
const ROW_Y = [24, 62, 100];
const ROW_H = 34;
const TEXT_X = 54;
const BAR_X = 222;
const BAR_W = 56;
const BAR_H = 8;

type Glove = { name: string; note: string; through: number; color: string };

/** Пары перчаток и проницаемость — блок 12; снятие и смена — блок 14. */
const GLOVES: Glove[] = [
  {
    name: "Нитрил 0,1–0,15 мм",
    note: "смола, ИПС и ацетон — недолго",
    through: 0.3,
    color: "#10b981",
  },
  {
    name: "Нитрил 0,3 мм",
    note: "промывка и слив: живёт дольше",
    through: 0.15,
    color: "#3b82f6",
  },
  {
    name: "Латекс и винил",
    note: "смола и растворители проходят",
    through: 0.9,
    color: "#f87171",
  },
];

const NOTES = [
  "Меняй тонкие перчатки каждые 15–20 минут",
  "Размер по руке: свободная цепляется и рвётся",
  "Коробку храни закрытой: на свету нитрил стареет",
];

/**
 * Кадр блока 13 урока C4 «Перчатки и что через них проходит».
 *
 * Три пары перчаток и стрелки проницаемости из описания кадра `C4_gloves.png`
 * и списка блока 12: нитрил 0,1–0,15 мм — базовый выбор, он держит смолу, ИПС
 * и ацетон недолго; нитрил 0,3 мм нужен для промывки и слива, потому что живёт
 * дольше тонких; латекс для смолы не годится, метакрилаты проходят через него
 * быстро, а винил держит воду и мыло, но пропускает растворители. Шкала справа
 * показывает, какая доля вещества проходит через материал. Нижние строки —
 * блоки 12 и 14: тонкие перчатки меняют каждые 15–20 минут, размер берут по
 * руке (свободная перчатка цепляется и рвётся), а коробку хранят закрытой,
 * потому что на свету нитрил стареет.
 */
export function ConfidentC4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Перчатки и что через них проходит. Нитрил 0,1–0,15 мм — базовый выбор, держит смолу, ИПС и ацетон недолго. Нитрил 0,3 мм — для промывки и слива, живёт дольше тонких. Латекс для смолы не годится: метакрилаты проходят быстро, винил пропускает растворители. Смена: тонкие перчатки меняют каждые 15–20 минут, размер берут по руке, коробку хранят закрытой — на свету нитрил стареет"
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
          Что проходит через перчатку
        </text>
        <text x="308" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          доля прошедшего
        </text>

        {/* Пары перчаток и шкала проницаемости */}
        {GLOVES.map((glove, index) => {
          const y = ROW_Y[index];
          return (
            <g key={glove.name}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />

              {/* Перчатка: манжета, ладонь и большой палец */}
              <rect
                x="20"
                y={y + 6}
                width="16"
                height="22"
                rx="4"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke={glove.color}
                strokeOpacity="0.7"
              />
              <rect
                x="36"
                y={y + 12}
                width="6"
                height="10"
                rx="3"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke={glove.color}
                strokeOpacity="0.7"
              />
              <line x1="20" y1={y + 10} x2="36" y2={y + 10} stroke={glove.color} strokeOpacity="0.7" />

              <text x={TEXT_X} y={y + 14} fontSize="11" fontWeight="700" fill={glove.color}>
                {glove.name}
              </text>
              <text x={TEXT_X} y={y + 27} fontSize="10" fill="#cbd5e1">
                {glove.note}
              </text>

              {/* Шкала: заполнение — доля, которая проходит через материал */}
              <rect
                x={BAR_X}
                y={y + 13}
                width={BAR_W}
                height={BAR_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.5"
                stroke="#475569"
                strokeOpacity="0.6"
              />
              <rect
                x={BAR_X}
                y={y + 13}
                width={Math.round(BAR_W * glove.through)}
                height={BAR_H}
                rx="4"
                fill={glove.color}
                fillOpacity="0.5"
                stroke={glove.color}
                strokeOpacity="0.8"
              />
              {[0.25, 0.5, 0.75].map((tick) => (
                <line
                  key={tick}
                  x1={BAR_X + BAR_W * tick}
                  y1={y + 11}
                  x2={BAR_X + BAR_W * tick}
                  y2={y + 23}
                  stroke="#475569"
                  strokeOpacity="0.5"
                />
              ))}
              <text x="308" y={y + 21} fontSize="10" fill={glove.color} textAnchor="end">
                {Math.round(glove.through * 100)} %
              </text>
            </g>
          );
        })}

        {/* Смена перчаток, размер и хранение */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="22"
            y={151 + index * 11}
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
