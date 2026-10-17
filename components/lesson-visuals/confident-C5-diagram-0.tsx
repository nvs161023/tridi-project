import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Разрез: деталь 30…44, щель 44…52, поддержка 52…96, стол 96. */
const PART_Y = 30;
const PART_H = 14;
const GAP_TOP = 44;
const GAP_BOTTOM = 52;
const BODY_TOP = 52;
const BODY_BOTTOM = 96;
const DRAW_X = 20;
const DRAW_W = 136;
/** Колонка значений: подписи 176…308, четыре строки через 22. */
const VALUE_X = 176;
const VALUE_TOP = 36;
const VALUE_STEP = 22;

type Value = { value: string; note: string; color: string };

/** Рабочие значения зазора — блоки 5 и 6; высота слоя и липкие пластики — 7, 8. */
const VALUES: Value[] = [
  { value: "0,1 мм", note: "приварит: снять нельзя", color: "#f87171" },
  { value: "0,15–0,2 мм", note: "отходит руками", color: "#10b981" },
  { value: "0,25–0,3 мм", note: "для PETG и TPU", color: "#f59e0b" },
  { value: "0,3 мм и больше", note: "тянет нити и бороду", color: "#94a3b8" },
];

const NOTES = [
  "Зазор — 60–80 % высоты слоя, для PETG до 100 %",
  "Слой 0,2 мм — зазор 0,15–0,2 мм; слой 0,3 мм — 0,22–0,3 мм",
  "Сменил катушку — проверь зазор заново на тестовой детали",
  "Меняй одну настройку за печать",
];

/** Столбики решётки поддержки: шаг 16 по X, слои через 10 по Y. */
const HATCH_X = [36, 52, 68, 84, 100, 116, 132];
const HATCH_Y = [62, 72, 82, 92];

/**
 * Кадр блока 4 урока C5 «Зазор по Z: что происходит на контакте».
 *
 * Разрез из описания кадра `C5_z_gap.png` и блоков 3, 5, 6, 7, 8: под деталью
 * стоит поддержка, а между подошвой опоры и нависанием остаётся щель по Z.
 * Зазор 0,1 мм даёт плотный контакт — поверхность чистая, но снять почти
 * невозможно, и на тонкой стенке остаётся скол (блок 6). Типовое 0,2 мм — это
 * поддержка, которая отходит руками, а след почти не виден. PETG и TPU липнут
 * сильнее остальных, поэтому для них рабочее значение 0,25–0,3 мм. Свыше 0,3 мм
 * опора снимается играючи, но на нависании висят нити и «борода». Нижние
 * строки — блоки 7 и 8: зазор растёт вместе с высотой слоя, поэтому меняешь
 * слой — пересматривай зазор, а проверяют его тестовой печатью на своей катушке.
 */
export function ConfidentC5Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Зазор по Z: что происходит на контакте. Под деталью стоит поддержка, между подошвой и нависанием остаётся щель. Зазор 0,1 мм приваривает поддержку: снять почти нельзя. 0,15–0,2 мм — поддержка отходит руками, след шлифуется. 0,25–0,3 мм рабочее значение для PETG и TPU. 0,3 мм и больше снимается легко, но тянет нити и бороду. Зазор — 60–80 процентов высоты слоя, для PETG до 100. Слой 0,2 мм — зазор 0,15–0,2 мм, слой 0,3 мм — 0,22–0,3 мм. Сменил катушку — проверь зазор заново на тестовой детали. Меняй одну настройку за печать"
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
          Зазор по Z: разрез нависания
        </text>

        {/* Деталь, щель по Z и тело поддержки под ней */}
        <rect
          x={DRAW_X}
          y={PART_Y}
          width={DRAW_W}
          height={PART_H}
          rx="2"
          fill="#334155"
          fillOpacity="0.55"
          stroke="#64748b"
        />
        <text x={DRAW_X + 4} y={PART_Y + 10} fontSize="10" fill="#e2e8f0">
          Деталь: нависание
        </text>
        <line
          x1={DRAW_X}
          y1={GAP_TOP}
          x2={DRAW_X + DRAW_W}
          y2={GAP_TOP}
          stroke="#f59e0b"
          strokeOpacity="0.7"
          strokeDasharray="3 2"
        />
        <line
          x1={DRAW_X}
          y1={GAP_BOTTOM}
          x2={DRAW_X + DRAW_W}
          y2={GAP_BOTTOM}
          stroke="#f59e0b"
          strokeOpacity="0.7"
          strokeDasharray="3 2"
        />
        <line
          x1={DRAW_X + DRAW_W + 6}
          y1={GAP_TOP - 1}
          x2={DRAW_X + DRAW_W + 6}
          y2={GAP_BOTTOM + 1}
          stroke="#f59e0b"
          strokeOpacity="0.8"
        />
        <text x={DRAW_X + DRAW_W + 10} y={GAP_TOP + 5} fontSize="10" fill="#f59e0b">
          Z
        </text>
        <rect
          x={DRAW_X}
          y={BODY_TOP}
          width={DRAW_W}
          height={BODY_BOTTOM - BODY_TOP}
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#f59e0b"
          strokeOpacity="0.5"
        />
        {HATCH_X.map((x) => (
          <line
            key={x}
            x1={x}
            y1={BODY_TOP + 2}
            x2={x}
            y2={BODY_BOTTOM - 2}
            stroke="#f59e0b"
            strokeOpacity="0.22"
          />
        ))}
        {HATCH_Y.map((y) => (
          <line
            key={y}
            x1={DRAW_X}
            y1={y}
            x2={DRAW_X + DRAW_W}
            y2={y}
            stroke="#f59e0b"
            strokeOpacity="0.16"
          />
        ))}
        <text x={DRAW_X + 4} y={BODY_TOP + 18} fontSize="10" fontWeight="700" fill="#f59e0b">
          Поддержка
        </text>
        <text x={DRAW_X + 4} y={BODY_TOP + 29} fontSize="10" fill="#cbd5e1">
          тело 10–15 %
        </text>
        <line x1="12" y1={BODY_BOTTOM} x2="164" y2={BODY_BOTTOM} stroke="#475569" />
        <text x="20" y={BODY_BOTTOM + 10} fontSize="10" fill="#64748b">
          стол
        </text>

        {/* Четыре рабочих значения зазора */}
        {VALUES.map((item, index) => {
          const y = VALUE_TOP + index * VALUE_STEP;
          return (
            <g key={item.value}>
              <text x={VALUE_X} y={y} fontSize="10" fontWeight="700" fill={item.color}>
                {item.value}
              </text>
              <text x={VALUE_X} y={y + 11} fontSize="10" fill="#94a3b8">
                {item.note}
              </text>
            </g>
          );
        })}

        {/* Правило высоты слоя и порядок правок */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={132 + index * 12}
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
