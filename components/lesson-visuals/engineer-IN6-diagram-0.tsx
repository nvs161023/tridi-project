import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STATIONS = [
  { title: "объект", sub: "деталь", accent: "#94a3b8" },
  { title: "данные", sub: "замер", accent: "#fbbf24" },
  { title: "модель", sub: "CAD", accent: "#38bdf8" },
  { title: "печать", sub: "образец", accent: "#34d399" },
  { title: "проверка", sub: "узел", accent: "#a78bfa" },
];

/**
 * Кадр блока 4 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_reverse_cycle.png`: пять станций от объекта до
 * проверки в узле, возвратная дуга «правка» к модели (блок 20 — правят по одной
 * причине за раз) и два входа: три способа снять данные (блок 6) и семь
 * ключевых размеров по три раза (блоки 10 и 21).
 */
export function EngineerIN6Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цикл воспроизведения из пяти станций: объект, данные, модель, печать, проверка. Стрелки идут слева направо, от проверки возвратная стрелка к модели с подписью правка. Вход: замер, скан или фотограмметрия. Семь ключевых размеров по три раза, обычно хватает второй версии"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in6-0-next"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
          <marker
            id="in6-0-back"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          цикл воспроизведения: пять станций
        </text>

        {STATIONS.map((station, i) => {
          const x = 12 + i * 61;
          return (
            <g key={station.title}>
              <rect
                x={x}
                y="34"
                width="52"
                height="52"
                rx="7"
                fill="#0f172a"
                fillOpacity="0.45"
                stroke={station.accent}
                strokeOpacity="0.55"
              />
              <circle cx={x + 26} cy="45" r="3" fill={station.accent} />
              <text
                x={x + 26}
                y="62"
                fontSize="10"
                fontWeight="700"
                fill={station.accent}
                textAnchor="middle"
              >
                {station.title}
              </text>
              <text x={x + 26} y="76" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {station.sub}
              </text>
              {i < STATIONS.length - 1 ? (
                <line
                  x1={x + 53}
                  y1="60"
                  x2={x + 60}
                  y2="60"
                  stroke="#64748b"
                  strokeWidth="1.2"
                  markerEnd="url(#in6-0-next)"
                />
              ) : null}
            </g>
          );
        })}

        {/* Возврат от проверки к модели */}
        <path
          d="M282 86 V98 H160 V88"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
          markerEnd="url(#in6-0-back)"
        />
        <text x="221" y="112" fontSize="10" fill="#fbbf24" textAnchor="middle">
          правка: одна причина за раз
        </text>

        {/* Вход и объём работы */}
        <rect x="12" y="116" width="138" height="32" rx="6" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="20" y="129" fontSize="10" fill="#e2e8f0">
          вход: замер · скан
        </text>
        <text x="20" y="144" fontSize="10" fill="#94a3b8">
          фото тоже годится
        </text>

        <rect x="168" y="116" width="140" height="32" rx="6" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="176" y="129" fontSize="10" fill="#e2e8f0">
          7 размеров × 3 раза
        </text>
        <text x="176" y="144" fontSize="10" fill="#94a3b8">
          хватает второй версии
        </text>

        <text x="12" y="164" fontSize="10" fill="#94a3b8">
          вторая версия — норма, а не провал
        </text>
      </svg>
    </VisualWrapper>
  );
}
