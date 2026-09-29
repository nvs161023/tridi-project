import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Корпус в разрезе: толстые стенки и пустая полость внутри. */
const SHELL = { x: 60, y: 56, w: 72, h: 60 };
const CAVITY = { x: 68, y: 64, w: 56, h: 44 };

/** Слои — горизонтальные плоскости: в разрезе видны как линии в левой и правой стенке. */
const LAYERS = [62, 68, 74, 80, 86, 92, 98, 104, 110];

/** Давление изнутри: стрелки упираются в верхнюю и нижнюю стенки. */
const PUSH_UP = { x: 76, y1: 86, y2: 74, arrow: "72,74 80,74 76,66" };
const PUSH_DOWN = { x: 112, y1: 86, y2: 98, arrow: "108,98 116,98 112,106" };

/**
 * Корпус под давлением, по контенту урока: «Фото: корпус. Схема нагрузки.
 * Параметры» и по тексту блока: «Нагрузка на разрыв по слоям. Ориентация: слои
 * перпендикулярно давлению. Заполнение 100 % или 6 стенок. Материал: PETG или PA.
 * Для герметичности — пропитка эпоксидкой». В кадре разрез корпуса: слои стоят
 * горизонтально, давление изнутри давит вверх и вниз — по слоям, поэтому между
 * слоями сверху показан разрыв, а стенки толстые. Справа параметры, внизу
 * про герметичность.
 *
 * От pro-J-J5-image-0 отличается нагрузкой: там кронштейн на разрыв и изгиб, здесь
 * давление изнутри и разрыв по слоям. От pro-J-J3-image-0 — тем, что там про
 * прочность осей одной детали, а здесь про герметичный корпус и его стенки.
 */
export function ProJJ5Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Корпус под давлением в разрезе: толстые стенки и полость внутри, слои идут горизонтально и видны линиями в стенках, изнутри стрелки давления упираются в верхнюю и нижнюю стенки, а между слоями сверху пунктиром показан разрыв; справа параметры: ориентация слои поперёк давления, заполнение 100 процентов или 6 стенок, материал PETG или PA; внизу про герметичность: пропитка эпоксидкой"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          корпус: давление рвёт деталь по слоям
        </text>

        {/* Деталь: стенки в разрезе, слои в стенках и давление изнутри */}
        <rect x="12" y="26" width="180" height="114" rx="8" fill="#0f172a" stroke="#475569" />
        <rect x={SHELL.x} y={SHELL.y} width={SHELL.w} height={SHELL.h} fill="#475569" stroke="#64748b" />
        <rect x={CAVITY.x} y={CAVITY.y} width={CAVITY.w} height={CAVITY.h} fill="#0f172a" />
        {LAYERS.map((y) => (
          <g key={`layer-${y}`}>
            <line x1={SHELL.x + 1} y1={y} x2={CAVITY.x} y2={y} stroke="#38bdf8" strokeOpacity="0.55" />
            <line
              x1={CAVITY.x + CAVITY.w}
              y1={y}
              x2={SHELL.x + SHELL.w - 1}
              y2={y}
              stroke="#38bdf8"
              strokeOpacity="0.55"
            />
          </g>
        ))}
        <line x1={PUSH_UP.x} y1={PUSH_UP.y1} x2={PUSH_UP.x} y2={PUSH_UP.y2} stroke="#f87171" strokeWidth="1.5" />
        <polygon points={PUSH_UP.arrow} fill="#f87171" />
        <line
          x1={PUSH_DOWN.x}
          y1={PUSH_DOWN.y1}
          x2={PUSH_DOWN.x}
          y2={PUSH_DOWN.y2}
          stroke="#f87171"
          strokeWidth="1.5"
        />
        <polygon points={PUSH_DOWN.arrow} fill="#f87171" />
        <text x="12" y="80" fontSize="9" fill="#cbd5e1">
          давление
        </text>
        <line x1="66" y1="65" x2="126" y2="65" stroke="#f87171" strokeWidth="1.6" strokeDasharray="5 4" />
        <text x="140" y="64" fontSize="9" fill="#f87171">
          разрыв
        </text>

        {/* Параметры печати и герметичности из текста блока */}
        <rect x="202" y="26" width="106" height="114" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="210" y="52" fontSize="8.5" fill="#94a3b8">
          ориентация
        </text>
        <text x="210" y="69" fontSize="9" fill="#e2e8f0">
          поперёк давления
        </text>
        <text x="210" y="90" fontSize="8.5" fill="#94a3b8">
          заполнение
        </text>
        <text x="210" y="107" fontSize="9" fill="#e2e8f0">
          100 % или 6 стенок
        </text>
        <text x="210" y="128" fontSize="9" fill="#cbd5e1">
          материал: PETG, PA
        </text>

        <text x="12" y="160" fontSize="10" fill="#e2e8f0">
          герметичность: пропитка эпоксидкой
        </text>
      </svg>
    </VisualWrapper>
  );
}
