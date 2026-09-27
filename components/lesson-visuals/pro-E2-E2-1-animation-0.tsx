import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Гибкие материалы из content урока: «Два образца: 95A гнётся и возвращается,
 * 85A растягивается как резинка» и список «TPU 95A — твёрдый, как плотная
 * резина. TPU 85A — мягкий» со шкалой Шора 85–95.
 *
 * От «Трёх крючков» в модуле E1 отличается предметом сравнения: там три РАЗНЫХ
 * пластика (PLA треснул, PETG выдержал, TPU согнулся), здесь два образца ОДНОГО
 * материала разной твёрдости и одна и та же нагрузка. Полоски закреплены в
 * зажимах, снизу груз: мягкая 85A вытягивается и остаётся растянутой, жёсткая
 * 95A прогибается и пружинит обратно.
 *
 * Нагрузка показана без цифр: урок массу не даёт. Внизу — шкала твёрдости, позиции
 * подписей совпадают с позициями колонок: 85A слева, 95A справа.
 *
 * Анимация 6 с, по кругу: сначала обе полоски целые, затем 85A вытягивается и до
 * конца цикла остаётся растянутой, а 95A прогибается и возвращается.
 * При prefers-reduced-motion показано итоговое состояние — растянутая 85A и
 * вернувшаяся 95A.
 *
 * Классы с префиксом v-e21a: <style> внутри SVG действует на всю страницу.
 */
export function ProE2E21Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: две полоски одного TPU под одинаковым грузом — мягкая 85A вытягивается, как резинка, и остаётся растянутой, жёсткая 95A прогибается и пружинит обратно; внизу шкала твёрдости по Шору от 85A до 95A"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-e21a-hold { animation: v-e21a-stretch 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }
          .v-e21a-hold-load { animation: v-e21a-stretch-load 6s ease-in-out infinite; }
          .v-e21a-spring { animation: v-e21a-bounce 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }
          .v-e21a-spring-load { animation: v-e21a-bounce-load 6s ease-in-out infinite; }
          @keyframes v-e21a-stretch {
            0%, 8% { transform: scaleY(1); }
            24%, 92% { transform: scaleY(1.32); }
            100% { transform: scaleY(1); }
          }
          @keyframes v-e21a-stretch-load {
            0%, 8% { transform: translateY(0); }
            24%, 92% { transform: translateY(17px); }
            100% { transform: translateY(0); }
          }
          @keyframes v-e21a-bounce {
            0%, 44% { transform: scaleY(1); }
            58%, 70% { transform: scaleY(1.12); }
            84%, 100% { transform: scaleY(1); }
          }
          @keyframes v-e21a-bounce-load {
            0%, 44% { transform: translateY(0); }
            58%, 70% { transform: translateY(6px); }
            84%, 100% { transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-e21a-hold { animation: none; transform: scaleY(1.32); }
            .v-e21a-hold-load { animation: none; transform: translateY(17px); }
            .v-e21a-spring { animation: none; }
            .v-e21a-spring-load { animation: none; }
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
          TPU 85A и 95A: одна нагрузка — разный отклик
        </text>

        <text x="90" y="30" fontSize="9" fill="#c4b5fd" textAnchor="middle">
          TPU 85A — тянется
        </text>
        <text x="230" y="30" fontSize="9" fill="#a78bfa" textAnchor="middle">
          TPU 95A — пружинит
        </text>

        {/* Зажимы, в которых закреплены обе полоски */}
        <rect x="74" y="42" width="32" height="8" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="214" y="42" width="32" height="8" rx="2" fill="#334155" stroke="#64748b" />

        {/* 85A: мягкая полоска вытягивается и остаётся растянутой */}
        <rect
          className="v-e21a-hold"
          x="82"
          y="50"
          width="16"
          height="54"
          rx="3"
          fill="#c4b5fd"
        />
        <g className="v-e21a-hold-load">
          <line x1="90" y1="104" x2="90" y2="112" stroke="#94a3b8" />
          <rect x="78" y="112" width="24" height="14" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>

        {/* 95A: жёсткая полоска прогибается и возвращается */}
        <rect
          className="v-e21a-spring"
          x="222"
          y="50"
          width="16"
          height="54"
          rx="3"
          fill="#a78bfa"
        />
        <g className="v-e21a-spring-load">
          <line x1="230" y1="104" x2="230" y2="112" stroke="#94a3b8" />
          <rect x="218" y="112" width="24" height="14" rx="2" fill="#334155" stroke="#94a3b8" />
        </g>

        {/* Шкала твёрдости: позиции совпадают с колонками */}
        <text x="160" y="142" fontSize="8" fill="#94a3b8" textAnchor="middle">
          твёрдость по Шору
        </text>
        <line x1="60" y1="154" x2="260" y2="154" stroke="#64748b" />
        <line x1="60" y1="150" x2="60" y2="158" stroke="#64748b" />
        <line x1="260" y1="150" x2="260" y2="158" stroke="#64748b" />
        <text x="60" y="170" fontSize="8" fill="#c4b5fd" textAnchor="middle">
          85A
        </text>
        <text x="260" y="170" fontSize="8" fill="#a78bfa" textAnchor="middle">
          95A
        </text>
      </svg>
    </VisualWrapper>
  );
}
