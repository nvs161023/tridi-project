import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  {
    title: "излом",
    lines: ["ручка у штифта", "слои поперёк"],
    accent: "#f87171",
  },
  {
    title: "замер",
    lines: ["по целой части", "не по износу"],
    accent: "#fbbf24",
  },
  {
    title: "модель",
    lines: ["галтель R2", "ребро 2 мм"],
    accent: "#38bdf8",
  },
  {
    title: "печать",
    lines: ["PETG · слои вдоль", "люфт → +0,2 мм"],
    accent: "#34d399",
  },
];

/**
 * Кадр блока 22 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_broken_part.png`: четыре карточки от излома до печати.
 * Числа взяты из блоков 20 и 24: галтель 2 мм вместо острого угла, ребро 2 мм,
 * PETG и слои вдоль нагрузки, а люфт на двери лечится припуском +0,2 мм к штифту.
 */
export function EngineerIN6Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре шага ремонта сломанной ручки. Излом у штифта, слои поперёк нагрузки. Замер по целой части, а не по износу. В модели галтель R2 и ребро 2 миллиметра. Печать PETG слоями вдоль ручки, при люфте добавить 0,2 миллиметра к штифту"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          сломанная деталь: копия прочнее оригинала
        </text>

        {STEPS.map((step, i) => {
          const x = 12 + (i % 2) * 148;
          const y = 24 + Math.floor(i / 2) * 74;
          return (
            <g key={step.title}>
              <rect x={x} y={y} width="148" height="66" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
              <rect x={x} y={y} width="148" height="2.5" rx="1.2" fill={step.accent} fillOpacity="0.8" />
              <text x={x + 10} y={y + 18} fontSize="10" fontWeight="700" fill={step.accent}>
                {step.title}
              </text>
              <text x={x + 10} y={y + 36} fontSize="10" fill="#e2e8f0">
                {step.lines[0]}
              </text>
              <text x={x + 10} y={y + 54} fontSize="10" fill="#cbd5e1">
                {step.lines[1]}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
