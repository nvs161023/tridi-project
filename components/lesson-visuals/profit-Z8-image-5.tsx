import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const METRICS_TOP = [
  { label: "просмотры", hint: "фото и цена", color: "#06b6d4" },
  { label: "вопросы", hint: "описание", color: "#3b82f6" },
  { label: "заказы", hint: "цена, доверие", color: "#8b5cf6" },
];

const METRICS_BOTTOM = [
  { label: "средний чек", hint: "наборы вместо вещи", color: "#f59e0b" },
  { label: "прибыль", hint: "минус расходы и налог", color: "#10b981" },
];

/**
 * Кадр блока 27 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_week_metrics.png`: пять цифр недели — просмотры, вопросы, заказы,
 * средний чек и прибыль. Раз в неделю десять минут, одна строка в журнале.
 * Внизу — как читать цифры вместе и правило менять по одному элементу.
 */
export function ProfitZ8Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Метрики недели: пять цифр — просмотры, вопросы, заказы, средний чек и прибыль. Просмотры показывают фото и цену, вопросы — описание, заказы — цену и доверие, средний чек растёт от наборов, прибыль считается минус расходы и налог. Просмотры без вопросов — слабое фото, вопросы без заказов — слабая цена, заказы без прибыли — слабый расчёт. Меняй по одному элементу: сначала фото, потом цену, потом текст"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          метрики недели
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          десять минут раз в неделю · строка в журнале
        </text>
        <rect x="258" y="5" width="52" height="14" rx="7" fill="#06b6d4" fillOpacity="0.15" stroke="#06b6d4" strokeOpacity="0.5" />
        <text x="284" y="15" fontSize="10" fontWeight="700" fill="#22d3ee" textAnchor="middle">
          5 цифр
        </text>

        {METRICS_TOP.map((metric, index) => {
          const x = 10 + index * 102;
          return (
            <g key={metric.label}>
              <rect x={x} y="38" width="96" height="34" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="38" width="96" height="3" rx="1.5" fill={metric.color} />
              <text x={x + 8} y="53" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {metric.label}
              </text>
              <text x={x + 8} y="66" fontSize="10" fill={metric.color}>
                {metric.hint}
              </text>
            </g>
          );
        })}

        {METRICS_BOTTOM.map((metric, index) => {
          const x = 10 + index * 153;
          return (
            <g key={metric.label}>
              <rect x={x} y="78" width="147" height="34" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="78" width="147" height="3" rx="1.5" fill={metric.color} />
              <text x={x + 8} y="93" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {metric.label}
              </text>
              <text x={x + 8} y="106" fontSize="10" fill={metric.color}>
                {metric.hint}
              </text>
            </g>
          );
        })}

        <rect x="10" y="118" width="300" height="58" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="132" fontSize="10" fill="#cbd5e1">
          просмотры без вопросов → слабое фото
        </text>
        <text x="18" y="145" fontSize="10" fill="#cbd5e1">
          вопросы без заказов → слабая цена
        </text>
        <text x="18" y="158" fontSize="10" fill="#cbd5e1">
          заказы без прибыли → слабый расчёт
        </text>
        <text x="18" y="171" fontSize="10" fontWeight="700" fill="#fbbf24">
          меняй по одному: фото → цена → текст
        </text>
      </svg>
    </VisualWrapper>
  );
}
