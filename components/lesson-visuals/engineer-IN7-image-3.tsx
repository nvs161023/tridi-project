import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CLOUD_DOTS = [
  [48, 44],
  [61, 38],
  [74, 42],
  [88, 36],
  [102, 41],
  [116, 38],
  [128, 46],
  [54, 57],
  [69, 54],
  [85, 58],
  [101, 52],
  [117, 57],
  [131, 60],
  [44, 71],
  [60, 70],
  [77, 74],
  [94, 68],
  [110, 72],
  [124, 74],
  [55, 84],
  [72, 82],
  [90, 86],
  [107, 82],
  [122, 87],
];

const STEPS = ["эталон в кадре", "база 100 мм", "пересчёт облака"];

/**
 * Кадр блока 20 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_scale_marks.png`: облако точек без единиц измерения,
 * линейка-эталон на 100 мм и три шага задания масштаба из блоков 19 и 21.
 * Внизу правило проверки из блока 19: расхождение больше 0,3 мм — ошибка
 * масштаба, а не «погрешность сканера».
 */
export function EngineerIN7Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Масштаб облака точек: без эталона облако не имеет единиц измерения. В кадр кладут линейку, задают базу 100 миллиметров, пересчитывают облако и сверяют второй размер. Расхождение больше 0,3 миллиметра значит ошибку масштаба, а не погрешность сканера. Файл подписывают, например, 100мм_линейка"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          масштаб: облако без единиц
        </text>

        {/* Облако точек без масштаба */}
        <rect x="36" y="30" width="104" height="62" rx="8" fill="#a78bfa" fillOpacity="0.07" stroke="#a78bfa" strokeOpacity="0.45" strokeDasharray="4 4" />
        {CLOUD_DOTS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#c4b5fd" fillOpacity="0.9" />
        ))}
        <text x="88" y="104" fontSize="10" fill="#c4b5fd" textAnchor="middle">
          единиц нет
        </text>

        {/* Линейка-эталон */}
        <rect x="24" y="110" width="120" height="16" rx="2" fill="#0f172a" stroke="#fbbf24" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <line key={i} x1={24 + i * 12} y1="110" x2={24 + i * 12} y2={i % 5 === 0 ? 118 : 115} stroke="#fbbf24" strokeWidth="0.8" />
        ))}
        <text x="84" y="140" fontSize="10" fill="#fbbf24" textAnchor="middle">
          100 мм
        </text>

        {/* Три шага задания масштаба */}
        {STEPS.map((step, i) => (
          <g key={step}>
            <circle cx="184" cy={33 + i * 24} r="6.5" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
            <text x="184" y={37 + i * 24} fontSize="10" fontWeight="700" fill="#38bdf8" textAnchor="middle">
              {i + 1}
            </text>
            <text x="196" y={37 + i * 24} fontSize="10" fill="#cbd5e1">
              {step}
            </text>
          </g>
        ))}
        <line x1="176" y1="92" x2="308" y2="92" stroke="#334155" />
        <text x="176" y="110" fontSize="10" fill="#fbbf24">
          &gt; 0,3 мм — ошибка
        </text>
        <text x="176" y="126" fontSize="10" fill="#94a3b8">
          сверь второй размер
        </text>

        <text x="12" y="156" fontSize="10" fill="#cbd5e1">
          масштаб задаёшь ты, а не прибор
        </text>
        <text x="12" y="172" fontSize="10" fill="#fbbf24">
          подпись файла: «100мм_линейка»
        </text>
      </svg>
    </VisualWrapper>
  );
}
