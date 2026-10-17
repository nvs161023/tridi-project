import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PREP = [
  {
    name: "Матирование",
    accent: "#38bdf8",
    lines: ["спрей с 20 см", "два тонких слоя", "или пудра"],
  },
  {
    name: "Метки",
    accent: "#a78bfa",
    lines: ["контрастные", "на матовых", "местах", "вокруг детали"],
  },
  {
    name: "Фон",
    accent: "#34d399",
    lines: ["матовый", "контрастный", "без узора"],
  },
];

const PROBLEMS = [
  { label: "зеркало", width: 66 },
  { label: "прозрачное", width: 82 },
  { label: "чёрное", width: 62 },
  { label: "ворс", width: 46 },
];

let chipX = 12;
const PROBLEM_CHIPS = PROBLEMS.map((item) => {
  const x = chipX;
  chipX += item.width + 8;
  return { ...item, x };
});

/**
 * Кадр блока 17 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_prepare_object.png`: три шага подготовки детали —
 * матирование, метки и фон — с приёмами из блоков 16 и 18. Внизу четыре
 * свойства поверхности, которые ломают скан, и вывод урока: подготовка
 * занимает больше времени, чем сама съёмка.
 */
export function EngineerIN7Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Подготовка детали к сканированию. Матирование: спрей с 20 сантиметров, два тонких слоя или пудра. Метки: контрастные, на матовых местах и вокруг детали. Фон: матовый, контрастный, без узора. Скан ломают зеркальные, прозрачные, чёрные и ворсистые поверхности. Подготовка занимает больше времени, чем съёмка"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          подготовка: матовость, метки, фон
        </text>

        {PREP.map((step, i) => {
          const x = 12 + i * 100;
          return (
            <g key={step.name}>
              <rect x={x} y="24" width="96" height="98" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
              <rect x={x} y="24" width="96" height="2.5" rx="1.2" fill={step.accent} fillOpacity="0.85" />
              <circle cx={x + 14} cy="41" r="6" fill="none" stroke={step.accent} strokeWidth="1.2" />
              <text x={x + 14} y="45" fontSize="10" fontWeight="700" fill={step.accent} textAnchor="middle">
                {i + 1}
              </text>
              <text x={x + 25} y="45" fontSize="10" fill={step.accent}>
                {step.name}
              </text>
              {step.lines.map((line, j) => (
                <text key={line} x={x + 10} y={62 + j * 16} fontSize="10" fill="#cbd5e1">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        <text x="12" y="136" fontSize="10" fill="#94a3b8">
          ломает скан:
        </text>
        {PROBLEM_CHIPS.map((item) => (
          <g key={item.label}>
            <rect x={item.x} y="141" width={item.width} height="18" rx="9" fill="#f43f5e" fillOpacity="0.12" stroke="#f43f5e" strokeOpacity="0.45" />
            <text x={item.x + item.width / 2} y="153" fontSize="10" fill="#fda4af" textAnchor="middle">
              {item.label}
            </text>
          </g>
        ))}

        <text x="12" y="172" fontSize="10" fill="#fbbf24">
          подготовка дольше съёмки — это норма
        </text>
      </svg>
    </VisualWrapper>
  );
}
