import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Окно слайсера: 18…140, строка заголовка до 34, семь строк через 14. */
const WIN_Y = 18;
const WIN_H = 122;
const BAR_H = 16;
const ROW_TOP = 48;
const ROW_STEP = 14;
const LABEL_X = 24;
const VALUE_X = 296;

type Row = { label: string; value: string; key?: boolean };

/** Семь строк окна поддержек из блока 31; значения — по шпаргалке блока 32. */
const ROWS: Row[] = [
  { label: "Support", value: "включён" },
  { label: "Type", value: "Tree (slim)" },
  { label: "Support Z distance", value: "0,2 мм", key: true },
  { label: "Interface layers", value: "3 слоя" },
  { label: "Interface density", value: "50 %" },
  { label: "Body density", value: "12 %" },
  { label: "Overhang angle", value: "50°" },
];

const NOTES = [
  "Проверяй числа тестовой деталью после каждой правки",
  "Одна правка за печать: иначе непонятно, что помогло",
  "Названия полей различаются — ищи нужное по смыслу",
];

/**
 * Кадр блока 31 урока C5 «Окно поддержек в слайсере».
 *
 * Макет окна из описания кадра `C5_settings.png`: слайсер Orca, вкладка Support,
 * профиль PLA — включённые поддержки, тип «дерево» (Tree slim), зазор 0,2 мм,
 * три слоя интерфейса. Остальные значения дописаны по шпаргалке блока 32:
 * плотность интерфейса 50 %, плотность тела 12 %, угол нависания 50°. Выделенная
 * строка — зазор по Z: именно он решает, снимется опора руками или приварится
 * (блок 6). Нижние строки — блоки 33 и 35: числа здесь не догма, их проверяют
 * тестовой деталью и меняют по одной за печать, а названия полей в слайсерах
 * различаются — искать нужное надо по смыслу: зазор, интерфейс, плотность,
 * форма опоры.
 */
export function ConfidentC5Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно поддержек в слайсере Orca: вкладка Support, профиль PLA, семь строк. Support включён, тип Tree (slim), Support Z distance 0,2 мм — ключевая строка: от зазора зависит, снимется опора руками или приварится. Interface layers 3 слоя, Interface density 50 %, Body density 12 %, Overhang angle 50 градусов. Проверяй числа тестовой деталью после каждой правки. Одна правка за печать: иначе непонятно, что помогло. Названия полей различаются — ищи нужное по смыслу"
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

        {/* Окно слайсера со строкой заголовка */}
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={WIN_H}
          rx="8"
          fill="#0f172a"
          fillOpacity="0.5"
          stroke="#475569"
          strokeOpacity="0.7"
        />
        <rect
          x="12"
          y={WIN_Y}
          width="296"
          height={BAR_H}
          rx="8"
          fill="#1e293b"
          fillOpacity="0.8"
        />
        {[22, 29, 36].map((cx) => (
          <circle key={cx} cx={cx} cy={WIN_Y + 8} r="2" fill="#475569" />
        ))}
        <text x="48" y={WIN_Y + 12} fontSize="10" fontWeight="700" fill="#e2e8f0">
          Support
        </text>
        <text x={VALUE_X} y={WIN_Y + 12} fontSize="10" fill="#94a3b8" textAnchor="end">
          профиль: PLA
        </text>
        <line x1="12" y1={WIN_Y + BAR_H} x2="308" y2={WIN_Y + BAR_H} stroke="#475569" />

        {/* Семь строк настроек; зазор по Z — ключевая */}
        {ROWS.map((row, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={row.label}>
              {row.key ? (
                <rect
                  x="16"
                  y={y - 9}
                  width="288"
                  height="14"
                  rx="3"
                  fill="#10b981"
                  fillOpacity="0.12"
                  stroke="#10b981"
                  strokeOpacity="0.4"
                />
              ) : null}
              <text x={LABEL_X} y={y} fontSize="10" fill="#cbd5e1">
                {row.label}
              </text>
              <text
                x={VALUE_X}
                y={y}
                fontSize="10"
                fontWeight={row.key ? "700" : "400"}
                fill={row.key ? "#10b981" : "#e2e8f0"}
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          );
        })}

        {/* Что проверить в окне */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={148 + index * 12}
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
