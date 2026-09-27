import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Строки G-кода до сглаживания: каждая дуга разложена на прямые. */
const straightLines = [
  "G1 X10.2 Y0.4",
  "G1 X10.9 Y0.9",
  "G1 X11.5 Y1.6",
  "G1 X12.0 Y2.4",
  "G1 X12.4 Y3.3",
];

/** Те же участки контура после Arc Welding — дуги G2 и G3. */
const arcLines = [
  "G2 X10.2 Y0.4 I5 J0.2",
  "G2 X12.0 Y2.4 I5 J0.2",
  "G3 X12.4 Y3.3 I5 J0.2",
  "G2 X14.0 Y5.1 I5 J0.2",
  "G3 X15.2 Y6.0 I5 J0.2",
];

/**
 * Arc Welding: одна и та же геометрия в двух видах G-кода — слева сто коротких
 * прямых, справа десять дуг G2/G3, поэтому команд в файле становится меньше,
 * а движение принтера плавнее.
 *
 * Ровно по content урока: «100 прямых сегментов → 10 дуг. Меньше G-кода, плавнее
 * движение. Поддержка в Klipper и Marlin».
 *
 * От «Слои, которые расходятся веером» из базового урока 3 отличается предметом
 * кадра: там показаны слои, деталь и траектория сопла, здесь только текст
 * G-кода с двух сторон и подписи о количестве команд — ни слоёв, ни детали,
 * ни сопла.
 *
 * Анимация 6 с, по кругу: сначала горят прямые, потом дуги — счётчик команд
 * падает на глазах. При prefers-reduced-motion подсвечен результат: дуги.
 *
 * Классы с префиксом v-gg4a: <style> внутри SVG действует на всю страницу.
 */
export function ProGG4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация Arc Welding: слева сто коротких прямых сегментов G1, справа десять дуг G2 и G3 для той же геометрии — команд в G-коде становится меньше, а движение принтера плавнее, поддерживается в Klipper и Marlin"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-gg4a-lines { animation: v-gg4a-lines 6s ease-in-out infinite; }
          .v-gg4a-arc { animation: v-gg4a-arc 6s ease-in-out infinite; }
          @keyframes v-gg4a-lines {
            0%, 36% { opacity: 1; }
            50%, 88% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          @keyframes v-gg4a-arc {
            0%, 36% { opacity: 0.3; }
            50%, 88% { opacity: 1; }
            100% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-gg4a-lines { animation: none; opacity: 0.3; }
            .v-gg4a-arc { animation: none; opacity: 1; }
          }
        `}</style>

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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Arc Welding: 100 прямых → 10 дуг
        </text>

        <g className="v-gg4a-lines">
          <rect x="20" y="36" width="132" height="78" rx="5" fill="#0f172a" stroke="#475569" />
          {straightLines.map((line, index) => (
            <text
              key={line}
              x="28"
              y={50 + index * 14}
              fontSize="9"
              fill="#94a3b8"
              fontFamily={MONO}
            >
              {line}
            </text>
          ))}
          <text x="86" y="130" fontSize="9" fill="#f87171" textAnchor="middle">
            100 прямых сегментов
          </text>
        </g>

        <g className="v-gg4a-arc">
          <rect x="168" y="36" width="132" height="78" rx="5" fill="#0f172a" stroke="#475569" />
          {arcLines.map((line, index) => (
            <text
              key={line}
              x="176"
              y={50 + index * 14}
              fontSize="9"
              fill="#7dd3fc"
              fontFamily={MONO}
            >
              {line}
            </text>
          ))}
          <text x="234" y="130" fontSize="9" fill="#6ee7b7" textAnchor="middle">
            10 дуг
          </text>
        </g>

        <text x="12" y="152" fontSize="10" fill="#e2e8f0">
          команд в G-коде меньше, движение плавнее
        </text>
        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          Arc Welding: поддержка в Klipper и Marlin
        </text>
      </svg>
    </VisualWrapper>
  );
}
