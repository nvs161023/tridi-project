import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять слайсеров из content урока: Cura, PrusaSlicer, OrcaSlicer, Bambu Studio,
 * FlashPrint — по одной сильной стороне и одной слабой на каждый.
 *
 * Приём — пять МАЛЕНЬКИХ окон в ряд, а не одно большое окно крупно. От схемы
 * интерфейса Orca из базового урока 3 (одно окно с четырьмя пронумерованными
 * зонами), от окна слайсера из урока 9 (профиль PLA, заполнение, стенки) и от
 * интерфейса Tinkercad из урока 13 отличается именно этим: здесь нет ни зон, ни
 * настроек — только силуэты пяти программ с их отметкой и двумя подписями.
 * От сравнения прошивок из модуля B тоже: там три платы с колонками одной
 * высоты, здесь окна в линейку со своей отметкой в углу.
 *
 * Отметка в углу окна — своя у каждой программы: шестерня плагинов у Cura,
 * стопка модификаторов у PrusaSlicer, перекрестие калибровки у Orca, вкладки у
 * Bambu Studio и крупная простая кнопка у FlashPrint.
 */
const slicers = [
  { x: 6, name: "Cura", mark: "plugins", plus: "бесплатный", minus: "сложный", accent: "#38bdf8" },
  { x: 68, name: "PrusaSlicer", mark: "modifiers", plus: "модификаторы", minus: "—", accent: "#fb923c" },
  { x: 130, name: "OrcaSlicer", mark: "calibration", plus: "калибровки", minus: "—", accent: "#34d399" },
  {
    x: 192,
    name: "Bambu Studio",
    mark: "tabs",
    plus: "автоматизация",
    minus: "только Bambu",
    accent: "#a78bfa",
  },
  {
    x: 254,
    name: "FlashPrint",
    mark: "simple",
    plus: "простой",
    minus: "для FlashForge",
    accent: "#fbbf24",
  },
];

/** Деталь внутри окна: она есть у всех пяти, разница — в отметке рядом. */
function Part({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon
        points={`${x},${y + 11} ${x + 10},${y + 5} ${x + 21},${y + 11} ${x + 21},${y + 23} ${x},${y + 23}`}
        fill="#475569"
      />
      <polygon points={`${x},${y + 11} ${x + 10},${y + 5} ${x + 10},${y + 17} ${x},${y + 23}`} fill="#64748b" />
      <polygon
        points={`${x + 10},${y + 5} ${x + 21},${y + 11} ${x + 21},${y + 23} ${x + 10},${y + 17}`}
        fill="#334155"
      />
    </g>
  );
}

/** Своя отметка программы — то, чем одно окно отличается от другого. */
function Mark({ kind, x, accent }: { kind: string; x: number; accent: string }) {
  if (kind === "plugins") {
    // Cura: шестерня плагинов в углу панели.
    return (
      <g>
        <circle cx={x + 48} cy="60" r="5" fill="#0f172a" stroke={accent} />
        <line x1={x + 48} y1="53" x2={x + 48} y2="56" stroke={accent} />
        <line x1={x + 48} y1="64" x2={x + 48} y2="67" stroke={accent} />
        <line x1={x + 41} y1="56" x2={x + 44} y2="58" stroke={accent} />
        <line x1={x + 52} y1="62" x2={x + 55} y2="64" stroke={accent} />
      </g>
    );
  }

  if (kind === "modifiers") {
    // PrusaSlicer: стопка модификаторов — три вложенных блока.
    return (
      <g>
        <rect x={x + 20} y="54" width="18" height="14" fill="#334155" stroke={accent} />
        <rect x={x + 26} y="62" width="18" height="14" fill="#334155" stroke={accent} />
        <rect x={x + 32} y="70" width="14" height="11" fill="#334155" stroke={accent} />
      </g>
    );
  }

  if (kind === "calibration") {
    // OrcaSlicer: перекрестие калибровки на панели.
    return (
      <g>
        <Part x={x + 19} y={62} />
        <circle cx={x + 48} cy="62" r="5" fill="#0f172a" stroke={accent} />
        <line x1={x + 48} y1="55" x2={x + 48} y2="60" stroke={accent} />
        <line x1={x + 48} y1="64" x2={x + 48} y2="69" stroke={accent} />
        <line x1={x + 41} y1="62" x2={x + 46} y2="62" stroke={accent} />
        <line x1={x + 50} y1="62" x2={x + 55} y2="62" stroke={accent} />
      </g>
    );
  }

  if (kind === "tabs") {
    // Bambu Studio: вкладки в шапке окна, средняя — рабочая.
    return (
      <g>
        <rect x={x + 18} y="53" width="13" height="6" fill="#334155" stroke="#64748b" />
        <rect x={x + 33} y="53" width="13" height="6" fill="#334155" stroke={accent} />
        <rect x={x + 48} y="53" width="10" height="6" fill="#334155" stroke="#64748b" />
        <line x1={x + 33} y1="61" x2={x + 46} y2="61" stroke={accent} />
        <Part x={x + 20} y={66} />
      </g>
    );
  }

  // FlashPrint: простой — деталь и одна крупная кнопка, ничего больше.
  return (
    <g>
      <Part x={x + 20} y={58} />
      <rect x={x + 20} y="87" width="30" height="9" rx="2" fill="#334155" stroke={accent} />
    </g>
  );
}

/**
 * «Сравнение интерфейсов» — пять окон в ряд: у каждого свой силуэт панели,
 * своя отметка и две подписи под окном (сильная сторона зелёным, слабая
 * оранжевым). Внизу — совет урока: начинать с Orca.
 */
export function ProFF1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сравнение интерфейсов: пять слайсеров в ряд — Cura (бесплатный, но сложный), PrusaSlicer (модификаторы), OrcaSlicer (калибровки), Bambu Studio (автоматизация, только для Bambu) и FlashPrint (простой, для FlashForge)"
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

        {/* Пять окон: рамка, шапка, панель слева и своя отметка в углу */}
        {slicers.map((slicer) => (
          <g key={slicer.name}>
            <rect
              x={slicer.x}
              y="42"
              width="60"
              height="62"
              rx="4"
              fill="#0f172a"
              stroke={slicer.accent}
              strokeOpacity="0.7"
            />
            <rect x={slicer.x + 1} y="43" width="58" height="7" fill="#334155" />
            <rect x={slicer.x + 1} y="51" width="15" height="52" fill="#1e293b" />
            <line
              x1={slicer.x + 5}
              y1="59"
              x2={slicer.x + 12}
              y2="59"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            <line
              x1={slicer.x + 5}
              y1="68"
              x2={slicer.x + 12}
              y2="68"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            <Mark kind={slicer.mark} x={slicer.x} accent={slicer.accent} />
          </g>
        ))}

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          пять окон в ряд — у каждого свой характер
        </text>
        <text x="12" y="31" fontSize="9" fill="#6ee7b7">
          сильная сторона — зелёным, слабая — оранжевым
        </text>

        {slicers.map((slicer) => (
          <g key={`text-${slicer.name}`}>
            <text
              x={slicer.x + 30}
              y="116"
              fontSize="8.5"
              fontWeight="bold"
              fill="#93c5fd"
              textAnchor="middle"
            >
              {slicer.name}
            </text>
            <text x={slicer.x + 3} y="132" fontSize="7.5" fill="#6ee7b7">
              {slicer.plus}
            </text>
            <text x={slicer.x + 3} y="149" fontSize="7.5" fill="#fdba74">
              {slicer.minus}
            </text>
          </g>
        ))}

        <text x="12" y="167" fontSize="9" fill="#94a3b8">
          начни с Orca: бесплатный и с калибровками
        </text>

      </svg>
    </VisualWrapper>
  );
}
