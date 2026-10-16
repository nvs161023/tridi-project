import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Восемь правил: строки 24…166 через 18, высота 16; уточнение — справа у 308. */
const ROW_TOP = 24;
const ROW_STEP = 18;
const ROW_H = 16;
const NUMBER_X = 26;
const TITLE_X = 42;
const NOTE_X = 308;

type Rule = { title: string; note: string; color: string };

/** Восемь шагов хранения — блок 30; шкаф, банки и замок — описание кадра. */
const RULES: Rule[] = [
  { title: "Отдельный шкаф", note: "не под столом с принтером", color: "#3b82f6" },
  { title: "Заводская тара", note: "тару от воды не переливать", color: "#3b82f6" },
  { title: "Подписи на банках", note: "что внутри и когда открыли", color: "#10b981" },
  { title: "Ограничение объёма", note: "в квартире одна открытая", color: "#10b981" },
  { title: "Подальше от нагрева", note: "вне солнца и батарей", color: "#f59e0b" },
  { title: "Вне жилой комнаты", note: "балкон, кладовка, мастерская", color: "#f59e0b" },
  { title: "Запор и высота", note: "высота важнее замка", color: "#f87171" },
  { title: "Проверка раз в месяц", note: "крышки, подписи, лужа", color: "#f87171" },
];

const SUMMARY = "Раз в месяц: крышки, подписи и лужа под банками";

/**
 * Кадр блока 30 урока C4 «Хранение химии: закрытый шкаф».
 *
 * Восемь шагов из блока 30 и подсказка описания кадра `C4_storage.png` (закрытый
 * шкаф, банки с подписями и замок на дверце): химия живёт в отдельном шкафу, а не
 * под столом с принтером; смолу и спирт хранят в заводской таре, потому что тара
 * с питьевой этикеткой обманывает даже тебя через полгода; на каждой банке
 * написано, что внутри и когда её открыли; в квартире держат одну открытую
 * бутылку спирта, остальной запас — вне жилья; шкаф стоит вне солнца и батарей,
 * ацетон особенно чувствителен к теплу; лучшее место — балкон, кладовка или
 * мастерская, кухня и спальня не подходят; ящик закрывают на замок или ставят на
 * верхнюю полку, и высота тут важнее замка; раз в месяц проверяют крышки,
 * подписи и лужу под банками. Итоговая строка — про эти десять минут проверки.
 */
export function ConfidentC4Steps1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Хранение химии: закрытый шкаф, восемь шагов. Отдельный шкаф, не под столом с принтером. Заводская тара, тару от воды не переливать. Подписи на банках: что внутри и когда открыли. Ограничение объёма: в квартире одна открытая бутылка спирта. Подальше от нагрева: вне солнца и батарей. Вне жилой комнаты: балкон, кладовка или мастерская. Запор и высота: высота важнее замка. Проверка раз в месяц: крышки, подписи и лужа под банками"
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
          Хранение химии: закрытый шкаф
        </text>

        {/* Шкаф с двумя дверцами и замком на дверце */}
        <g fill="#0f172a" fillOpacity="0.5" stroke="#475569">
          <rect x="276" y="5" width="30" height="13" rx="2" />
          <line x1="291" y1="5" x2="291" y2="18" />
        </g>
        <circle cx="291" cy="11.5" r="1.6" fill="#f59e0b" fillOpacity="0.8" />

        {/* Восемь правил: номер, правило и уточнение справа */}
        {RULES.map((rule, index) => {
          const y = ROW_TOP + index * ROW_STEP;
          return (
            <g key={rule.title}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="4"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.45"
              />
              <rect
                x="18"
                y={y + 1}
                width="15"
                height="13"
                rx="3"
                fill={rule.color}
                fillOpacity="0.16"
                stroke={rule.color}
                strokeOpacity="0.5"
              />
              <text
                x={NUMBER_X}
                y={y + 11}
                fontSize="10"
                fontWeight="700"
                fill={rule.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TITLE_X} y={y + 11} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {rule.title}
              </text>
              <text x={NOTE_X} y={y + 11} fontSize="10" fill="#94a3b8" textAnchor="end">
                {rule.note}
              </text>
            </g>
          );
        })}

        <text x="12" y="176" fontSize="10" fill="#94a3b8">
          {SUMMARY}
        </text>
      </svg>
    </VisualWrapper>
  );
}
