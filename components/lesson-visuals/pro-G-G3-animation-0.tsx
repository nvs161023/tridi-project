import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Двадцать бороздок верхнего слоя: сопло затирает их одну за другой. */
const grooves = Array.from({ length: 20 }, (_, index) => 34 + index * 13);

/** Разделители нижних слоёв — они от Ironing не меняются. */
const lowerLayers = [96, 108, 120];

/**
 * Кадры затирания: бороздка гаснет в тот момент, когда до неё доходит сопло.
 * Свои keyframes на каждую бороздку — с общим animation-delay сдвинулся бы весь
 * цикл, и проход «слева направо» перестал бы читаться.
 */
const GROOVE_STYLES = grooves
  .map((_, index) => {
    const at = 8 + (index / (grooves.length - 1)) * 76;
    return `          .v-gg3a-g${index} { animation: v-gg3a-wipe${index} 6s linear infinite; }
          @keyframes v-gg3a-wipe${index} {
            0%, ${at.toFixed(1)}% { opacity: 1; }
            ${(at + 6).toFixed(1)}%, 92% { opacity: 0; }
            99%, 100% { opacity: 1; }
          }`;
  })
  .join("\n");

/**
 * Как работает Ironing: сопло идёт по верхнему слою слева направо без подачи
 * пластика, бороздки за ним затираются, а нижние слои остаются как были.
 *
 * Ровно по content урока: «Сопло проходит по верхнему слою без подачи пластика.
 * Разглаживает бороздки. Поверхность становится гладкой».
 *
 * От «Сопло наращивает модель слой за слоем» из базового урока 1 отличается
 * движением и результатом: там сопло с подачей строит новые слои снизу вверх и
 * показан стол с заполнением; здесь сопло едет по уже готовому верху без подачи
 * (подача 0%), меняет только верхний слой, а нижние слои помечены как
 * неизменные — разрез и слои снизу вверх не показываются.
 *
 * Анимация 6 с, по кругу: сопло проходит вправо, бороздки гаснут, гладкая
 * полоса растёт за соплом, затем всё возвращается. При prefers-reduced-motion
 * показан итог: верх затёрт, сопло в конце прохода.
 *
 * Классы с префиксом v-gg3a: <style> внутри SVG действует на всю страницу.
 */
export function ProGG3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло проходит по верхнему слою детали без подачи пластика, подача 0 процентов, бороздки слоёв за соплом затираются и остаётся гладкая полоса, а нижние слои детали не меняются"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
${GROOVE_STYLES}
          .v-gg3a-wipe { animation: v-gg3a-wipe 6s linear infinite; transform-box: fill-box; transform-origin: left center; }
          .v-gg3a-head { animation: v-gg3a-head 6s linear infinite; }
          @keyframes v-gg3a-wipe {
            0%, 8% { transform: scaleX(0.01); }
            84%, 92% { transform: scaleX(1); }
            100% { transform: scaleX(0.01); }
          }
          @keyframes v-gg3a-head {
            0%, 8% { transform: translateX(0); }
            84%, 92% { transform: translateX(240px); }
            100% { transform: translateX(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-gg3a-groove { animation: none; opacity: 0; }
            .v-gg3a-wipe { animation: none; transform: scaleX(1); }
            .v-gg3a-head { animation: none; transform: translateX(240px); }
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
          сопло без подачи затирает верх
        </text>
        <text x="308" y="14" fontSize="9" fill="#fbbf24" textAnchor="end">
          подача 0%
        </text>

        {/* Тело детали: нижние слои не меняются */}
        <rect x="30" y="84" width="260" height="46" rx="3" fill="#334155" stroke="#64748b" />
        {lowerLayers.map((y) => (
          <line key={`lower-${y}`} x1="30" y1={y} x2="290" y2={y} stroke="#64748b" strokeOpacity="0.5" />
        ))}

        {/* Верхний слой: бороздки, которые затирает сопло */}
        {grooves.map((x, index) => (
          <line
            key={`groove-${x}`}
            className={`v-gg3a-groove v-gg3a-g${index}`}
            x1={x}
            y1="84"
            x2={x}
            y2="79"
            stroke="#cbd5e1"
            strokeOpacity="0.8"
          />
        ))}
        <rect className="v-gg3a-wipe" x="30" y="78" width="260" height="6" fill="#38bdf8" fillOpacity="0.3" />
        <line x1="30" y1="78" x2="290" y2="78" stroke="#38bdf8" />

        {/* Сопло без подачи */}
        <g className="v-gg3a-head">
          <rect x="38" y="50" width="4" height="10" fill="#94a3b8" />
          <polygon points="35,60 45,60 43,78 37,78" fill="#cbd5e1" />
        </g>

        <text x="12" y="148" fontSize="10" fill="#e2e8f0">
          верхний слой: бороздки → гладко
        </text>
        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          нижние слои не меняются
        </text>
      </svg>
    </VisualWrapper>
  );
}
