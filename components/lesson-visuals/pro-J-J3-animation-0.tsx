import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Деталь на поворотном столе: одна и та же пластина, меняется только её поворот. */
const PLATE = { x: 78, y: 60, w: 28, h: 48 };

/** Слои внутри пластины: горизонтальные линии, они поворачиваются вместе с деталью. */
const LAYERS = [66, 72, 78, 84, 90, 96, 102];

/** Стрелка нагрузки: направление в кадре не меняется, деталь поворачивается под неё. */
const LOAD = { x: 52, y1: 50, y2: 96, arrow: "48,96 56,96 52,103" };

/** Шкала прочности: слева 40 % под нагрузкой по слоям, справа 100 % поперёк слоёв. */
const SCALE = { x: 188, y: 74, w: 108, h: 12 };

/**
 * Ориентация, по контенту урока: «Поворот на 90° → держит нагрузку в 2,5 раза
 * лучше» и по примеру из урока: «Слои вертикально — прочность 100 %. Повернуть —
 * 40 %. Разница в 2,5 раза». В кадре одна деталь: она поворачивается на 90° на
 * поворотном столе, а справа растёт шкала прочности — от 40 % до 100 %, рядом
 * плашка «×2,5». Стрелка нагрузки всё время смотрит вниз: меняется не нагрузка,
 * а ориентация детали.
 *
 * От pro-J-J1-animation-0 отличается тем, что там диптих «сломалась / держит» с
 * трещиной вдоль слоя, а здесь одна деталь, поворот и числовая шкала: трещины в
 * кадре нет, проигрыш показан числом 40 %. От pro-F-F2-animation-0 — тем, что там
 * две готовые ориентации и расслоение по границе слоёв, а здесь сам поворот.
 *
 * Анимация 8 с, по кругу: деталь стоит слоями поперёк нагрузки (40 %), к середине
 * цикла поворачивается на 90°, шкала дотягивается до 100 %, плашка «×2,5»
 * проявляется, к концу цикла всё возвращается. При prefers-reduced-motion показан
 * финал: деталь уже повёрнута, шкала полная, плашка видна.
 *
 * Классы с префиксом v-jj3a: <style> внутри SVG действует на всю страницу.
 */
export function ProJJ3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация ориентации: одна деталь на поворотном столе поворачивается на 90 градусов под неподвижной стрелкой нагрузки, справа шкала прочности растёт с 40 до 100 процентов, а плашка показывает, что повёрнутая деталь держит нагрузку в 2,5 раза лучше; внизу вывод: поворот на 90 градусов, слои встают поперёк нагрузки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
          .v-jj3a-part {
            animation: v-jj3a-turn 8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }
          @keyframes v-jj3a-turn {
            0%, 22% { transform: rotate(0deg); }
            45%, 74% { transform: rotate(90deg); }
            97%, 100% { transform: rotate(0deg); }
          }
          .v-jj3a-bar {
            animation: v-jj3a-grow 8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: left center;
          }
          @keyframes v-jj3a-grow {
            0%, 22% { transform: scaleX(0.4); }
            45%, 74% { transform: scaleX(1); }
            97%, 100% { transform: scaleX(0.4); }
          }
          .v-jj3a-badge { animation: v-jj3a-badge 8s ease-in-out infinite; }
          @keyframes v-jj3a-badge {
            0%, 28% { opacity: 0.25; }
            50%, 74% { opacity: 1; }
            97%, 100% { opacity: 0.25; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-jj3a-part { animation: none; transform: rotate(90deg); }
            .v-jj3a-bar { animation: none; transform: scaleX(1); }
            .v-jj3a-badge { animation: none; opacity: 1; }
          }
        `}</style>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          поворот на 90° — прочность ×2,5
        </text>

        {/* Слева — деталь на поворотном столе и неподвижная нагрузка */}
        <rect x="12" y="26" width="150" height="104" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="50" y="39" fontSize="9" fill="#cbd5e1" textAnchor="middle">
          нагрузка
        </text>
        <line x1={LOAD.x} y1={LOAD.y1} x2={LOAD.x} y2={LOAD.y2} stroke="#94a3b8" strokeWidth="1.4" />
        <polygon points={LOAD.arrow} fill="#94a3b8" />

        <g className="v-jj3a-part">
          <rect x={PLATE.x} y={PLATE.y} width={PLATE.w} height={PLATE.h} fill="#475569" stroke="#64748b" />
          {LAYERS.map((y) => (
            <line
              key={`layer-${y}`}
              x1={PLATE.x + 1}
              y1={y}
              x2={PLATE.x + PLATE.w - 1}
              y2={y}
              stroke="#38bdf8"
              strokeOpacity="0.5"
            />
          ))}
        </g>

        <line x1="66" y1="112" x2="118" y2="112" stroke="#64748b" strokeWidth="2" />
        <path d="M122,74 Q138,84 122,94" fill="none" stroke="#94a3b8" />
        <text x="140" y="124" fontSize="9" fill="#cbd5e1">
          90°
        </text>

        {/* Справа — шкала прочности и плашка про выигрыш */}
        <rect x="172" y="26" width="136" height="104" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="180" y="42" fontSize="9" fill="#94a3b8">
          прочность под нагрузкой
        </text>
        <rect x={SCALE.x} y={SCALE.y} width={SCALE.w} height={SCALE.h} rx="3" fill="#334155" />
        <rect
          className="v-jj3a-bar"
          x={SCALE.x}
          y={SCALE.y}
          width={SCALE.w}
          height={SCALE.h}
          rx="3"
          fill="#34d399"
          fillOpacity="0.8"
        />
        <text x="231" y="103" fontSize="9" fill="#cbd5e1" textAnchor="middle">
          40 %
        </text>
        <text x="296" y="103" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          100 %
        </text>
        <g className="v-jj3a-badge">
          <rect x="238" y="110" width="62" height="20" rx="10" fill="#0f172a" stroke="#34d399" />
          <text x="269" y="123" fontSize="11" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
            ×2,5
          </text>
        </g>

        <text x="12" y="148" fontSize="10" fill="#e2e8f0">
          поворот на 90° — держит нагрузку
        </text>
        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          слои встают поперёк нагрузки
        </text>
      </svg>
    </VisualWrapper>
  );
}
