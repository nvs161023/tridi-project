import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре инструмента слева: квадрат, круг, треугольник и плюс. */
const toolbarIcons = ["square", "circle", "triangle", "plus"];

/** Фигуры в панели справа — те же четыре, что перечислены в content урока. */
const paletteShapes = ["cube", "cylinder", "sphere", "cone"];

/** Сетка рабочей области: шаг 30 px, чтобы заготовка читалась как на столе. */
const canvasVerticals = [96, 126, 156, 186];
const canvasHorizontals = [62, 86, 110];

/** Заготовка в центре — та же деталь 40×20 мм, что печатали в уроке 12. */
const work = { x: 96, y: 60, width: 80, height: 40 };

/**
 * Интерфейс Tinkercad — схема экрана по content урока.
 *
 * Ровно по content: «Справа — фигуры: куб, цилиндр, сфера, конус. В центре —
 * рабочая область. Слева — инструменты. Вверху — „Экспорт“». Зоны подписаны
 * словами урока, заготовка в центре — будущий брелок с отверстием и надписью.
 *
 * От схемы Orca Slicer (урок 3) отличается приёмом: там четыре пронумерованные
 * зоны одного и того же окна, здесь акцент на панели фигур и рабочей области —
 * разные фигуры, разные подписи и разные цвета рамок (бирюзовая, голубая,
 * сиреневая), чтобы уроки не путались.
 */
export function Basic13Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Интерфейс Tinkercad: вверху кнопка Экспорт, слева инструменты, в центре рабочая область с заготовкой, справа панель фигур — куб, цилиндр, сфера, конус"
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

        {/* Окно программы */}
        <rect x="8" y="10" width="304" height="150" rx="8" fill="#0f172a" stroke="#334155" />

        {/* Верхняя строка: имя программы и кнопка «Экспорт» */}
        <rect x="8" y="10" width="304" height="22" fill="#1e293b" />
        <line x1="8" y1="32" x2="312" y2="32" stroke="#334155" />
        <text x="16" y="25" fontSize="10.5" fontWeight="bold" fill="#e2e8f0">
          Tinkercad
        </text>
        <rect x="252" y="14" width="52" height="15" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.4" />
        <text x="278" y="25" fontSize="10" fill="#38bdf8" textAnchor="middle">
          Экспорт
        </text>

        {/* Слева — инструменты */}
        <rect x="14" y="38" width="44" height="94" rx="6" fill="#0f172a" stroke="#a855f7" strokeWidth="1.4" />
        <rect x="20" y="46" width="16" height="16" rx="2" fill="none" stroke="#a855f7" />
        <circle cx="50" cy="54" r="8" fill="none" stroke="#a855f7" />
        <polygon points="36,70 36,86 20,86" fill="none" stroke="#a855f7" />
        <line x1="42" y1="78" x2="58" y2="78" stroke="#a855f7" />
        <line x1="50" y1="70" x2="50" y2="86" stroke="#a855f7" />

        {/* В центре — рабочая область с заготовкой */}
        <rect
          x="66"
          y="38"
          width="158"
          height="94"
          rx="6"
          fill="#0f172a"
          stroke="#38bdf8"
          strokeWidth="1.4"
          strokeDasharray="5 3"
        />
        {canvasVerticals.map((x) => (
          <line key={`v${x}`} x1={x} y1="44" x2={x} y2="126" stroke="#1e293b" />
        ))}
        {canvasHorizontals.map((y) => (
          <line key={`h${y}`} x1="72" y1={y} x2="218" y2={y} stroke="#1e293b" />
        ))}
        <rect
          x={work.x}
          y={work.y}
          width={work.width}
          height={work.height}
          rx="3"
          fill="#334155"
          stroke="#64748b"
        />
        <circle cx="112" cy="80" r="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.6" />
        <text x="150" y="86" fontSize="12" fontWeight="bold" fill="#0f172a" textAnchor="middle">
          ИМЯ
        </text>

        {/* Справа — панель фигур */}
        <rect x="232" y="38" width="74" height="94" rx="6" fill="#0f172a" stroke="#34d399" strokeWidth="1.4" />
        <rect x="240" y="50" width="18" height="18" rx="2" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />
        <rect x="274" y="55" width="18" height="13" rx="2" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />
        <ellipse cx="283" cy="55" rx="9" ry="3.5" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />
        <circle cx="249" cy="90" r="9" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />
        <polygon points="283,81 292,99 274,99" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />
        <ellipse cx="283" cy="99" rx="9" ry="3" fill="#1e293b" stroke="#34d399" strokeWidth="1.4" />

        {/* Подписи зон словами урока */}
        <text x="14" y="148" fontSize="10.5" fill="#94a3b8">
          Инструменты
        </text>
        <text x="145" y="148" fontSize="10.5" fill="#94a3b8" textAnchor="middle">
          Рабочая область
        </text>
        <text x="232" y="148" fontSize="10.5" fill="#94a3b8">
          Фигуры
        </text>
      </svg>
    </VisualWrapper>
  );
}
