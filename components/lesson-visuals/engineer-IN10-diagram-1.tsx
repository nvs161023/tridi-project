import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  {
    title: "вызов",
    accent: "#38bdf8",
    width: 84,
    lines: ["START_PRINT", "BED=70", "EXTRUDER=235"],
  },
  {
    title: "default",
    accent: "#a78bfa",
    width: 68,
    lines: ["params.BED", "default(60)", "int"],
  },
  {
    title: "ветка",
    accent: "#fbbf24",
    width: 64,
    lines: ["PLA", "PETG", "else → стоп"],
  },
  {
    title: "команда",
    accent: "#34d399",
    width: 64,
    lines: ["M104/M140", "M109/M190", "нагрев"],
  },
];

const STEP_X = [12, 100, 172, 240];

const BRANCHES = [
  { text: "PLA — сопло 210 · стол 60", fill: "#34d399" },
  { text: "PETG — сопло 240 · стол 80", fill: "#f472b6" },
  { text: "else — M117 и остановка", fill: "#fbbf24" },
];

/**
 * Кадр блока 11 урока IN10 «Макросы Klipper и постобработка».
 *
 * Макет из описания `IN10_params_flow.png`: путь параметра от вызова до команды.
 * Числа — блок 8 (BED=70 EXTRUDER=235 в вызове, 60/210 по умолчанию), блок 7
 * (default, int, предел 300°, не больше трёх параметров) и блок 10 (PLA 210/60,
 * PETG 240/80, else с M117 и остановкой).
 */
export function EngineerIN10Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь параметра: вызов START_PRINT BED=70 EXTRUDER=235, затем params.BED с фильтрами default 60 и int, затем ветка PLA или PETG, затем команда нагрева. PLA получает сопло 210 и стол 60, PETG — 240 и 80, неизвестный материал уходит в else с сообщением M117 и остановкой. Предел температуры 300 градусов, не больше трёх параметров"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          путь параметра: от вызова до команды
        </text>

        {STEPS.map((step, i) => {
          const x = STEP_X[i];
          return (
            <g key={step.title}>
              <rect x={x} y="28" width={step.width} height="62" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
              <rect x={x} y="28" width={step.width} height="2.5" rx="1.2" fill={step.accent} fillOpacity="0.85" />
              <text x={x + 7} y="41" fontSize="10" fontWeight="700" fill={step.accent}>
                {step.title}
              </text>
              {step.lines.map((line, j) => (
                <text key={line} x={x + 7} y={56 + j * 14} fontSize="10" fill={j === 0 ? "#e2e8f0" : "#cbd5e1"}>
                  {line}
                </text>
              ))}
              {i < STEPS.length - 1 && (
                <text x={x + step.width} y="61" fontSize="10" fill="#64748b">
                  ›
                </text>
              )}
            </g>
          );
        })}

        <rect x="12" y="96" width="296" height="46" rx="6" fill="#0f172a" fillOpacity="0.4" stroke="#334155" />
        {BRANCHES.map((branch, i) => (
          <text key={branch.text} x="22" y={109 + i * 14} fontSize="10" fill={branch.fill}>
            {branch.text}
          </text>
        ))}

        <rect x="12" y="144" width="296" height="29" rx="6" fill="#a78bfa" fillOpacity="0.08" stroke="#a78bfa" strokeOpacity="0.3" />
        <text x="22" y="156" fontSize="10" fill="#e2e8f0">
          default ловит пустой параметр · int отбрасывает дробь
        </text>
        <text x="22" y="170" fontSize="10" fill="#94a3b8">
          предел 300° · не больше трёх параметров
        </text>
      </svg>
    </VisualWrapper>
  );
}
