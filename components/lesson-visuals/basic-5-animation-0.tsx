import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Формирование первого слоя — одна линия крупным планом.
 *
 * Ровно по content урока: «Линии ложатся рядом и сплющиваются. Высоко — круглые,
 * не касаются». Сопло опускается и прижимает линию: круглая капля превращается в
 * плоскую полосу, а вторая линия подъезжает вплотную и ложится рядом.
 *
 * От разрезов первого слоя (урок 5, картинка) отличается масштабом: там три
 * положения сопла в ряд, здесь одна линия во весь кадр. И от анимации температуры
 * (урок 4) — там сравниваются дорожки при 180/210/240 °C.
 */
export function Basic5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло опускается и сплющивает линию — круглая капля становится плоской, вторая линия подъезжает вплотную и ложится рядом"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b5a-nozzle { animation: v-b5a-press 3.2s ease-in-out infinite; }
          .v-b5a-round { opacity: 0; animation: v-b5a-round 3.2s ease-in-out infinite; }
          .v-b5a-flat { animation: v-b5a-flat 3.2s ease-in-out infinite; }
          .v-b5a-next { animation: v-b5a-approach 3.2s ease-in-out infinite; }
          @keyframes v-b5a-press {
            0%, 100% { transform: translateY(0); }
            60% { transform: translateY(5px); }
          }
          @keyframes v-b5a-round {
            0% { opacity: 1; }
            45%, 100% { opacity: 0; }
          }
          @keyframes v-b5a-flat {
            0% { opacity: 0; }
            55%, 100% { opacity: 1; }
          }
          @keyframes v-b5a-approach {
            0% { transform: translate(22px, -4px); opacity: 0.3; }
            60%, 100% { transform: translate(0, 0); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-b5a-nozzle, .v-b5a-round, .v-b5a-flat, .v-b5a-next {
              animation: none;
            }
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

        {/* Стол: верхняя плоскость на y=120 */}
        <rect x="14" y="120" width="292" height="10" rx="2" fill="#1e3a5f" stroke="#3b82f6" />

        <text x="18" y="30" fontSize="10" fill="#e2e8f0">
          сопло опускается и прижимает линию
        </text>

        {/* Уже лежащая линия: круглая капля и сплющенная полоса */}
        <circle className="v-b5a-round" cx="112" cy="111" r="9" fill="#f87171" />
        <rect className="v-b5a-flat" x="96" y="112" width="32" height="8" rx="4" fill="#34d399" />

        {/* Вторая линия подъезжает вплотную */}
        <rect
          className="v-b5a-next"
          x="128"
          y="112"
          width="32"
          height="8"
          rx="4"
          fill="#34d399"
        />

        {/* Сопло над линией */}
        <g className="v-b5a-nozzle">
          <rect x="103" y="56" width="22" height="12" rx="3" fill="#334155" stroke="#475569" />
          <rect x="111" y="68" width="6" height="20" fill="#475569" />
          <polygon points="108,88 120,88 114,100" fill="#94a3b8" />
        </g>

        {/* Подсказки: почему линия круглая или плоская */}
        <circle cx="24" cy="142" r="4" fill="#f87171" />
        <text x="36" y="146" fontSize="10" fill="#94a3b8">
          высоко — круглая, не касается
        </text>
        <rect x="20" y="162" width="10" height="6" rx="3" fill="#34d399" />
        <text x="36" y="166" fontSize="10" fill="#94a3b8">
          норма — сплющена и прижата
        </text>
      </svg>
    </VisualWrapper>
  );
}
