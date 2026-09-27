import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три тела по цветам: строка в панели Bodies и её цвет. */
const bodies = [
  { y: 48, color: "#38bdf8", name: "синее" },
  { y: 70, color: "#fbbf24", name: "жёлтое" },
  { y: 92, color: "#f87171", name: "красное" },
];

/** Три инструмента на обрезанной панели Fusion: третий — Split Body. */
const toolIcons = [42, 60, 78];

/**
 * Split Body в Fusion 360 — компактное окно с разрезанной на три тела моделью и
 * панель Bodies справа: три строки по цветам, у каждой свой STL. Окно программы
 * обрезано до рабочей области и узкой панели инструментов, чтобы в кадре не было
 * целого интерфейса.
 *
 * Ровно по content урока: «модель разделена на 3 тела по цветам. Каждое —
 * отдельный STL» и по шагам: Split Body по цветам → назови тела по цветам →
 * экспорт каждого в STL → печатай по очереди.
 *
 * От схем окон в базовом курсе (Orca в уроках 3 и 9, Tinkercad в уроке 13)
 * отличается приёмом: там всё окно целиком с подписями зон и настроек, здесь —
 * только модель с телами и список тел с кнопками выгрузки.
 */
export function ProFF4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Split Body в Fusion 360: модель разделена на три тела по цветам, справа в панели Bodies три строки с цветными метками — синее, жёлтое и красное тело, у каждого свой STL для отдельной печати"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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
          split body: три тела — три STL
        </text>

        {/* Компактное окно: шапка, узкая панель инструментов и модель в телах */}
        <rect x="10" y="24" width="176" height="96" rx="6" fill="#0f172a" stroke="#475569" />
        <rect x="11" y="25" width="174" height="9" fill="#334155" />
        <line x1="17" y1="29" x2="23" y2="29" stroke="#64748b" strokeWidth="1.5" />
        <line x1="29" y1="29" x2="35" y2="29" stroke="#64748b" strokeWidth="1.5" />
        <rect x="11" y="35" width="20" height="84" fill="#1e293b" />
        {toolIcons.map((y, index) => (
          <rect
            key={`tool-${y}`}
            x="15"
            y={y}
            width="12"
            height="12"
            rx="2"
            fill="#334155"
            stroke={index === 2 ? "#38bdf8" : "#64748b"}
          />
        ))}
        {bodies.map((body) => (
          <rect
            key={`body-${body.y}`}
            x="60"
            y={body.y - 4}
            width="72"
            height="18"
            rx="3"
            fill={body.color}
            fillOpacity="0.5"
            stroke={body.color}
          />
        ))}
        <line x1="52" y1="64" x2="140" y2="64" stroke="#38bdf8" strokeDasharray="4 3" />
        <line x1="52" y1="86" x2="140" y2="86" stroke="#38bdf8" strokeDasharray="4 3" />

        {/* Панель Bodies: три строки, у каждой метка цвета и своя выгрузка */}
        <rect x="194" y="24" width="116" height="96" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="200" y="40" fontSize="10" fontWeight="bold" fill="#93c5fd">
          тела
        </text>
        {bodies.map((body) => (
          <g key={`row-${body.y}`}>
            <rect x="200" y={body.y} width="104" height="18" rx="3" fill="#334155" />
            <rect x="204" y={body.y + 4} width="6" height="10" rx="1" fill={body.color} />
            <text x="216" y={body.y + 14} fontSize="10" fill="#e2e8f0">
              {body.name}
            </text>
            <rect x="264" y={body.y + 2} width="34" height="14" rx="7" fill="#0f172a" stroke="#34d399" />
            <text x="273" y={body.y + 12} fontSize="9" fill="#6ee7b7">
              STL
            </text>
          </g>
        ))}

        <text x="12" y="136" fontSize="10" fill="#e2e8f0">
          каждое тело — отдельный файл
        </text>
        <text x="12" y="154" fontSize="9" fill="#94a3b8">
          тела называем по цветам и печатаем по очереди
        </text>
        <text x="12" y="170" fontSize="9" fill="#94a3b8">
          Split Body режет модель по плоскостям
        </text>
      </svg>
    </VisualWrapper>
  );
}
