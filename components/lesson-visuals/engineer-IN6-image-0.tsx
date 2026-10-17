import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOOLS = [
  { name: "штангенциркуль", note: "габарит, Ø, паз", accent: "#fbbf24" },
  { name: "микрометр", note: "Ø штифта", accent: "#38bdf8" },
  { name: "радиусный шаблон", note: "R и галтели", accent: "#34d399" },
  { name: "резьбомер", note: "шаг и профиль", accent: "#a78bfa" },
  { name: "угольник", note: "углы, плоскости", accent: "#60a5fa" },
];

const POSITIONS = [
  { x: 12, y: 26 },
  { x: 168, y: 26 },
  { x: 12, y: 76 },
  { x: 168, y: 76 },
  { x: 12, y: 126 },
];

/** Простая пиктограмма инструмента в квадрате 20×20 от левого верхнего угла. */
function ToolIcon({ index, color }: { index: number; color: string }) {
  if (index === 0) {
    return (
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round">
        <line x1="0" y1="11" x2="22" y2="11" />
        <line x1="4" y1="3" x2="4" y2="18" />
        <line x1="15" y1="3" x2="15" y2="18" />
        <line x1="7" y1="7" x2="7" y2="10" strokeWidth="0.8" />
        <line x1="10" y1="7" x2="10" y2="10" strokeWidth="0.8" />
        <line x1="13" y1="7" x2="13" y2="10" strokeWidth="0.8" />
      </g>
    );
  }
  if (index === 1) {
    return (
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
        <path d="M17 3 H9 A8 8 0 0 0 9 19 H17" />
        <line x1="13" y1="7" x2="13" y2="15" />
        <line x1="17" y1="11" x2="22" y2="11" />
      </g>
    );
  }
  if (index === 2) {
    return (
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
        <path d="M1 19 A18 18 0 0 1 19 1" />
        <path d="M7 19 A12 12 0 0 1 19 7" strokeOpacity="0.7" />
        <path d="M12 19 A7 7 0 0 1 19 12" strokeOpacity="0.5" />
      </g>
    );
  }
  if (index === 3) {
    return (
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
        <path d="M2 15 L5 9 L8 15 L11 9 L14 15 L17 9 L20 15" />
        <line x1="2" y1="18" x2="20" y2="18" strokeOpacity="0.6" />
      </g>
    );
  }
  return (
    <g stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
      <path d="M5 2 V18 H21" strokeWidth="2.4" />
      <path d="M9 6 V13 H16" strokeOpacity="0.5" />
    </g>
  );
}

/**
 * Кадр блока 8 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_measure_tools.png`: пять инструментов из блока 6 —
 * штангенциркуль, микрометр, радиусные шаблоны, резьбомер и угольник. В шестой
 * ячейке — правило из блока 12: три замера, расхождение больше 0,1 мм значит
 * проверку инструмента, а точность принтера всё равно ±0,2 мм (блок 19).
 */
export function EngineerIN6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять инструментов замера. Штангенциркуль: габарит, диаметр и паз. Микрометр: диаметр штифта. Радиусный шаблон: радиусы и галтели. Резьбомер: шаг и профиль резьбы. Угольник: углы и плоскости. Правило: три замера, расхождение больше 0,1 миллиметра — проверь инструмент, точность принтера ±0,2 миллиметра"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          пять инструментов: что чем мерят
        </text>

        {TOOLS.map((tool, i) => {
          const { x, y } = POSITIONS[i];
          return (
            <g key={tool.name}>
              <rect
                x={x}
                y={y}
                width="140"
                height="46"
                rx="7"
                fill="#0f172a"
                fillOpacity="0.45"
                stroke="#334155"
              />
              <rect x={x} y={y} width="2.5" height="46" rx="1.2" fill={tool.accent} fillOpacity="0.8" />
              <g transform={`translate(${x + 12} ${y + 12})`}>
                <ToolIcon index={i} color={tool.accent} />
              </g>
              <text x={x + 40} y={y + 17} fontSize="10" fontWeight="700" fill={tool.accent}>
                {tool.name}
              </text>
              <text x={x + 40} y={y + 32} fontSize="10" fill="#e2e8f0">
                {tool.note}
              </text>
            </g>
          );
        })}

        {/* Правило замера вместо шестой карточки */}
        <rect x="168" y="126" width="140" height="46" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#f59e0b" strokeOpacity="0.5" />
        <text x="180" y="140" fontSize="10" fontWeight="700" fill="#fbbf24">
          3 замера
        </text>
        <text x="180" y="153" fontSize="10" fill="#e2e8f0">
          &gt; 0,1 мм — проверь
        </text>
        <text x="180" y="166" fontSize="10" fill="#94a3b8">
          принтер ±0,2 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
